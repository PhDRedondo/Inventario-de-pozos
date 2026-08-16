using System.Text.Json;
using Anh.Vip.Domain.Entities;

namespace Anh.Vip.Infrastructure.Ingestion;

/// <summary>
/// Siembra los catálogos oficiales (DANE + listas) desde <c>seed.json</c>.
/// Se usa en el perfil de desarrollo (InMemory) y en las pruebas de integración.
/// </summary>
public static class CatalogSeeder
{
    /// <summary>Siembra desde el archivo <c>seed.json</c>. Idempotente.</summary>
    public static void SeedFromFile(VipDbContext db, string seedJsonPath)
    {
        if (db.CatDepartamentos.Any()) return;

        using var doc = JsonDocument.Parse(File.ReadAllText(seedJsonPath));
        var catalogs = doc.RootElement.GetProperty("catalogs");

        foreach (var d in catalogs.GetProperty("departamentos_dane").EnumerateObject())
            db.CatDepartamentos.Add(new CatDepartamento { CodigoDane = d.Name, Nombre = d.Value.GetString()! });

        foreach (var m in catalogs.GetProperty("municipios_dane").EnumerateObject())
            db.CatMunicipios.Add(new CatMunicipio
            {
                CodigoDane = m.Name,
                Nombre = m.Value.GetProperty("nombre").GetString()!,
                CodigoDaneDepto = m.Value.GetProperty("dept_code").GetString()!,
            });

        foreach (var prop in catalogs.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Array) continue;
            var orden = 0;
            foreach (var v in prop.Value.EnumerateArray())
                db.CatListaValores.Add(new CatListaValor { Catalogo = prop.Name, Valor = v.GetString()!, Orden = orden++ });
        }

        db.SaveChanges();
    }
}
