using System.Text.Json;
using Anh.Vip.Domain.Catalogs;

namespace Anh.Vip.Domain.Tests;

/// <summary>
/// Construye un <see cref="InMemoryCatalogProvider"/> desde el mismo
/// <c>data/seed.json</c> del piloto, para validar con datos idénticos.
/// </summary>
public static class CatalogTestData
{
    public static ICatalogProvider Build()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "seed.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var catalogs = doc.RootElement.GetProperty("catalogs");

        var lists = new Dictionary<string, IReadOnlyCollection<string>>();
        var deptNames = new List<string>();

        foreach (var prop in catalogs.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Array)
            {
                lists[prop.Name] = prop.Value.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => e.GetString()!)
                    .ToList();
            }
            else if (prop.Name == "departamentos_dane" && prop.Value.ValueKind == JsonValueKind.Object)
            {
                deptNames = prop.Value.EnumerateObject()
                    .Select(p => p.Value.GetString()!)
                    .ToList();
            }
        }

        return new InMemoryCatalogProvider(lists, deptNames);
    }
}
