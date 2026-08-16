using Anh.Vip.Domain.Uwi;
using Anh.Vip.Infrastructure;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// EF Core + SQL Server (esquema [vip]). La cadena vive en appsettings/entorno.
builder.Services.AddDbContext<VipDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("VipDb")));

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

// Vista previa del UWI fiscalizado — equivalente a POST /api/uwi/preview del piloto.
// No requiere base de datos: solo la lógica de dominio.
app.MapPost("/api/uwi/preview", (UwiWellInput input) =>
{
    var components = UwiGenerator.BuildComponents(input);
    var uwi = UwiGenerator.Generate(input);
    return Results.Ok(new
    {
        uwi,
        valido = UwiGenerator.ValidateFormat(uwi),
        componentes = components,
    });
})
.WithName("UwiPreview");

app.Run();
