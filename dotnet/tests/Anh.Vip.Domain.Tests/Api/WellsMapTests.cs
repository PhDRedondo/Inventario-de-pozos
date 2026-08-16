using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Integración de los puntos del mapa territorial (/api/wells/map).</summary>
public class WellsMapTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public WellsMapTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
        using var scope = _factory.Services.CreateScope();
        DemoDataSeeder.Seed(scope.ServiceProvider.GetRequiredService<VipDbContext>());
    }

    [Fact]
    public async Task Map_ReturnsGeoreferencedWells()
    {
        var client = _factory.CreateAuthedClient(roles: "admin");
        var points = await (await client.GetAsync("/api/wells/map")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(12, points.GetArrayLength()); // los 12 pozos demo tienen coordenadas
        var first = points.EnumerateArray().First();
        var lat = first.GetProperty("lat").GetDouble();
        var lng = first.GetProperty("lng").GetDouble();
        Assert.InRange(lat, -90, 90);
        Assert.InRange(lng, -180, 180);
        Assert.True(first.TryGetProperty("validationStatus", out _));
    }

    [Fact]
    public async Task Map_RequiresAuthentication()
    {
        var res = await _factory.CreateClient().GetAsync("/api/wells/map");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
