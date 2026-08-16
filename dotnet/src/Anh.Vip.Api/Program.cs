using System.Security.Claims;
using Anh.Vip.Api.Security;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Excel;
using Anh.Vip.Domain.Uwi;
using Anh.Vip.Infrastructure;
using Anh.Vip.Infrastructure.Excel;
using Anh.Vip.Infrastructure.Ingestion;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Persistencia: SQL Server (esquema [vip]) o EF Core InMemory para el perfil de
// desarrollo/demo (UseInMemoryDatabase=true), sin necesidad de una instancia SQL.
var useInMemory = builder.Configuration.GetValue<bool>("UseInMemoryDatabase");
if (useInMemory)
    builder.Services.AddDbContext<VipDbContext>(options => options.UseInMemoryDatabase("vip-dev"));
else
    builder.Services.AddDbContext<VipDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("VipDb")));

builder.Services.AddSingleton<CatalogCache>();
builder.Services.AddScoped<NotebookUploadService>();
builder.Services.AddScoped<NotebookSubmitService>();
builder.Services.AddScoped<Anh.Vip.Infrastructure.Stats.StatsService>();
builder.Services.AddScoped<Anh.Vip.Infrastructure.Stats.AnalyticsService>();

// --- Autenticación / autorización (GU-18 Anexo 2) ---------------------------
// Producción: JWT Bearer contra el proveedor OIDC/AD institucional.
// Desarrollo: esquema Dev que auto-autentica un usuario demo (nunca en prod).
var isDev = builder.Environment.IsDevelopment();
var auth = builder.Services.AddAuthentication(options =>
{
    var scheme = isDev ? DevAuthHandler.SchemeName : JwtBearerDefaults.AuthenticationScheme;
    options.DefaultAuthenticateScheme = scheme;
    options.DefaultChallengeScheme = scheme;
});
auth.AddJwtBearer(options =>
{
    options.Authority = builder.Configuration["Oidc:Authority"];
    options.Audience = builder.Configuration["Oidc:Audience"];
    options.RequireHttpsMetadata = !isDev;
    options.TokenValidationParameters.RoleClaimType = "roles";
    options.TokenValidationParameters.NameClaimType = "preferred_username";
});
if (isDev)
    auth.AddScheme<AuthenticationSchemeOptions, DevAuthHandler>(DevAuthHandler.SchemeName, null);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Roles.OperatorOrAdmin, p => p.RequireRole(Roles.Operadora, Roles.Admin));
    options.AddPolicy(Roles.ReadInventory, p => p.RequireRole(Roles.Operadora, Roles.Anh, Roles.Admin));
    options.AddPolicy(Roles.AnhOrAdmin, p => p.RequireRole(Roles.Anh, Roles.Admin));
});

if (isDev)
    builder.Services.AddCors(o => o.AddPolicy("dev", p =>
        p.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Endurecimiento: cabeceras de seguridad en todas las respuestas.
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers["X-XSS-Protection"] = "0";
    await next();
});

if (isDev)
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors("dev");
}
else
{
    app.UseHsts();
}

app.UseAuthentication();
app.UseAuthorization();

// Perfil de desarrollo (InMemory): sembrar los catálogos oficiales al iniciar.
if (useInMemory)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<VipDbContext>();
    var seedPath = Path.Combine(AppContext.BaseDirectory, "seed.json");
    if (File.Exists(seedPath))
        CatalogSeeder.SeedFromFile(db, seedPath);
    DemoDataSeeder.Seed(db); // inventario aplicado de ejemplo para el panel
}

// Salud básica (anónima).
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Anh.Vip.Api" }))
   .WithName("Health");

// Vista previa del UWI fiscalizado — cualquier usuario autenticado.
app.MapPost("/api/uwi/preview", (UwiWellInput input) =>
{
    var components = UwiGenerator.BuildComponents(input);
    var uwi = UwiGenerator.Generate(input);
    return Results.Ok(new { uwi, valido = UwiGenerator.ValidateFormat(uwi), componentes = components });
})
.RequireAuthorization()
.WithName("UwiPreview");

