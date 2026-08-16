using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Autenticación y autorización por rol de la API (GU-18 Anexo 2).</summary>
public class AuthorizationTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public AuthorizationTests(VipApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Health_IsAnonymous()
    {
        var res = await _factory.CreateClient().GetAsync("/health");
        res.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task CreateNotebook_Anonymous_Returns401()
    {
        var res = await _factory.CreateClient()
            .PostAsJsonAsync("/api/notebooks", new { operadora = "HOCOL S.A." });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task CreateNotebook_AnhRole_Returns403()
    {
        var client = _factory.CreateAuthedClient(roles: "anh", email: "func@anh.gov.co");
        var res = await client.PostAsJsonAsync("/api/notebooks", new { operadora = "HOCOL S.A." });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Validations_UnknownRole_Returns403()
    {
        var client = _factory.CreateAuthedClient(roles: "guest", email: "x@x.com");
        var res = await client.GetAsync("/api/validations?uploadId=1");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Validations_AnhRole_Allowed()
    {
        var client = _factory.CreateAuthedClient(roles: "anh", email: "func@anh.gov.co");
        var res = await client.GetAsync("/api/validations?uploadId=999999");
        res.EnsureSuccessStatusCode(); // 200 con lista vacía
    }

    [Fact]
    public async Task CreateNotebook_OperadoraRole_ForcesOperadoraAndRecordsActor()
    {
        var client = _factory.CreateAuthedClient(
            roles: "operadora", email: "op@geopark.com", operadora: "GEOPARK COLOMBIA S.A.S.");

        // El cuerpo intenta otra operadora; debe forzarse la del usuario.
        var create = await client.PostAsJsonAsync("/api/notebooks",
            new { operadora = "OPERADORA SUPLANTADA", title = "t" });
        create.EnsureSuccessStatusCode();
        var created = await create.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("GEOPARK COLOMBIA S.A.S.", created.GetProperty("operadora").GetString());

        var id = created.GetProperty("id").GetInt32();
        var detail = await (await client.GetAsync($"/api/notebooks/{id}")).Content.ReadFromJsonAsync<JsonElement>();
        var actor = detail.GetProperty("events").EnumerateArray().First().GetProperty("actorEmail").GetString();
        Assert.Equal("op@geopark.com", actor);
    }
}
