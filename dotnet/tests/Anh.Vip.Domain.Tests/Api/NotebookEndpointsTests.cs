using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Excel;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Integración de los endpoints de submit, validaciones y plantilla.</summary>
public class NotebookEndpointsTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public NotebookEndpointsTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
    }

    private static async Task<MultipartFormDataContent> SampleForm()
    {
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "inventario-sample.xlsx"));
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return new MultipartFormDataContent { { file, "file", "inventario-sample.xlsx" } };
    }

    private async Task<int> CreateNotebook(HttpClient client, string operadora)
    {
        var res = await client.PostAsJsonAsync("/api/notebooks", new { operadora, title = "t", actorEmail = "tester" });
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Submit_WithInvalidRecords_Returns400()
    {
        var client = _factory.CreateAuthedClient();
        var id = await CreateNotebook(client, "HOCOL S.A.");
        (await client.PostAsync($"/api/notebooks/{id}/upload", await SampleForm())).EnsureSuccessStatusCode();

        var res = await client.PostAsync($"/api/notebooks/{id}/submit", null);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("Corrija", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Submit_CleanVersion_MarksSubmitted()
    {
        var client = _factory.CreateAuthedClient();
        var id = await CreateNotebook(client, "HOCOL S.A.");

        // Sembrar una versión activa sin pozos inválidos.
        int uploadId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
            var notebook = db.Notebooks.First(n => n.Id == id);
            var upload = new Upload
            {
                Filename = "ok.xlsx", Operadora = "HOCOL S.A.", NotebookId = id, VersionNumber = 1,
                Status = "draft", TotalRecords = 1, ValidRecords = 1, InvalidRecords = 0,
                CreatedAt = DateTime.UtcNow,
            };
            db.Uploads.Add(upload);
            db.SaveChanges();
            notebook.ActiveVersionId = upload.Id;
            db.SaveChanges();
            uploadId = upload.Id;
        }

        var res = await client.PostAsync($"/api/notebooks/{id}/submit", null);
        res.EnsureSuccessStatusCode();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
            var notebook = db.Notebooks.First(n => n.Id == id);
            Assert.Equal("submitted", notebook.Status);
            Assert.Equal(uploadId, notebook.SubmittedVersionId);
            Assert.Equal("submitted", db.Uploads.First(u => u.Id == uploadId).Status);
            Assert.Contains("submit", db.NotebookEvents.Where(e => e.NotebookId == id).Select(e => e.EventType).ToList());
        }
    }

    [Fact]
    public async Task Validations_ReturnsFindingsForVersion()
    {
        var client = _factory.CreateAuthedClient();
        var id = await CreateNotebook(client, "HOCOL S.A.");
        var up = await client.PostAsync($"/api/notebooks/{id}/upload", await SampleForm());
        up.EnsureSuccessStatusCode();
        var uploadId = (await up.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("upload_id").GetInt32();

        var res = await client.GetAsync($"/api/validations?uploadId={uploadId}");
        res.EnsureSuccessStatusCode();
        var report = await res.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(2, report.GetArrayLength());
        var anyIssues = report.EnumerateArray().Any(w => w.GetProperty("issues").GetArrayLength() > 0);
        Assert.True(anyIssues);
        var first = report.EnumerateArray().First();
        Assert.True(first.TryGetProperty("well_id", out _));
        Assert.True(first.TryGetProperty("is_valid", out _));
    }

    [Fact]
    public async Task Template_Download_HasHeadersRowsDropdownsAndSheets()
    {
        var client = _factory.CreateAuthedClient();
        var res = await client.GetAsync($"/api/notebooks/template?rows=3&operadora={Uri.EscapeDataString("HOCOL S.A.")}");
        res.EnsureSuccessStatusCode();
        var bytes = await res.Content.ReadAsByteArrayAsync();

        // Lectura por encabezados (mismo lector del pipeline).
        using (var ms = new MemoryStream(bytes))
        {
            var sheet = ExcelSheetReader.Read(ms);
            Assert.Equal("INVENTARIO", sheet.SheetName);
            Assert.Equal(3, sheet.Rows.Count);                       // 3 filas de datos
            Assert.Equal(37, sheet.Rows[0].Count);                   // 37 columnas
            Assert.All(sheet.Rows, r => Assert.Equal("HOCOL S.A.", r["OPERADORA"])); // operadora prellenada
        }

        // Estructura del libro: hojas y selectores.
        using (var ms = new MemoryStream(bytes))
        using (var wb = new XLWorkbook(ms))
        {
            Assert.Contains(wb.Worksheets, w => w.Name == "Listas");
            Assert.Contains(wb.Worksheets, w => w.Name == "Instrucciones");
            Assert.True(wb.Worksheet("INVENTARIO").DataValidations.Any()); // hay selectores
        }
    }
}
