using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Excel;
using Anh.Vip.Domain.Ingest;
using Anh.Vip.Domain.Validation;
using Anh.Vip.Infrastructure.Excel;
using Microsoft.EntityFrameworkCore;
using ValidationIssueEntity = Anh.Vip.Domain.Entities.ValidationIssue;

namespace Anh.Vip.Infrastructure.Ingestion;

/// <summary>El cuaderno no existe.</summary>
public sealed class NotebookNotFoundException(int id) : Exception($"Cuaderno {id} no encontrado");

/// <summary>La carga no es válida (cuaderno inactivo, sin registros, etc.).</summary>
public sealed class InvalidUploadException(string message) : Exception(message);

/// <summary>Resultado de procesar una carga.</summary>
public sealed record UploadResult(int UploadId, int VersionNumber, ValidationSummary Summary);

/// <summary>
/// Procesa la carga de un Excel en un cuaderno: lee la hoja, ingiere (parseo +
/// ETL + DANE + validación) y persiste el lote (upload, wells, issues, evento),
/// igual que <c>addNotebookVersion</c> / <c>saveUploadBatch</c> del piloto.
/// </summary>
public sealed class NotebookUploadService(VipDbContext db, CatalogCache cache)
{
    public async Task<UploadResult> ProcessAsync(
        int notebookId, string filename, Stream file, string actorEmail, CancellationToken ct = default)
    {
        var notebook = await db.Notebooks.FirstOrDefaultAsync(n => n.Id == notebookId, ct)
            ?? throw new NotebookNotFoundException(notebookId);
        if (notebook.Status != "active")
            throw new InvalidUploadException("Este cuaderno ya fue aplicado o archivado");

        var operadora = notebook.Operadora;
        var (catalogs, geo) = await cache.GetAsync(ct);
        var ingestor = new WellIngestor(geo, new WellValidator(catalogs));

        var sheet = ExcelSheetReader.Read(file);
        var dataRows = sheet.Rows.Where(r =>
        {
            var op = r.TryGetValue("OPERADORA", out var v) ? v : null;
            return !string.IsNullOrEmpty(op) && !op.ToUpperInvariant().Contains("LISTA");
        }).ToList();

        if (dataRows.Count == 0)
            throw new InvalidUploadException("No se encontraron registros válidos en la hoja de inventario.");

        var maxVersion = await db.Uploads
            .Where(u => u.NotebookId == notebookId)
            .Select(u => (int?)u.VersionNumber)
            .MaxAsync(ct) ?? 0;
        var versionNumber = maxVersion + 1;

        var now = DateTime.UtcNow;
        var upload = new Upload
        {
            Filename = filename,
            Operadora = operadora,
            NotebookId = notebookId,
            VersionNumber = versionNumber,
            Status = "draft",
            CreatedAt = now,
        };

        int valid = 0, invalid = 0, warnings = 0, errorIssues = 0, warningIssues = 0, infoIssues = 0;
        var validations = new List<WellValidationResult>();
        var rowNumber = 0;

        foreach (var row in dataRows)
        {
            rowNumber++;
            var parsed = ExcelColumnMap.MapRow(row);
            parsed.Operadora = operadora; // el piloto fuerza la operadora del cuaderno
            var ing = ingestor.Ingest(parsed, rowNumber);
            validations.Add(ing.Validation);

            var well = ing.Record;
            well.Issues = new List<ValidationIssueEntity>();
            well.Upload = upload;
            upload.Wells.Add(well);
            foreach (var i in ing.Validation.Issues)
                well.Issues.Add(new ValidationIssueEntity { Field = i.Field, Severity = i.Severity, Message = i.Message, Rule = i.Rule, Well = well });

            if (!ing.Validation.IsValid) invalid++;
            else if (ing.Validation.WarningCount > 0) warnings++;
            else valid++;

            foreach (var i in ing.Validation.Issues)
            {
                if (i.Severity == "error") errorIssues++;
                else if (i.Severity == "warning") warningIssues++;
                else if (i.Severity == "info") infoIssues++;
            }
        }

        upload.TotalRecords = dataRows.Count;
        upload.ValidRecords = valid;
        upload.InvalidRecords = invalid;
        upload.WarningRecords = warnings;
        upload.ErrorIssues = errorIssues;
        upload.WarningIssues = warningIssues;
        upload.InfoIssues = infoIssues;

        db.Uploads.Add(upload);

        var useTx = db.Database.IsRelational();
        var tx = useTx ? await db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            await db.SaveChangesAsync(ct); // asigna upload.Id, wells y issues

            notebook.ActiveVersionId = upload.Id;
            notebook.UpdatedAt = now;

            db.NotebookEvents.Add(new NotebookEvent
            {
                NotebookId = notebookId,
                EventType = "upload",
                UploadId = upload.Id,
                ActorEmail = actorEmail,
                Message = $"Versión {versionNumber}: {filename}",
                MetadataJson = JsonSerializer.Serialize(new
                {
                    version_number = versionNumber,
                    filename,
                    total_records = upload.TotalRecords,
                    valid_records = valid,
                    invalid_records = invalid,
                    warning_count = warnings,
                    error_issues = errorIssues,
                    warning_issues = warningIssues,
                    info_issues = infoIssues,
                }),
                CreatedAt = now,
            });
            await db.SaveChangesAsync(ct);

            if (tx is not null) await tx.CommitAsync(ct);
        }
        catch
        {
            if (tx is not null) await tx.RollbackAsync(ct);
            throw;
        }
        finally
        {
            if (tx is not null) await tx.DisposeAsync();
        }

        return new UploadResult(upload.Id, versionNumber, WellValidator.Summarize(validations));
    }
}