// Listar cuadernos (operadora ve los suyos; admin filtra por operadora o ve todos).
app.MapGet("/api/notebooks", async (string? operadora, ClaimsPrincipal user, VipDbContext db, CancellationToken ct) =>
{
    var scopeOperadora = user.IsAdmin() ? operadora : user.GetOperadora();

    var query = db.Notebooks.AsNoTracking().AsQueryable();
    if (!string.IsNullOrEmpty(scopeOperadora))
        query = query.Where(n => n.Operadora == scopeOperadora);
    else if (!user.IsAdmin())
        return Results.Ok(new { notebooks = Array.Empty<object>() }); // operadora sin claim -> vacío

    var notebooks = await query.OrderByDescending(n => n.UpdatedAt).ToListAsync(ct);
    var ids = notebooks.Select(n => n.Id).ToList();
    var uploads = await db.Uploads.AsNoTracking()
        .Where(u => u.NotebookId != null && ids.Contains(u.NotebookId.Value))
        .ToListAsync(ct);
    var byNotebook = uploads.GroupBy(u => u.NotebookId!.Value)
        .ToDictionary(g => g.Key, g => g.OrderByDescending(u => u.VersionNumber).ToList());

    var result = notebooks.Select(n =>
    {
        byNotebook.TryGetValue(n.Id, out var ups);
        var last = ups?.FirstOrDefault();
        return new
        {
            id = n.Id,
            operadora = n.Operadora,
            title = n.Title,
            status = n.Status,
            activeVersionId = n.ActiveVersionId,
            submittedAt = n.SubmittedAt,
            updatedAt = n.UpdatedAt,
            versionCount = ups?.Count ?? 0,
            lastUploadAt = last?.CreatedAt,
            lastFilename = last?.Filename,
        };
    });

    return Results.Ok(new { notebooks = result });
})
.RequireAuthorization(Roles.OperatorOrAdmin)
.WithName("ListNotebooks");

// Crear cuaderno (operadora | admin). La operadora se fuerza al alcance del usuario.
app.MapPost("/api/notebooks", async (CreateNotebookRequest body, ClaimsPrincipal user, VipDbContext db, CancellationToken ct) =>
{
    var operadora = user.IsAdmin() ? body.Operadora : (user.GetOperadora() ?? body.Operadora);
    if (string.IsNullOrWhiteSpace(operadora))
        return Results.BadRequest(new { error = "Seleccione una operadora" });

    var now = DateTime.UtcNow;
    var actor = user.GetEmail();
    var notebook = new Notebook
    {
        Operadora = operadora.Trim(),
        Title = body.Title?.Trim() ?? "",
        Status = "active",
        CreatedBy = actor,
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.Notebooks.Add(notebook);
    db.NotebookEvents.Add(new NotebookEvent
    {
        Notebook = notebook,
        EventType = "created",
        ActorEmail = actor,
        Message = "Cuaderno creado",
        CreatedAt = now,
    });
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/notebooks/{notebook.Id}", new { notebook.Id, notebook.Operadora, notebook.Title, notebook.Status });
})
.RequireAuthorization(Roles.OperatorOrAdmin)
.WithName("CreateNotebook");

// Cargar Excel en un cuaderno (operadora | admin).
app.MapPost("/api/notebooks/{id:int}/upload", async (
    int id, IFormFile? file, ClaimsPrincipal user, NotebookUploadService service, CancellationToken ct) =>
{
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "Debe adjuntar un archivo Excel (.xlsx)" });

    try
    {
        await using var stream = file.OpenReadStream();
        var result = await service.ProcessAsync(id, file.FileName, stream, actorEmail: user.GetEmail(), ct);
        return Results.Ok(new { upload_id = result.UploadId, version_number = result.VersionNumber, summary = result.Summary });
    }
    catch (NotebookNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
    catch (InvalidUploadException ex) { return Results.BadRequest(new { error = ex.Message }); }
})
.RequireAuthorization(Roles.OperatorOrAdmin)
.DisableAntiforgery() // Bearer (sin cookies) mitiga CSRF; reemplazar por CSRF institucional si se usan cookies.
.WithName("UploadNotebookVersion");

