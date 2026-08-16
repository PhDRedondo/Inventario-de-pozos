using Anh.Vip.Domain.Text;

namespace Anh.Vip.Domain.Geo;

/// <summary>
/// Resolución geográfica contra el catálogo DANE — port fiel de <c>etl.ts</c> y
/// de <c>resolveDaneCodes</c> (db.ts). Canoniza departamentos y municipios y
/// asigna sus códigos DANE.
/// </summary>
public sealed class GeographyResolver
{
    private static readonly string[] ExtraDepartamentos = { "OFFSHORE" };

    // normalizeGeoName(nombre) -> nombre canónico (departamentos_dane + OFFSHORE)
    private readonly Dictionary<string, string> _deptCanonical = new(StringComparer.Ordinal);
    // normalizeGeoName(nombre) -> código DANE (solo departamentos_dane)
    private readonly Dictionary<string, string> _deptCode = new(StringComparer.Ordinal);
    // normalizeGeoName(nombre) -> municipio
    private readonly Dictionary<string, DaneMunicipio> _muniByNorm = new(StringComparer.Ordinal);

    public GeographyResolver(IEnumerable<DaneDepartamento> departamentos, IEnumerable<DaneMunicipio> municipios)
    {
        foreach (var d in departamentos)
        {
            var key = SpanishText.NormalizeGeoName(d.Nombre);
            _deptCanonical.TryAdd(key, d.Nombre);
            _deptCode.TryAdd(key, d.Codigo);
        }
        foreach (var extra in ExtraDepartamentos)
            _deptCanonical.TryAdd(SpanishText.NormalizeGeoName(extra), extra);

        foreach (var m in municipios)
            _muniByNorm.TryAdd(SpanishText.NormalizeGeoName(m.Nombre), m);
    }

    /// <summary>Lista canónica y ordenada de departamentos (DANE + OFFSHORE).</summary>
    public IReadOnlyList<string> GetCanonicalDepartamentoList() =>
        _deptCanonical.Values.Distinct().OrderBy(n => n, StringComparer.Create(new System.Globalization.CultureInfo("es"), false)).ToList();

    public GeographyResolution ResolveDepartamento(string? raw)
    {
        if (string.IsNullOrEmpty(raw) || raw.Trim().Length == 0)
            return new GeographyResolution { Value = null, Original = raw, Matched = false };

        var original = raw.Trim();
        var repaired = SpanishText.SanitizeSpanishText(original);
        var encodingRepaired = repaired != original;
        _deptCanonical.TryGetValue(SpanishText.NormalizeGeoName(repaired), out var canonical);

        return new GeographyResolution
        {
            Value = canonical,
            Original = original,
            EncodingRepaired = encodingRepaired,
            Canonicalized = canonical is not null && canonical != original,
            Matched = canonical is not null,
        };
    }

    public MunicipioResolution ResolveMunicipio(string? raw)
    {
        if (string.IsNullOrEmpty(raw) || raw.Trim().Length == 0)
            return new MunicipioResolution { Value = null, Original = raw, Matched = false, DeptCode = null };

        var original = raw.Trim();
        var repaired = SpanishText.SanitizeSpanishText(original);
        var encodingRepaired = repaired != original;
        _muniByNorm.TryGetValue(SpanishText.NormalizeGeoName(repaired), out var match);

        return new MunicipioResolution
        {
            Value = match?.Nombre,
            Original = original,
            EncodingRepaired = encodingRepaired,
            Canonicalized = match is not null && match.Nombre != original,
            Matched = match is not null,
            DeptCode = match?.DeptCode,
        };
    }

    /// <summary>Resuelve los códigos DANE — port de <c>resolveDaneCodes</c> (db.ts).</summary>
    public DaneCodes ResolveDaneCodes(string? departamento, string? municipio)
    {
        string? codigoDepto = null;
        string? codigoMuni = null;

        if (!string.IsNullOrEmpty(departamento) &&
            _deptCode.TryGetValue(SpanishText.NormalizeGeoName(departamento), out var dCode))
            codigoDepto = dCode;

        if (!string.IsNullOrEmpty(municipio) &&
            _muniByNorm.TryGetValue(SpanishText.NormalizeGeoName(municipio), out var m))
        {
            codigoMuni = m.Codigo;
            if (string.IsNullOrEmpty(codigoDepto))
                codigoDepto = m.DeptCode;
        }

        return new DaneCodes(codigoDepto, codigoMuni);
    }

    /// <summary>Equivale a <c>isCanonicalDepartamento</c> (etl.ts).</summary>
    public bool IsCanonicalDepartamento(string? value) =>
        string.IsNullOrEmpty(value) ? true : ResolveDepartamento(value).Matched;
}
