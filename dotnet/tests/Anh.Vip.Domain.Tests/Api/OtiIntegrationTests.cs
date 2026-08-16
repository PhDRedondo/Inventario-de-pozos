using System.Collections.Concurrent;
using System.Net.Http.Json;
using Anh.Vip.Api.Security;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Notifications;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>Emisor de correo que captura los mensajes en memoria para las pruebas.</summary>
public sealed class CapturingEmailSender : IEmailSender
{
    public ConcurrentQueue<EmailMessage> Sent { get; } = new();

    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        Sent.Enqueue(message);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Integraciones OTI: validación fail-closed de la config Entra/OIDC y la
/// notificación SMTP al aplicar (submit) un cuaderno.
/// </summary>
public class OtiIntegrationTests : IClassFixture<VipApiFactory>
{
    private readonly VipApiFactory _factory;

    public OtiIntegrationTests(VipApiFactory factory)
    {
        _factory = factory;
        _factory.EnsureSeeded();
    }

    // ---- Fail-closed de la configuración Entra/OIDC --------------------------

    [Fact]
    public void Oidc_Production_WithoutConfig_Throws()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => OidcConfig.Validate(authority: "", audience: "", skip: false));
        Assert.Contains("Oidc:Authority", ex.Message);
        Assert.Contains("Oidc:Audience", ex.Message);
    }

    [Fact]
    public void Oidc_Production_WithTenant_DoesNotThrow()
    {
        OidcConfig.Validate(
            authority: "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0",
            audience: "api://anh-vip",
            skip: false);
    }

    [Fact]
    public void Oidc_DevOrTestHarness_SkipsValidation()
    {
        OidcConfig.Validate(authority: "", audience: "", skip: true); // no lanza
    }

    // ---- Notificación SMTP al aplicar el cuaderno ----------------------------

    [Fact]
    public async Task Submit_SendsAnhNotificationEmail()
    {
        var capture = new CapturingEmailSender();
        var factory = _factory.WithWebHostBuilder(b =>
            b.ConfigureTestServices(s => s.AddScoped<IEmailSender>(_ => capture)));

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User", "operador@hocol.com");
        client.DefaultRequestHeaders.Add("X-Test-Roles", "operadora");
        client.DefaultRequestHeaders.Add("X-Test-Operadora", "HOCOL S.A.");

        // Crear cuaderno + versión activa limpia (0 inválidos).
        var created = await (await client.PostAsJsonAsync("/api/notebooks",
            new { operadora = "HOCOL S.A.", title = "OTI correo" })).Content.ReadFromJsonAsync<JsonElementLike>();
        var id = created!.Id;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
            var notebook = db.Notebooks.First(n => n.Id == id);
            var upload = new Upload
            {
                Filename = "ok.xlsx", Operadora = "HOCOL S.A.", NotebookId = id, VersionNumber = 1,
                Status = "draft", TotalRecords = 3, ValidRecords = 3, InvalidRecords = 0,
                CreatedAt = DateTime.UtcNow,
            };
            db.Uploads.Add(upload);
            db.SaveChanges();
            notebook.ActiveVersionId = upload.Id;
            db.SaveChanges();
        }

        (await client.PostAsync($"/api/notebooks/{id}/submit", null)).EnsureSuccessStatusCode();

        Assert.True(capture.Sent.TryDequeue(out var mail));
        Assert.Equal("inventariopozos@anh.gov.co", mail!.To);
        Assert.Contains("HOCOL S.A.", mail.Subject);
        Assert.Contains("3/3", mail.Body); // 3 de 3 pozos válidos
    }

    /// <summary>DTO mínimo para leer el id del cuaderno creado.</summary>
    private sealed class JsonElementLike
    {
        public int Id { get; set; }
    }
}
