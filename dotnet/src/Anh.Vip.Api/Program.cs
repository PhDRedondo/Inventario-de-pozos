using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Excel;
using Anh.Vip.Domain.Uwi;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Excel;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// EF Core + SQL Server (esquema [vip]). La cadena vive en appsettings/entorno.
builder.Services.AddDbContext<VipDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("VipDb")));

builder.Services.AddSingleton<CatalogCache>();
builder.Services.AddScoped<NotebookUploadService>();
builder.Services.AddScoped<NotebookSubmitService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Salud básica.
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Anh.Vip.Api" }))
   .WithName("Health");

// Vista previa del UWI fiscalizado — no requiere base de datos.
app.MapPost("/api/uwi/preview", (UwiWellInput input) =>
{
    var components = UwiGenerator.BuildComponents(input);
    var uwi = UwiGenerator.Generate(input);
    return Results.Ok(new { uwi, valido = UwiGenerator.ValidateFormat(uwi), componentes = components });
})
.WithName("UwiPreview");

// Crear cuaderno.
app.MapPost("/api/notebooks", async (CreateNotebookRequest body, VipDbContext db, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(body.Operadora))
        return Results.BadRequest(new { error = "Seleccione una operadora" });

    var now = DateTime.UtcNow;
    var notebook = new Notebook
    {
        Operadora = body.Operadora.Trim(),
        Title = body.Title?.Trim() ?? "",
        Status = "active",
        CreatedBy = body.ActorEmail,
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.Notebooks.Add(notebook);

    db.NotebookEvents.Add(new NotebookEvent
    {
        Notebook = notebook,
        EventType = "created",
        ActorEmail = body.ActorEmail,
        Message = "Cuaderno creado",
        CreatedAt = now,
    });
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/notebooks/{notebook.Id}", new { notebook.Id, notebook.Operadora, notebook.Title, notebook.Status });
})
.WithName("CreateNotebook");

// Cargar Excel en un cuaderno (crea una versión).
app.MapPost("/api/notebooks/{id:int}/upload", async (
    int id, IFormFile? file, NotebookUploadService service, CancellationToken ct) =>
{
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "Debe adjuntar un archivo Excel (.xlsx)" });

    try
    {
        await using var stream = file.OpenReadStream();
        var result = await service.ProcessAsync(id, file.FileName, stream, actorEmail: "api", ct);
        return Results.Ok(new
        {
            upload_id = result.UploadId,
            version_number = result.VersionNumber,
            summary = result.Summary,
        });
    }
    catch (NotebookNotFoundException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (InvalidUploadException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.WithName("UploadNotebookVersion")
.DisableAntiforgery(); // TODO: reemplazar por CSRF/anti-forgery institucional al integrar auth.

// Detalle del cuaderno (versiones y eventos).
app.MapGet("/api/notebooks/{id:int}", async (int id, VipDbContext db, CancellationToken ct) =>
{
    var notebook = await db.Notebooks.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id, ct);
    if (notebook is null) return Results.NotFound(new { error = "Cuaderno no encontrado" });

    var versions = await db.Uploads.AsNoTracking()
        .Where(u => u.NotebookId == id)
        .OrderBy(u => u.VersionNumber)
        .Select(u => new { u.Id, u.VersionNumber, u.Filename, u.Status, u.TotalRecords, u.ValidRecords, u.InvalidRecords, u.WarningRecords, u.ErrorIssues, u.WarningIssues, u.InfoIssues })
        .ToListAsync(ct);

    var events = await db.NotebookEvents.AsNoTracking()
        .Where(e => e.NotebookId == id)
        .OrderBy(e => e.Id)
        .Select(e => new { e.EventType, e.UploadId, e.ActorEmail, e.Message, e.CreatedAt })
        .ToListAsync(ct);

    return Results.Ok(new
    {
        notebook = new { notebook.Id, notebook.Operadora, notebook.Title, notebook.Status, notebook.ActiveVersionId },
        versions,
        events,
    });
})
.WithName("GetNotebook");

// Aplicar (submit) el inventario a la ANH.
app.MapPost("/api/notebooks/{id:int}/submit", async (int id, NotebookSubmitService service, CancellationToken ct) =>
{
    try
    {
        var result = await service.SubmitAsync(id, submittedBy: "api", ct);
        return Results.Ok(new
        {
            upload_id = result.UploadId,
            version_number = result.VersionNumber,
            message = "Inventario aplicado. La versión queda visible como enviada.",
        });
    }
    catch (NotebookNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
    catch (InvalidUploadException ex) { return Results.BadRequest(new { error = ex.Message }); }
})
.WithName("SubmitNotebook");

// Hallazgos de validación de una versión (upload).
app.MapGet("/api/validations", async (int uploadId, VipDbContext db, CancellationToken ct) =>
{
    var wells = await db.Wells.AsNoTracking()
        .Where(w => w.UploadId == uploadId)
        .Include(w => w.Issues)
        .OrderByDescending(w => w.Id)
        .ToListAsync(ct);

    var report = wells.Select(w => new
    {
        well_id = w.Id,
        operadora = w.Operadora,
        nombre_pozo_sgc = w.NombrePozoSgc,
        is_valid = w.ValidationStatus != "invalid",
        error_count = w.Issues.Count(i => i.Severity == "error"),
        warning_count = w.Issues.Count(i => i.Severity == "warning"),
        uwi_fiscalizado = w.UwiFiscalizado,
        issues = w.Issues.Select(i => new { i.Field, i.Severity, i.Message, i.Rule }),
    });

    return Results.Ok(report);
})
.WithName("GetValidations");

// Descargar la plantilla del cuaderno (con selectores).
app.MapGet("/api/notebooks/template", async (int? rows, string? operadora, VipDbContext db, CancellationToken ct) =>
{
    var n = TemplateColumns.ClampRows(rows ?? TemplateColumns.DefaultRows);
    var options = await TemplateCatalogOptions.LoadAsync(db, ct);
    var bytes = NotebookTemplateBuilder.Build(n, operadora, options);
    return Results.File(
        bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        $"plantilla-inventario-pozos-{n}-registros.xlsx");
})
.WithName("DownloadTemplate");

app.Run();

/// <summary>Cuerpo para crear un cuaderno.</summary>
public sealed record CreateNotebookRequest(string? Operadora, string? Title, string? ActorEmail);

/// <summary>Punto de entrada expuesto para pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
