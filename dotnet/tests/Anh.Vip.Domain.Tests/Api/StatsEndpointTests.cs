using System.Net.Http.Json;
using System.Text.Json;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Integración del panel (/api/stats) con alcance por rol.</summary>
public class StatsEndpointTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public StatsEndpointTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
        using var scope = _factory.Services.CreateScope();
        DemoDataSeeder.Seed(scope.ServiceProvider.GetRequiredService<VipDbContext>());
    }

    [Fact]
    public async Task Stats_Admin_SeesAllAppliedWells()
    {
        var client = _factory.CreateAuthedClient(roles: "admin");
        var stats = await (await client.GetAsync("/api/stats")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(12, stats.GetProperty("totalWells").GetInt32());
        Assert.True(stats.GetProperty("byOperadora").GetArrayLength() >= 3);
        Assert.True(stats.GetProperty("byEstado").GetArrayLength() >= 1);
        Assert.True(stats.GetProperty("wells").GetArrayLength() > 0);
        // KeyValuePair se serializa como { key, value }.
        var firstOp = stats.GetProperty("byOperadora").EnumerateArray().First();
        Assert.True(firstOp.TryGetProperty("key", out _));
        Assert.True(firstOp.TryGetProperty("value", out _));
    }

    [Fact]
    public async Task Stats_Operadora_ScopedToOwnWells()
    {
        var client = _factory.CreateAuthedClient(roles: "operadora", email: "op@hocol.com", operadora: "HOCOL S.A.");
        var stats = await (await client.GetAsync("/api/stats")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(3, stats.GetProperty("totalWells").GetInt32()); // solo pozos de HOCOL
    }

    [Fact]
    public async Task Stats_RequiresAuthentication()
    {
        var res = await _factory.CreateClient().GetAsync("/api/stats");
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
