using System.Text.Json;
using Anh.Vip.Domain.Geo;

namespace Anh.Vip.Domain.Tests;

/// <summary>Construye un <see cref="GeographyResolver"/> desde el mismo <c>data/seed.json</c>.</summary>
public static class GeoTestData
{
    public static GeographyResolver Build()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "seed.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var catalogs = doc.RootElement.GetProperty("catalogs");

        var departamentos = catalogs.GetProperty("departamentos_dane").EnumerateObject()
            .Select(p => new DaneDepartamento(p.Name, p.Value.GetString()!))
            .ToList();

        var municipios = catalogs.GetProperty("municipios_dane").EnumerateObject()
            .Select(p => new DaneMunicipio(
                p.Name,
                p.Value.GetProperty("nombre").GetString()!,
                p.Value.GetProperty("dept_code").GetString()!))
            .ToList();

        return new GeographyResolver(departamentos, municipios);
    }
}
