using Anh.Vip.Domain.Geo;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure;

/// <summary>
/// Construye un <see cref="GeographyResolver"/> desde las tablas cat_departamento
/// y cat_municipio del esquema [vip].
/// </summary>
public static class DbGeographyResolver
{
    public static async Task<GeographyResolver> LoadAsync(VipDbContext db, CancellationToken ct = default)
    {
        var departamentos = await db.CatDepartamentos
            .AsNoTracking()
            .Select(d => new DaneDepartamento(d.CodigoDane, d.Nombre))
            .ToListAsync(ct);

        var municipios = await db.CatMunicipios
            .AsNoTracking()
            .Select(m => new DaneMunicipio(m.CodigoDane, m.Nombre, m.CodigoDaneDepto))
            .ToListAsync(ct);

        return new GeographyResolver(departamentos, municipios);
    }
}
