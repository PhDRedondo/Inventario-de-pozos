using System.Globalization;
using Anh.Vip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure.Stats;

public sealed record WellRow(
    int Id, string? NombrePozoSgc, string? Operadora, string? Departamento,
    string? EstadoPozo, string? ValidationStatus, string? UwiFiscalizado);

/// <summary>Punto georreferenciado de un pozo para el mapa territorial.</summary>
public sealed record WellMapPoint(
    int Id, string? Nombre, string? Operadora, string? Departamento,
    string? Estado, string? ValidationStatus, double Lat, double Lng);

/// <summary>
/// Conteo de pozos por municipio (código DANE de 5 dígitos) para el coropleto
/// municipal del mapa. <c>CodigoDane</c> corresponde a <c>MPIO_CCNCT</c> del GeoJSON.
/// </summary>
public sealed record MunicipioCount(
    string CodigoDane, string? Municipio, string? Departamento,
    int Total, int Valid, int Warning, int Invalid);

/// <summary>KPIs y desgloses del panel — subconjunto de <c>DashboardStats</c> del piloto.</summary>
public sealed record DashboardStats
{
    public int TotalWells { get; init; }
    public int TotalUploads { get; init; }
    public int ValidWells { get; init; }
    public int WarningWells { get; init; }
    public int InvalidWells { get; init; }
    public IReadOnlyList<KeyValuePair<string, int>> ByEstado { get; init; } = [];
    public IReadOnlyList<KeyValuePair<string, int>> ByOperadora { get; init; } = [];
    public IReadOnlyList<KeyValuePair<string, int>> ByDepartamento { get; init; } = [];
    public IReadOnlyList<KeyValuePair<string, int>> ByTipoObjetivo { get; init; } = [];
    public IReadOnlyList<WellRow> Wells { get; init; } = [];
}

/// <summary>
/// Agregaciones del panel sobre el inventario, con alcance por rol (port del
/// alcance de <c>buildScopeClause</c> / <c>getDashboardStats</c>):
/// admin ve todo; anh ve inventario aplicado y válido/advertencia; operadora ve
/// solo lo suyo aplicado.
/// </summary>
public sealed class StatsService(VipDbContext db)
{
    /// <summary>Pozos visibles según el rol (mismo alcance que el panel).</summary>
    private IQueryable<Well> ScopedWells(string role, string? operadora)
    {
        var query = from w in db.Wells.AsNoTracking()
                    join u in db.Uploads.AsNoTracking() on w.UploadId equals u.Id
                    select new { w, u.Status };

        query = role switch
        {
            "admin" => query,
            "anh" => query.Where(x =>
                (x.Status == "submitted" || x.Status == "seed" || x.Status == "processed") &&
                (x.w.ValidationStatus == "valid" || x.w.ValidationStatus == "warning")),
            _ => query.Where(x =>
                x.w.Operadora == operadora && (x.Status == "submitted" || x.Status == "seed")),
        };

        return query.Select(x => x.w);
    }

    /// <summary>Puntos georreferenciados de los pozos visibles (mapa territorial).</summary>
    public async Task<IReadOnlyList<WellMapPoint>> GetMapPointsAsync(string role, string? operadora, CancellationToken ct = default)
    {
        var rows = await ScopedWells(role, operadora)
            .Where(w => w.Longitud != null && w.Latitud != null)
            .Select(w => new { w.Id, w.NombrePozoSgc, w.Operadora, w.Departamento, w.EstadoPozo, w.ValidationStatus, w.Longitud, w.Latitud })
            .ToListAsync(ct);

        var points = new List<WellMapPoint>();
        foreach (var r in rows)
        {
            if (TryCoord(r.Latitud, out var lat) && TryCoord(r.Longitud, out var lng) &&
                Math.Abs(lat) <= 90 && Math.Abs(lng) <= 180)
            {
                points.Add(new WellMapPoint(r.Id, r.NombrePozoSgc, r.Operadora, r.Departamento, r.EstadoPozo, r.ValidationStatus, lat, lng));
            }
        }
        return points;
    }

    /// <summary>Conteo de pozos por municipio (DANE) para el coropleto, con alcance por rol.</summary>
    public async Task<IReadOnlyList<MunicipioCount>> GetMunicipioCountsAsync(string role, string? operadora, CancellationToken ct = default)
    {
        var grouped = await ScopedWells(role, operadora)
            .Where(w => w.CodigoDaneMuni != null && w.CodigoDaneMuni != "")
            .GroupBy(w => w.CodigoDaneMuni!)
            .Select(g => new
            {
                CodigoDane = g.Key,
                Municipio = g.Max(w => w.Municipio),
                Departamento = g.Max(w => w.Departamento),
                Total = g.Count(),
                Valid = g.Count(w => w.ValidationStatus == "valid"),
                Warning = g.Count(w => w.ValidationStatus == "warning"),
                Invalid = g.Count(w => w.ValidationStatus == "invalid"),
            })
            .ToListAsync(ct);

        return grouped
            .Select(x => new MunicipioCount(x.CodigoDane, x.Municipio, x.Departamento, x.Total, x.Valid, x.Warning, x.Invalid))
            .OrderByDescending(x => x.Total)
            .ToList();
    }

    private static bool TryCoord(string? s, out double value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(s)) return false;
        return double.TryParse(s.Replace(",", "."), NumberStyles.Float, CultureInfo.InvariantCulture, out value);
    }

    public async Task<DashboardStats> GetAsync(string role, string? operadora, int limit, CancellationToken ct = default)
    {
        var wellsQ = ScopedWells(role, operadora);

        var total = await wellsQ.CountAsync(ct);
        var valid = await wellsQ.CountAsync(w => w.ValidationStatus == "valid", ct);
        var warning = await wellsQ.CountAsync(w => w.ValidationStatus == "warning", ct);
        var invalid = await wellsQ.CountAsync(w => w.ValidationStatus == "invalid", ct);
        var totalUploads = await db.Uploads.CountAsync(ct);

        async Task<IReadOnlyList<KeyValuePair<string, int>>> GroupBy(
            System.Linq.Expressions.Expression<Func<Well, string?>> selector)
        {
            var rows = await wellsQ.GroupBy(selector)
                .Select(g => new { Key = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(10)
                .ToListAsync(ct);
            return rows.Select(r => new KeyValuePair<string, int>(r.Key ?? "—", r.Count)).ToList();
        }

        var byEstado = await GroupBy(w => w.EstadoPozo);
        var byOperadora = await GroupBy(w => w.Operadora);
        var byDepartamento = await GroupBy(w => w.Departamento);
        var byObjetivo = await GroupBy(w => w.TipoObjetivo);

        var wells = await wellsQ
            .OrderByDescending(w => w.Id)
            .Take(limit)
            .Select(w => new WellRow(w.Id, w.NombrePozoSgc, w.Operadora, w.Departamento, w.EstadoPozo, w.ValidationStatus, w.UwiFiscalizado))
            .ToListAsync(ct);

        return new DashboardStats
        {
            TotalWells = total,
            TotalUploads = totalUploads,
            ValidWells = valid,
            WarningWells = warning,
            InvalidWells = invalid,
            ByEstado = byEstado,
            ByOperadora = byOperadora,
            ByDepartamento = byDepartamento,
            ByTipoObjetivo = byObjetivo,
            Wells = wells,
        };
    }
}
