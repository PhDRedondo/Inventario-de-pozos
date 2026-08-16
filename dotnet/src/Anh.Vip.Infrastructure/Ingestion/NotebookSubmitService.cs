using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure.Ingestion;

/// <summary>Resultado de aplicar (submit) un cuaderno.</summary>
public sealed record SubmitResult(int UploadId, int VersionNumber);

/// <summary>
/// Aplica el inventario del cuaderno a la ANH — port de <c>submitNotebook</c>:
/// exige 0 pozos inválidos en la versión activa, marca la versión y el cuaderno
/// como <c>submitted</c> y registra el evento.
/// </summary>
public sealed class NotebookSubmitService(VipDbContext db)
{
    public async Task<SubmitResult> SubmitAsync(int notebookId, string submittedBy, CancellationToken ct = default)
    {
        var notebook = await db.Notebooks.FirstOrDefaultAsync(n => n.Id == notebookId, ct)
            ?? throw new NotebookNotFoundException(notebookId);
        if (notebook.Status != "active")
            throw new InvalidUploadException("Este cuaderno ya fue aplicado");
        if (notebook.ActiveVersionId is null)
            throw new InvalidUploadException("No hay versiones cargadas en el cuaderno");

        var upload = await db.Uploads.FirstOrDefaultAsync(u => u.Id == notebook.ActiveVersionId, ct)
            ?? throw new InvalidUploadException("Versión activa no encontrada");
        if (upload.InvalidRecords > 0)
            throw new InvalidUploadException("Corrija todos los errores antes de aplicar");

        var now = DateTime.UtcNow;
        upload.Status = "submitted";
        upload.SubmittedAt = now;
        upload.SubmittedBy = submittedBy;

        notebook.Status = "submitted";
        notebook.SubmittedVersionId = upload.Id;
        notebook.SubmittedAt = now;
        notebook.SubmittedBy = submittedBy;
        notebook.UpdatedAt = now;

        db.NotebookEvents.Add(new NotebookEvent
        {
            NotebookId = notebookId,
            EventType = "submit",
            UploadId = upload.Id,
            ActorEmail = submittedBy,
            Message = $"Inventario aplicado — versión {upload.VersionNumber}",
            MetadataJson = JsonSerializer.Serialize(new
            {
                version_number = upload.VersionNumber,
                total_records = upload.TotalRecords,
                valid_records = upload.ValidRecords,
            }),
            CreatedAt = now,
        });

        await db.SaveChangesAsync(ct);
        // TODO: generar el Excel y enviar el correo institucional (fase de correo/SMTP).

        return new SubmitResult(upload.Id, upload.VersionNumber);
    }
}
