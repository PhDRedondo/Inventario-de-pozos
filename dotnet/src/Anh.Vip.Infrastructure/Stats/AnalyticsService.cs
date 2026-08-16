using Anh.Vip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure.Stats;

/// <summary>Métrica comparada de una entidad frente al promedio nacional (índice base 100).</summary>
public sealed record AnalyticsMetric(string Key, string Label, double EntityValue, double NationalValue, double Index);

/// <summary>Nodo del Sankey (col 0=departamento, 1=estado, 2=operadora).</summary>
public sealed record SankeyNode(string Id, string Label, int Col, int Value);

/// <summary>Enlace del Sankey entre dos nodos, con el número de pozos.</summary>
public sealed record SankeyLink(string Source, string Target, int Value);

/// <summary>Flujo Departamento → Estado → Operadora del inventario aplicado.</summary>
public sealed record SankeyData(IReadOnlyList<SankeyNode> Nodes, IReadOnlyList<SankeyLink> Links);

/// <summary>Resultado de la analítica comparativa (radar).</summary>
public sealed record AnalyticsResult
{
    public string Theme { get; init; } = "perfil";
    public string EntityType { get; init; } = "nacional";
    public string EntityLabel { get; init; } = "Promedio nacional";
    public IReadOnlyList<AnalyticsMetric> Metrics { get; init; } = [];
    public IReadOnlyList<string> Operadoras { get; init; } = [];
    public IReadOnlyList<string> Departamentos { get; init; } = [];
}

/// <summary>
/// Analítica comparativa del inventario aplicado (analytics.ts): compara una
/// operadora o departamento frente al promedio nacional (base 100). Temas:
/// «perfil» (porcentajes), «produccion» e «inyeccion» (promedios numéricos).
/// </summary>
public sealed class AnalyticsService(VipDbContext db)
{
    private static readonly Dictionary<string, (string Key, string Label)[]> Themes = new(StringComparer.Ordinal)
    {
        ["perfil"] = new[]
        {
            ("pct_activo", "% activos"),
            ("pct_productor", "% productores"),
            ("pct_inyector", "% inyectores"),
            ("pct_con_uwi", "% con UWI"),
        },
        ["produccion"] = new[]
        {
            ("prod_dias", "Días acum. (prod)"),
            ("prod_petroleo", "Petróleo (BBL)"),
            ("prod_agua", "Agua (BBL)"),
            ("prod_gas", "Gas (KPC)"),
        },
        ["inyeccion"] = new[]
        {
            ("iny_dias", "Días acum. (iny)"),
            ("iny_agua", "Agua (BBL)"),
            ("iny_gas", "Gas (KPC)"),
            ("iny_otros", "Otros"),
        },
    };

    private static string ResolveTheme(string? theme) =>
        theme is not null && Themes.ContainsKey(theme) ? theme : "perfil";

    /// <summary>Inventario aplicado (base de la analítica nacional).</summary>
    private IQueryable<Well> AppliedWells() =>
        from w in db.Wells.AsNoTracking()
        join u in db.Uploads.AsNoTracking() on w.UploadId equals u.Id
        where u.Status == "submitted" || u.Status == "seed" || u.Status == "processed"
        select w;

    public async Task<AnalyticsResult> GetAsync(string? theme, string? entityType, string? entity, CancellationToken ct = default)
    {
        var themeKey = ResolveTheme(theme);
        var defs = Themes[themeKey];
        var national = AppliedWells();
        var entitySet = national;
        var label = "Promedio nacional";
        var type = "nacional";

        if (!string.IsNullOrEmpty(entity))
        {
            if (entityType == "operadora") { entitySet = national.Where(w => w.Operadora == entity); type = "operadora"; label = entity; }
            else if (entityType == "departamento") { entitySet = national.Where(w => w.Departamento == entity); type = "departamento"; label = entity; }
        }

        var nat = await ComputeAsync(national, themeKey, ct);
        var ent = string.Equals(type, "nacional", StringComparison.Ordinal) ? nat : await ComputeAsync(entitySet, themeKey, ct);

        var metrics = defs.Select(m =>
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
            Theme = themeKey,
            EntityType = type,
            EntityLabel = label,
            Metrics = metrics,
            Operadoras = operadoras,
            Departamentos = departamentos,
        };
    }

