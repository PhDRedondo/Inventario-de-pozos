using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Ingest;
using Anh.Vip.Domain.Validation;
using Anh.Vip.Infrastructure.Excel;
using Xunit;

namespace Anh.Vip.Domain.Tests;

/// <summary>
/// Paridad de la ingesta de Excel de extremo a extremo (lectura + parseExcelRow
/// + ETL + DANE + validación) contra el pipeline del piloto. El .xlsx y la
/// verdad de referencia se generan con la implementación TS.
/// </summary>
public class WellIngestionTests
{
    private static string Path(string f) => System.IO.Path.Combine(AppContext.BaseDirectory, f);

    private static JsonElement Expected()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path("ingestion-parity.json")));
        return doc.RootElement.Clone();
    }

    private IReadOnlyList<IngestedWell> RunIngestion()
    {
        var ingestor = new WellIngestor(GeoTestData.Build(), new WellValidator(CatalogTestData.Build()));
        using var fs = File.OpenRead(Path("inventario-sample.xlsx"));
        var sheet = ExcelSheetReader.Read(fs);
        return ingestor.IngestSheet(sheet.Rows);
    }

    [Fact]
    public void IngestSheet_ExcludesListaRow_KeepsDataRows()
    {
        var expected = Expected();
        var results = RunIngestion();
        Assert.Equal(expected.GetProperty("count").GetInt32(), results.Count); // fila LISTA excluida
    }

    [Fact]
    public void IngestSheet_MatchesPilot_FieldsAndFindings()
    {
        var expectedRows = Expected().GetProperty("rows").EnumerateArray().ToList();
        var results = RunIngestion();
        Assert.Equal(expectedRows.Count, results.Count);

        for (var r = 0; r < expectedRows.Count; r++)
        {
            var exp = expectedRows[r];
            var ing = results[r];

            // Todos los atributos del pozo (parseo + ETL + DANE)
            foreach (var f in exp.GetProperty("fields").EnumerateObject())
            {
                var expectedValue = f.Value.ValueKind == JsonValueKind.Null ? null : f.Value.GetString();
                Assert.Equal(expectedValue, WellFields.Get(ing.Record, f.Name));
            }

            var expUwi = exp.GetProperty("uwi").ValueKind == JsonValueKind.Null ? null : exp.GetProperty("uwi").GetString();
            Assert.Equal(expUwi, ing.Record.UwiFiscalizado);
            Assert.Equal(exp.GetProperty("validation_status").GetString(), ing.Record.ValidationStatus);
            Assert.Equal(exp.GetProperty("error_count").GetInt32(), ing.Validation.ErrorCount);
            Assert.Equal(exp.GetProperty("warning_count").GetInt32(), ing.Validation.WarningCount);

            var expIssues = exp.GetProperty("issues").EnumerateArray().ToList();
            Assert.Equal(expIssues.Count, ing.Validation.Issues.Count);
            for (var i = 0; i < expIssues.Count; i++)
            {
                Assert.Equal(expIssues[i].GetProperty("field").GetString(), ing.Validation.Issues[i].Field);
                Assert.Equal(expIssues[i].GetProperty("severity").GetString(), ing.Validation.Issues[i].Severity);
                Assert.Equal(expIssues[i].GetProperty("rule").GetString(), ing.Validation.Issues[i].Rule);
                Assert.Equal(expIssues[i].GetProperty("message").GetString(), ing.Validation.Issues[i].Message);
            }
        }
    }
}
