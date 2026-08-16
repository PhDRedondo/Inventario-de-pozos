using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Integración de la analítica comparativa (/api/analytics).</summary>
public class AnalyticsEndpointTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public AnalyticsEndpointTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
        using var scope = _factory.Services.CreateScope();
        DemoDataSeeder.Seed(scope.ServiceProvider.GetRequiredService<VipDbContext>());
    }

    [Fact]
    public async Task Analytics_National_ReturnsMetricsAndEntities()
    {
        var client = _factory.CreateAuthedClient(roles: "anh", email: "func@anh.gov.co");
        var res = await (await client.GetAsync("/api/analytics")).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("nacional", res.GetProperty("entityType").GetString());
        Assert.Equal(4, res.GetProperty("metrics").GetArrayLength());
        Assert.True(res.GetProperty("operadoras").GetArrayLength() >= 3);
        Assert.True(res.GetProperty("departamentos").GetArrayLength() >= 3);

        // Nacional: la entidad es el propio universo -> índice 100 en cada métrica.
        foreach (var m in res.GetProperty("metrics").EnumerateArray())
            Assert.Equal(100, m.GetProperty("index").GetDouble());
    }

    [Fact]
    public async Task Analytics_Operadora_IndexesRelativeToNational()
    {
        var client = _factory.CreateAuthedClient(roles: "admin");
        var res = await (await client.GetAsync(
            $"/api/analytics?entityType=operadora&entity={Uri.EscapeDataString("PAREX RESOURCES COLOMBIA LTD")}"))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("operadora", res.GetProperty("entityType").GetString());
        Assert.Equal("PAREX RESOURCES COLOMBIA LTD", res.GetProperty("entityLabel").GetString());

        // PAREX: ambos pozos activos (100% activos) frente a un nacional < 100% -> índice > 100.
        var activo = res.GetProperty("metrics").EnumerateArray().First(m => m.GetProperty("key").GetString() == "pct_activo");
        Assert.Equal(100.0, activo.GetProperty("entityValue").GetDouble());
        Assert.True(activo.GetProperty("index").GetDouble() > 100);
    }

    [Fact]
    public async Task Sankey_ReturnsThreeColumnsAndLinks()
    {
        var client = _factory.CreateAuthedClient(roles: "admin");
        var res = await (await client.GetAsync("/api/analytics/sankey")).Content.ReadFromJsonAsync<JsonElement>();

        var nodes = res.GetProperty("nodes").EnumerateArray().ToList();
        var links = res.GetProperty("links").EnumerateArray().ToList();

        Assert.Contains(nodes, n => n.GetProperty("col").GetInt32() == 0); // departamento
        Assert.Contains(nodes, n => n.GetProperty("col").GetInt32() == 1); // estado
        Assert.Contains(nodes, n => n.GetProperty("col").GetInt32() == 2); // operadora
        Assert.NotEmpty(links);

        // Los 12 pozos del inventario demo se distribuyen por columna.
        var deptTotal = nodes.Where(n => n.GetProperty("col").GetInt32() == 0).Sum(n => n.GetProperty("value").GetInt32());
        Assert.Equal(12, deptTotal);
    }

    [Fact]
    public async Task Analytics_OperadoraRole_Forbidden()
    {
        var client = _factory.CreateAuthedClient(roles: "operadora", operadora: "HOCOL S.A.");
        var res = await client.GetAsync("/api/analytics");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