    /// <summary>Flujo Departamento → Estado → Operadora (port del Sankey del panel).</summary>
    public async Task<SankeyData> GetSankeyAsync(CancellationToken ct = default)
    {
        var wells = await AppliedWells()
            .Select(w => new
            {
                Dept = w.Departamento ?? "—",
                Estado = w.EstadoPozo ?? "—",
                Op = w.Operadora ?? "—",
            })
            .ToListAsync(ct);

        static string DeptId(string s) => "d:" + s;
        static string EstadoId(string s) => "e:" + s;
        static string OpId(string s) => "o:" + s;

        var nodes = new List<SankeyNode>();
        nodes.AddRange(wells.GroupBy(w => w.Dept).OrderByDescending(g => g.Count())
            .Select(g => new SankeyNode(DeptId(g.Key), g.Key, 0, g.Count())));
        nodes.AddRange(wells.GroupBy(w => w.Estado).OrderByDescending(g => g.Count())
            .Select(g => new SankeyNode(EstadoId(g.Key), g.Key, 1, g.Count())));
        nodes.AddRange(wells.GroupBy(w => w.Op).OrderByDescending(g => g.Count())
            .Select(g => new SankeyNode(OpId(g.Key), g.Key, 2, g.Count())));

        var links = new List<SankeyLink>();
        links.AddRange(wells.GroupBy(w => (w.Dept, w.Estado)).OrderByDescending(g => g.Count())
            .Select(g => new SankeyLink(DeptId(g.Key.Dept), EstadoId(g.Key.Estado), g.Count())));
        links.AddRange(wells.GroupBy(w => (w.Estado, w.Op)).OrderByDescending(g => g.Count())
            .Select(g => new SankeyLink(EstadoId(g.Key.Estado), OpId(g.Key.Op), g.Count())));

        return new SankeyData(nodes, links);
    }

    private static async Task<Dictionary<string, double>> ComputeAsync(IQueryable<Well> set, string theme, CancellationToken ct)
    {
        if (theme == "perfil")
            return await ComputePerfilAsync(set, ct);
        return await ComputeNumericAsync(set, theme, ct);
    }

    private static async Task<Dictionary<string, double>> ComputePerfilAsync(IQueryable<Well> set, CancellationToken ct)
    {
        var total = await set.CountAsync(ct);
        if (total == 0)
            return Themes["perfil"].ToDictionary(m => m.Key, _ => 0.0);

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

    /// <summary>Promedio de las columnas numéricas del tema (ignorando vacíos/no numéricos).</summary>
    private static async Task<Dictionary<string, double>> ComputeNumericAsync(IQueryable<Well> set, string theme, CancellationToken ct)
    {
        var rows = await set.Select(w => new
        {
            w.ProdDias, w.ProdPetroleo, w.ProdAgua, w.ProdGas,
            w.InyDias, w.InyAgua, w.InyGas, w.InyOtros,
        }).ToListAsync(ct);

        static double? Parse(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            return double.TryParse(s.Replace(",", "."), System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : null;
        }

        string? Col(dynamic r, string key) => key switch
        {
            "prod_dias" => r.ProdDias,
            "prod_petroleo" => r.ProdPetroleo,
            "prod_agua" => r.ProdAgua,
            "prod_gas" => r.ProdGas,
            "iny_dias" => r.InyDias,
            "iny_agua" => r.InyAgua,
            "iny_gas" => r.InyGas,
            "iny_otros" => r.InyOtros,
            _ => null,
        };

        var dict = new Dictionary<string, double>();
        foreach (var (key, _) in Themes[theme])
        {
            var values = rows.Select(r => Parse(Col(r, key))).Where(v => v.HasValue).Select(v => v!.Value).ToList();
            dict[key] = values.Count > 0 ? Math.Round(values.Average(), 1) : 0;
        }
        return dict;
    }
}
