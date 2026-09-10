using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure.Excel;

/// <summary>Carga las listas de opciones de catálogo para la plantilla desde SQL Server.</summary>
public static class TemplateCatalogOptions
{
    public static async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> LoadAsync(
        VipDbContext db, CancellationToken ct = default)
    {
        var options = (await db.CatListaValores
                .AsNoTracking()
                .OrderBy(c => c.Catalogo).ThenBy(c => c.Orden)
                .ToListAsync(ct))
            .GroupBy(c => c.Catalogo)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(c => c.Valor).ToList());

        // Municipios: nombres distintos del catálogo DANE, ordenados.
        var municipios = await db.CatMunicipios
            .AsNoTracking()
            .Select(m => m.Nombre)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync(ct);
        options["municipios"] = municipios;

        return options;
    }

    /// <summary>
    /// Municipios agrupados por nombre de departamento (para el selector
    /// dependiente del municipio). Cada entrada es (departamento, municipios
    /// ordenados). Solo se incluyen departamentos con al menos un municipio.
    /// </summary>
    public static async Task<IReadOnlyList<(string Departamento, IReadOnlyList<string> Municipios)>>
        LoadMunicipiosByDeptAsync(VipDbContext db, CancellationToken ct = default)
    {
        var deptNames = await db.CatDepartamentos
            .AsNoTracking()
            .ToDictionaryAsync(d => d.CodigoDane, d => d.Nombre, ct);

        var munis = await db.CatMunicipios
            .AsNoTracking()
            .Select(m => new { m.Nombre, m.CodigoDaneDepto })
            .ToListAsync(ct);

        return munis
            .Where(m => deptNames.ContainsKey(m.CodigoDaneDepto))
            .GroupBy(m => deptNames[m.CodigoDaneDepto])
            .Select(g => (
                Departamento: g.Key,
                Municipios: (IReadOnlyList<string>)g.Select(m => m.Nombre)
                    .Distinct()
                    .OrderBy(n => n, StringComparer.Create(new System.Globalization.CultureInfo("es"), false))
                    .ToList()))
            .ToList();
    }
}