// Detalle del cuaderno (operadora | admin).
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
.RequireAuthorization(Roles.OperatorOrAdmin)
.WithName("GetNotebook");

// Aplicar (submit) el inventario a la ANH (operadora | admin).
app.MapPost("/api/notebooks/{id:int}/submit", async (int id, ClaimsPrincipal user, NotebookSubmitService service, CancellationToken ct) =>
{
    try
    {
        var result = await service.SubmitAsync(id, submittedBy: user.GetEmail(), ct);
        return Results.Ok(new { upload_id = result.UploadId, version_number = result.VersionNumber, message = "Inventario aplicado. La versión queda visible como enviada." });
    }
    catch (NotebookNotFoundException ex) { return Results.NotFound(new { error = ex.Message }); }
    catch (InvalidUploadException ex) { return Results.BadRequest(new { error = ex.Message }); }
})
.RequireAuthorization(Roles.OperatorOrAdmin)
.WithName("SubmitNotebook");

// Hallazgos de validación de una versión (operadora | anh | admin).
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
.RequireAuthorization(Roles.ReadInventory)
.WithName("GetValidations");

// Descargar la plantilla del cuaderno (operadora | admin).
app.MapGet("/api/notebooks/template", async (int? rows, string? operadora, VipDbContext db, CancellationToken ct) =>
{
    var n = TemplateColumns.ClampRows(rows ?? TemplateColumns.DefaultRows);
    var options = await TemplateCatalogOptions.LoadAsync(db, ct);
    var bytes = NotebookTemplateBuilder.Build(n, operadora, options);
    return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"plantilla-inventario-pozos-{n}-registros.xlsx");
})
.RequireAuthorization(Roles.OperatorOrAdmin)
.WithName("DownloadTemplate");

// Panel: KPIs y desgloses del inventario, con alcance por rol.
app.MapGet("/api/stats", async (int? limit, ClaimsPrincipal user, Anh.Vip.Infrastructure.Stats.StatsService stats, CancellationToken ct) =>
{
    var role = user.IsInRole(Roles.Admin) ? Roles.Admin
        : user.IsInRole(Roles.Anh) ? Roles.Anh
        : Roles.Operadora;
    var tableLimit = limit is 25 or 50 ? limit.Value : 10;
    var result = await stats.GetAsync(role, user.GetOperadora(), tableLimit, ct);
    return Results.Ok(result);
})
.RequireAuthorization(Roles.ReadInventory)
.WithName("GetStats");

// Puntos georreferenciados de pozos para el mapa territorial (alcance por rol).
app.MapGet("/api/wells/map", async (ClaimsPrincipal user, Anh.Vip.Infrastructure.Stats.StatsService stats, CancellationToken ct) =>
{
    var role = user.IsInRole(Roles.Admin) ? Roles.Admin : user.IsInRole(Roles.Anh) ? Roles.Anh : Roles.Operadora;
    return Results.Ok(await stats.GetMapPointsAsync(role, user.GetOperadora(), ct));
})
.RequireAuthorization(Roles.ReadInventory)
.WithName("GetWellsMap");

// Analítica comparativa (radar) — anh | admin.
app.MapGet("/api/analytics", async (string? entityType, string? entity, Anh.Vip.Infrastructure.Stats.AnalyticsService analytics, CancellationToken ct) =>
{
    var result = await analytics.GetAsync(entityType, entity, ct);
    return Results.Ok(result);
})
.RequireAuthorization(Roles.AnhOrAdmin)
.WithName("GetAnalytics");

// Sankey: flujo Departamento -> Estado -> Operadora — anh | admin.
app.MapGet("/api/analytics/sankey", async (Anh.Vip.Infrastructure.Stats.AnalyticsService analytics, CancellationToken ct) =>
    Results.Ok(await analytics.GetSankeyAsync(ct)))
.RequireAuthorization(Roles.AnhOrAdmin)
.WithName("GetSankey");

app.Run();

/// <summary>Cuerpo para crear un cuaderno.</summary>
public sealed record CreateNotebookRequest(string? Operadora, string? Title, string? ActorEmail);

/// <summary>Punto de entrada expuesto para pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
