using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Etl;
using Anh.Vip.Domain.Excel;
using Anh.Vip.Domain.Geo;
using Anh.Vip.Domain.Validation;

namespace Anh.Vip.Domain.Ingest;

/// <summary>Pozo ingerido: registro normalizado con códigos DANE, UWI y su validación.</summary>
public sealed record IngestedWell(Well Record, WellValidationResult Validation);

/// <summary>
/// Ingesta de un lote de pozos desde filas de Excel — compone parseExcelRow +
/// normalizeWellRecordForIngest + resolveDaneCodes + validateWell, igual que
/// <c>saveWell</c> / <c>saveUploadBatch</c> del piloto.
/// </summary>
public sealed class WellIngestor(GeographyResolver geo, WellValidator validator)
{
    private readonly WellEtl _etl = new(geo);

    /// <summary>Procesa una fila cruda (encabezado -> valor) en un pozo validado.</summary>
    public IngestedWell IngestRow(IReadOnlyDictionary<string, string> row, int? rowNumber = null)
    {
        var parsed = ExcelColumnMap.MapRow(row);
        return Ingest(parsed, rowNumber);
    }

    /// <summary>Compone ETL + DANE + validación sobre un pozo ya parseado.</summary>
    public IngestedWell Ingest(Well parsed, int? rowNumber = null)
    {
        var etl = _etl.NormalizeForIngest(parsed);
        var withCodes = etl.Record;

        var dane = geo.ResolveDaneCodes(withCodes.Departamento, withCodes.Municipio);
        withCodes.CodigoDaneDepto = dane.CodigoDaneDepto;
        withCodes.CodigoDaneMuni = dane.CodigoDaneMuni;

        var validation = validator.Validate(withCodes, rowNumber, etl.Issues);

        withCodes.UwiFiscalizado = validation.UwiFiscalizado;
        withCodes.ValidationStatus = validation.IsValid
            ? (validation.WarningCount > 0 ? "warning" : "valid")
            : "invalid";

        return new IngestedWell(withCodes, validation);
    }

    /// <summary>
    /// Filtra y procesa las filas de una hoja: conserva las que tienen OPERADORA
    /// y no contienen «LISTA» (port del filtro del upload route).
    /// </summary>
    public IReadOnlyList<IngestedWell> IngestSheet(IEnumerable<IReadOnlyDictionary<string, string>> rows)
    {
        var result = new List<IngestedWell>();
        foreach (var row in rows)
        {
            var operadora = row.TryGetValue("OPERADORA", out var op) ? op : null;
            if (string.IsNullOrEmpty(operadora)) continue;
            if (operadora.ToUpperInvariant().Contains("LISTA")) continue;
            result.Add(IngestRow(row));
        }
        return result;
    }

    /// <summary>Resumen agregado del lote (port de <c>summarizeValidation</c>).</summary>
    public static ValidationSummary Summarize(IReadOnlyCollection<IngestedWell> wells) =>
        WellValidator.Summarize(wells.Select(w => w.Validation).ToList());
}
