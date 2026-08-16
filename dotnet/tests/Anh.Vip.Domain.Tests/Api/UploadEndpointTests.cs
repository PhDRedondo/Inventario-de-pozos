using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Anh.Vip.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>
/// Prueba de integración del endpoint de carga: HTTP -> lectura de Excel ->
/// ingesta (parseo + ETL + DANE + validación) -> persistencia con EF Core.
/// </summary>
public class UploadEndpointTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public UploadEndpointTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
    }

    private static async Task<MultipartFormDataContent> SampleForm()
    {
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "inventario-sample.xlsx"));
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        var form = new MultipartFormDataContent { { file, "file", "inventario-sample.xlsx" } };
        return form;
    }

    [Fact]
    public async Task Upload_CreatesVersion_PersistsWellsAndFindings()
    {
        var client = _factory.CreateClient();

        // 1) Crear cuaderno
        var create = await client.PostAsJsonAsync("/api/notebooks",
            new { operadora = "HOCOL S.A.", title = "Prueba de carga", actorEmail = "tester" });
        create.EnsureSuccessStatusCode();
        var notebookId = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // 2) Cargar el Excel de muestra
        var res = await client.PostAsync($"/api/notebooks/{notebookId}/upload", await SampleForm());
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(1, body.GetProperty("version_number").GetInt32());
        var summary = body.GetProperty("summary");
        Assert.Equal(2, summary.GetProperty("total").GetInt32());     // fila LISTA excluida
        Assert.Equal(0, summary.GetProperty("valid").GetInt32());
        Assert.Equal(2, summary.GetProperty("invalid").GetInt32());

        // 3) Verificar persistencia
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();

            var uploads = db.Uploads.Where(u => u.NotebookId == notebookId).ToList();
            var upload = Assert.Single(uploads);
            Assert.Equal(2, upload.TotalRecords);
            Assert.Equal("draft", upload.Status);

            var wells = db.Wells.Where(w => w.UploadId == upload.Id).ToList();
            Assert.Equal(2, wells.Count);
            Assert.All(wells, w => Assert.Equal("HOCOL S.A.", w.Operadora)); // operadora forzada del cuaderno
            Assert.Contains(wells, w => (w.UwiFiscalizado ?? "").StartsWith("50568RUBI"));

            var wellIds = wells.Select(w => w.Id).ToHashSet();
            Assert.NotEmpty(db.ValidationIssues.Where(i => wellIds.Contains(i.WellId)).ToList());

            var notebook = db.Notebooks.First(n => n.Id == notebookId);
            Assert.Equal(upload.Id, notebook.ActiveVersionId);

            var events = db.NotebookEvents.Where(e => e.NotebookId == notebookId).Select(e => e.EventType).ToList();
            Assert.Contains("created", events);
            Assert.Contains("upload", events);
        }

        // 4) Segunda carga -> versión 2
        var res2 = await client.PostAsync($"/api/notebooks/{notebookId}/upload", await SampleForm());
        res2.EnsureSuccessStatusCode();
        var body2 = await res2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, body2.GetProperty("version_number").GetInt32());
    }

    [Fact]
    public async Task Upload_UnknownNotebook_Returns404()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsync("/api/notebooks/999999/upload", await SampleForm());
        Assert.Equal(System.Net.HttpStatusCode.NotFound, res.StatusCode);
    }
}
