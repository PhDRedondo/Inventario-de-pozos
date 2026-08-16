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
}
