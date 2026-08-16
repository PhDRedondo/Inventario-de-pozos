using Anh.Vip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure.Stats;

/// <summary>Métrica comparada de una entidad frente al promedio nacional (índice base 100).</summary>
public sealed record AnalyticsMetric(string Key, string Label, double EntityValue, double NationalValue, double Index);

/// <summary>Resultado de la analítica comparativa (radar).</summary>
public sealed record AnalyticsResult
{
    public string EntityType { get; init; } = "nacional";
    public string EntityLabel { get; init; } = "Promedio nacional";
    public IReadOnlyList<AnalyticsMetric> Metrics { get; init; } = [];
    public IReadOnlyList<string> Operadoras { get; init; } = [];
    public IReadOnlyList<string> Departamentos { get; init; } = [];
}

/// <summary>
/// Analítica comparativa del inventario aplicado — subconjunto del tema «perfil
/// operativo» del piloto (analytics.ts): compara una operadora o departamento
/// frente al promedio nacional (base 100) en indicadores porcentuales.
/// </summary>
public sealed class AnalyticsService(VipDbContext db)
{
    private static readonly (string Key, string Label)[] MetricDefs =
    {
        ("pct_activo", "% activos"),
        ("pct_productor", "% productores"),
        ("pct_inyector", "% inyectores"),
        ("pct_con_uwi", "% con UWI"),
    };

    /// <summary>Inventario aplicado (base de la analítica nacional).</summary>
    private IQueryable<Well> AppliedWells() =>
        from w in db.Wells.AsNoTracking()
        join u in db.Uploads.AsNoTracking() on w.UploadId equals u.Id
        where u.Status == "submitted" || u.Status == "seed" || u.Status == "processed"
        select w;

    public async Task<AnalyticsResult> GetAsync(string? entityType, string? entity, CancellationToken ct = default)
    {
        var national = AppliedWells();
        var entitySet = national;
        var label = "Promedio nacional";
        var type = "nacional";

        if (!string.IsNullOrEmpty(entity))
        {
            if (entityType == "operadora") { entitySet = national.Where(w => w.Operadora == entity); type = "operadora"; label = entity; }
            else if (entityType == "departamento") { entitySet = national.Where(w => w.Departamento == entity); type = "departamento"; label = entity; }
        }

        var nat = await ComputeAsync(national, ct);
        var ent = string.Equals(type, "nacional", StringComparison.Ordinal) ? nat : await ComputeAsync(entitySet, ct);

        var metrics = MetricDefs.Select(m =>
        {
            var e = ent[m.Key];
            var n = nat[m.Key];
            var index = n > 0 ? Math.Round(e / n * 100, 1) : (e > 0 ? 100 : 0);
            return new AnalyticsMetric(m.Key, m.Label, Math.Round(e, 1), Math.Round(n, 1), index);
        }).ToList();

        var operadoras = await national.Where(w => w.Operadora != null)
            .Select(w => w.Operadora!).Distinct().OrderBy(x => x).ToListAsync(ct);
        var departamentos = await national.Where(w => w.Departamento != null)
            .Select(w => w.Departamento!).Distinct().OrderBy(x => x).ToListAsync(ct);

        return new AnalyticsResult
        {
            EntityType = type,
            EntityLabel = label,
            Metrics = metrics,
            Operadoras = operadoras,
            Departamentos = departamentos,
        };
    }

    private static async Task<Dictionary<string, double>> ComputeAsync(IQueryable<Well> set, CancellationToken ct)
    {
        var total = await set.CountAsync(ct);
        if (total == 0)
            return MetricDefs.ToDictionary(m => m.Key, _ => 0.0);

        var activos = await set.CountAsync(w => w.EstadoPozo != null && w.EstadoPozo.StartsWith("Activo"), ct);
        var productores = await set.CountAsync(w => w.TipoObjetivo != null && w.TipoObjetivo.StartsWith("P"), ct);
        var inyectores = await set.CountAsync(w => w.TipoObjetivo != null && w.TipoObjetivo.StartsWith("I"), ct);
        var conUwi = await set.CountAsync(w => w.UwiFiscalizado != null && w.UwiFiscalizado != "", ct);

        double pct(int n) => Math.Round((double)n / total * 100, 1);
        return new Dictionary<string, double>
        {
            ["pct_activo"] = pct(activos),
            ["pct_productor"] = pct(productores),
            ["pct_inyector"] = pct(inyectores),
            ["pct_con_uwi"] = pct(conUwi),
        };
    }
}
