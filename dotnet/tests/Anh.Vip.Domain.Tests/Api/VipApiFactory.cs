using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Infrastructure;
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
        if (db.CatDepartamentos.Any()) return;

        var path = System.IO.Path.Combine(AppContext.BaseDirectory, "seed.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
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

    public VipDbContext NewDbContext() => Services.CreateScope().ServiceProvider.GetRequiredService<VipDbContext>();
}
