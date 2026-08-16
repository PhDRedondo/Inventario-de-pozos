using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>
/// Host de pruebas de la API con EF Core InMemory (sin SQL Server). Los
/// catálogos oficiales se siembran desde <c>seed.json</c> con <see cref="EnsureSeeded"/>
/// usando el proveedor real del host (para compartir el store en memoria).
/// </summary>
public sealed class VipApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = "vip-tests-" + Guid.NewGuid().ToString("N");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            var toRemove = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<VipDbContext>) ||
                d.ServiceType == typeof(VipDbContext)).ToList();
            foreach (var d in toRemove) services.Remove(d);

            services.AddDbContext<VipDbContext>(o => o.UseInMemoryDatabase(_dbName));
        });
    }

    public void EnsureSeeded()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
        CatalogSeeder.SeedFromFile(db, System.IO.Path.Combine(AppContext.BaseDirectory, "seed.json"));
    }

    public VipDbContext NewDbContext() => Services.CreateScope().ServiceProvider.GetRequiredService<VipDbContext>();
}
