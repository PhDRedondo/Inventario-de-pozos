using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Validation;
using Xunit;

namespace Anh.Vip.Domain.Tests;

/// <summary>
/// Paridad del motor de validación C# con el piloto (validation.ts). Los
/// hallazgos esperados provienen de ejecutar <c>validateWell</c> sobre los
/// mismos registros (Fixtures/validation-parity.json).
/// </summary>
public class WellValidatorTests
{
    private readonly WellValidator _validator = new(CatalogTestData.Build());

    private static JsonElement Expected(string key)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "validation-parity.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        // Clonar para poder usar tras liberar el documento.
        return doc.RootElement.GetProperty(key).Clone();
    }

    private void AssertParity(string key, Well record)
    {
        var expected = Expected(key);
        var result = _validator.Validate(record);

        Assert.Equal(expected.GetProperty("uwi").ValueKind == JsonValueKind.Null ? null : expected.GetProperty("uwi").GetString(),
            result.UwiFiscalizado);
        Assert.Equal(expected.GetProperty("error_count").GetInt32(), result.ErrorCount);
        Assert.Equal(expected.GetProperty("warning_count").GetInt32(), result.WarningCount);

        var expectedIssues = expected.GetProperty("issues").EnumerateArray().ToList();
        Assert.Equal(expectedIssues.Count, result.Issues.Count);

        for (var i = 0; i < expectedIssues.Count; i++)
        {
            var e = expectedIssues[i];
            var a = result.Issues[i];
            Assert.Equal(e.GetProperty("field").GetString(), a.Field);
            Assert.Equal(e.GetProperty("severity").GetString(), a.Severity);
            Assert.Equal(e.GetProperty("rule").GetString(), a.Rule);
            Assert.Equal(e.GetProperty("message").GetString(), a.Message);
        }
    }

    [Fact]
    public void EmptyWell_MatchesPilot() => AssertParity("empty", new Well());

    [Fact]
    public void AmbarWell_MatchesPilot() => AssertParity("ambar", new Well
    {
        NombrePozoSgc = "AMBAR 157H ST1",
        LocacionCluster = "AMBAR 116",
        CodigoDaneDepto = "50",
        CodigoDaneMuni = "50568",
        TipoAngulo = "H (horizontal)",
        TipoTrayectoria = "ST (Sidetrack)",
        TipoObjetivo = "P (Productor)",
        TipoTerminacion = "LR (Liner Ranurado)",
        UwiSgc = "DIFERENTE-123",
    });

    [Fact]
    public void BadCatalogWell_MatchesPilot() => AssertParity("badcat", new Well
    {
        Operadora = "OPERADORA QUE NO EXISTE SA",
        Departamento = "NARNIA",
        ProdPetroleo = "no-es-numero",
        CoordBogotaX = "abc",
    });

    [Fact]
    public void ActiveRuleCount_Is59() => Assert.Equal(59, WellValidator.GetActiveValidationRuleCount());

    [Fact]
    public void Summarize_CountsBuckets()
    {
        var results = new[]
        {
            _validator.Validate(new Well()),                                  // inválido
            _validator.Validate(new Well
            {
                NombrePozoSgc = "AMBAR 157H ST1", LocacionCluster = "AMBAR 116",
                CodigoDaneDepto = "50", CodigoDaneMuni = "50568",
                TipoAngulo = "H (horizontal)", TipoTrayectoria = "ST (Sidetrack)",
                TipoObjetivo = "P (Productor)", TipoTerminacion = "LR (Liner Ranurado)",
                UwiSgc = "DIFERENTE-123",
            }),                                                               // inválido (faltan obligatorios)
        };

        var summary = WellValidator.Summarize(results);
        Assert.Equal(2, summary.Total);
        Assert.Equal(2, summary.Invalid);
        Assert.Equal(0, summary.Valid);
    }
}
