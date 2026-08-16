using Anh.Vip.Domain.Catalogs;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure;

/// <summary>
/// Proveedor de catálogos respaldado por SQL Server. Carga los catálogos del
/// esquema [vip] una vez y reutiliza la lógica canónica de
/// <see cref="InMemoryCatalogProvider"/> (misma semántica que el piloto).
/// </summary>
public static class DbCatalogProvider
{
    /// <summary>Construye un proveedor en memoria a partir de las tablas cat_*.</summary>
    public static async Task<ICatalogProvider> LoadAsync(VipDbContext db, CancellationToken ct = default)
    {
        var lists = (await db.CatListaValores
                .AsNoTracking()
                .OrderBy(c => c.Catalogo).ThenBy(c => c.Orden)
                .ToListAsync(ct))
            .GroupBy(c => c.Catalogo)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyCollection<string>)g.Select(c => c.Valor).ToList());

        var deptNames = await db.CatDepartamentos
            .AsNoTracking()
            .Select(d => d.Nombre)
            .ToListAsync(ct);

        return new InMemoryCatalogProvider(lists, deptNames);
    }
}
