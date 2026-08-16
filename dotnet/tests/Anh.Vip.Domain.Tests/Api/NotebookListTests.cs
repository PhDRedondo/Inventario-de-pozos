using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Integración del listado de cuadernos (GET /api/notebooks).</summary>
public class NotebookListTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public NotebookListTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
    }

    [Fact]
    public async Task List_ReturnsCreatedNotebooksWithVersionCount()
    {
        var admin = _factory.CreateAuthedClient(roles: "admin");
        var create = await admin.PostAsJsonAsync("/api/notebooks", new { operadora = "TECPETROL COLOMBIA SAS", title = "Lista test" });
        create.EnsureSuccessStatusCode();
        var id = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var list = await (await admin.GetAsync("/api/notebooks?operadora=TECPETROL COLOMBIA SAS"))
            .Content.ReadFromJsonAsync<JsonElement>();

        var notebooks = list.GetProperty("notebooks").EnumerateArray().ToList();
        Assert.Contains(notebooks, n => n.GetProperty("id").GetInt32() == id);
        var mine = notebooks.First(n => n.GetProperty("id").GetInt32() == id);
        Assert.Equal("TECPETROL COLOMBIA SAS", mine.GetProperty("operadora").GetString());
        Assert.Equal("active", mine.GetProperty("status").GetString());
        Assert.Equal(0, mine.GetProperty("versionCount").GetInt32());
    }

    [Fact]
    public async Task List_Operadora_ScopedToOwn()
    {
        // Un cuaderno de otra operadora, creado por admin.
        var admin = _factory.CreateAuthedClient(roles: "admin");
        await admin.PostAsJsonAsync("/api/notebooks", new { operadora = "HUPECOL OPERATING CO LLC", title = "ajeno" });

        // La operadora GEOPARK crea el suyo y solo debe ver el suyo.
        var op = _factory.CreateAuthedClient(roles: "operadora", email: "op@geopark.com", operadora: "GEOPARK COLOMBIA S.A.S.");
        await op.PostAsJsonAsync("/api/notebooks", new { operadora = "IGNORADA", title = "mío" });

        var list = await (await op.GetAsync("/api/notebooks")).Content.ReadFromJsonAsync<JsonElement>();
        var notebooks = list.GetProperty("notebooks").EnumerateArray().ToList();

        Assert.NotEmpty(notebooks);
        Assert.All(notebooks, n => Assert.Equal("GEOPARK COLOMBIA S.A.S.", n.GetProperty("operadora").GetString()));
    }
}
