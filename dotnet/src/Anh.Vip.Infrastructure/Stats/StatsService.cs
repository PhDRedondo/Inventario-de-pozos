using Anh.Vip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure.Stats;

public sealed record WellRow(
    int Id, string? NombrePozoSgc, string? Operadora, string? Departamento,
    string? EstadoPozo, string? ValidationStatus, string? UwiFiscalizado);

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
    public async Task<DashboardStats> GetAsync(string role, string? operadora, int limit, CancellationToken ct = default)
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

        var wellsQ = query.Select(x => x.w);

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
