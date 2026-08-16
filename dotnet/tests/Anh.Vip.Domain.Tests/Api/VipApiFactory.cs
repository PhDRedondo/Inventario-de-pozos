using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.AspNetCore.Authentication;
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

            // Sustituir la autenticación por el esquema de prueba (controlable por cabeceras).
            services.AddAuthentication(o =>
            {
                o.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                o.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null);
        });
    }

    /// <summary>Cliente HTTP autenticado con el rol/operadora indicados.</summary>
    public HttpClient CreateAuthedClient(string roles = "admin", string email = "tester@anh.gov.co", string? operadora = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User", email);
        client.DefaultRequestHeaders.Add("X-Test-Roles", roles);
        if (operadora is not null) client.DefaultRequestHeaders.Add("X-Test-Operadora", operadora);
        return client;
    }

    public void EnsureSeeded()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
        CatalogSeeder.SeedFromFile(db, System.IO.Path.Combine(AppContext.BaseDirectory, "seed.json"));
    }

    public VipDbContext NewDbContext() => Services.CreateScope().ServiceProvider.GetRequiredService<VipDbContext>();
}
