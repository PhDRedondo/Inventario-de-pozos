using Anh.Vip.Domain.Text;

namespace Anh.Vip.Domain.Catalogs;

/// <summary>
/// Proveedor de catálogos en memoria. Reproduce la semántica de validation.ts /
/// etl.ts sobre los mismos datos de <c>data/seed.json</c>. Útil para pruebas y
/// para escenarios sin base de datos.
/// </summary>
public sealed class InMemoryCatalogProvider : ICatalogProvider
{
    private static readonly string[] ExtraDepartamentos = { "OFFSHORE" };

    private readonly IReadOnlyDictionary<string, HashSet<string>> _lists;
    private readonly HashSet<string> _departamentoKeys;

    public InMemoryCatalogProvider(
        IReadOnlyDictionary<string, IReadOnlyCollection<string>> lists,
        IEnumerable<string> departamentoNames)
    {
        _lists = lists.ToDictionary(
            kv => kv.Key,
            kv => new HashSet<string>(kv.Value, StringComparer.Ordinal));

        _departamentoKeys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var name in departamentoNames.Concat(ExtraDepartamentos))
            _departamentoKeys.Add(SpanishText.NormalizeGeoName(name));
    }

    public bool IsInList(string catalogKey, string? value)
    {
        if (string.IsNullOrEmpty(value)) return true;      // isInCatalog: !value -> true
        if (!_lists.TryGetValue(catalogKey, out var set)) return true; // catálogo inexistente -> true
        return set.Contains(value);
    }

    public bool IsCanonicalDepartamento(string? value)
    {
        if (string.IsNullOrEmpty(value)) return true;       // !value (null o "") -> true
        var original = value.Trim();
        if (original.Length == 0) return false;             // resolveDepartamento: trim vacío -> no match
        var key = SpanishText.NormalizeGeoName(SpanishText.SanitizeSpanishText(original));
        return _departamentoKeys.Contains(key);
    }
}
