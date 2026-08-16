using Anh.Vip.Domain.Catalogs;
using Anh.Vip.Domain.Geo;
using Microsoft.Extensions.DependencyInjection;

namespace Anh.Vip.Infrastructure.Ingestion;

/// <summary>
/// Carga y cachea los catálogos (lista + DANE) desde SQL Server una sola vez.
/// Registrar como singleton.
/// </summary>
public sealed class CatalogCache(IServiceScopeFactory scopeFactory)
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private (ICatalogProvider Catalogs, GeographyResolver Geo)? _cached;

    public async Task<(ICatalogProvider Catalogs, GeographyResolver Geo)> GetAsync(CancellationToken ct = default)
    {
        if (_cached is { } ready) return ready;
        await _lock.WaitAsync(ct);
        try
        {
            if (_cached is null)
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
                var catalogs = await DbCatalogProvider.LoadAsync(db, ct);
                var geo = await DbGeographyResolver.LoadAsync(db, ct);
                _cached = (catalogs, geo);
            }
        }
        finally
        {
            _lock.Release();
        }
        return _cached.Value;
    }

    /// <summary>Descarta el caché (tras actualizar catálogos).</summary>
    public void Invalidate() => _cached = null;
}
