using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Anh.Vip.Infrastructure;

/// <summary>
/// Fábrica de diseño para las herramientas de EF Core (<c>dotnet ef</c>).
/// La cadena de conexión se toma de la variable de entorno <c>VIP_DB</c> o de un
/// valor local por defecto; solo se usa en tiempo de diseño (migraciones).
/// </summary>
public sealed class VipDbContextFactory : IDesignTimeDbContextFactory<VipDbContext>
{
    public VipDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("VIP_DB")
            ?? "Server=localhost;Database=VIP_Inventario;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=True";

        var options = new DbContextOptionsBuilder<VipDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new VipDbContext(options);
    }
}
