using Anh.Vip.Domain.Uwi;
using Xunit;

namespace Anh.Vip.Domain.Tests;

/// <summary>
/// Paridad del generador de UWI fiscalizado con el piloto (src/lib/uwi.ts).
/// Casos de referencia del instructivo ANH (INSTRUCTIVO_EXAMPLES).
/// </summary>
public class UwiGeneratorTests
{
    // name, nombrePozoSgc, cluster, depto, muni, angulo, trayectoria, objetivo, terminacion, esperado
    [Theory]
    [InlineData("RUBIALES 323 — cluster igual al pozo",
        "RUBIALES 323", "RUBIALES 323", "50", "50568", null, null, null, null,
        "50568RUBI0323C")]
    [InlineData("MORICHE 56 — cluster solo numérico",
        "MORICHE 56", "1289", "15", "15572", null, null, null, null,
        "15572MORI00561289")]
    [InlineData("RUBIALES 502 — cluster distinto",
        "RUBIALES 502", "RUBIALES 323", "50", "50568", null, null, null, null,
        "50568RUBI0502RU0323")]
    [InlineData("LA CIRA 2",
        "LA CIRA 2", "LA CIRA 2", "68", "68081", null, null, null, null,
        "68081LACI0002C")]
    [InlineData("LA CIRA 410 / cluster LA CIRA 289",
        "LA CIRA 410", "LA CIRA 289", "68", "68081", null, null, null, null,
        "68081LACI0410LC0289")]
    [InlineData("CHICHIMENE SOUTH WEST 17",
        "CHICHIMENE SOUTH WEST 17", "CHICHIMENE SOUTH WEST 23", "50", "50006", null, null, null, null,
        "50006CHSOWE0017CSW0023")]
    [InlineData("MORICHE 320H ST3",
        "MORICHE 320H ST3", "1289", "15", "15572", "H (horizontal)", "ST (Sidetrack)", null, null,
        "15572MORI03201289HST3")]
    [InlineData("AMBAR 157H ST1 con terminación",
        "AMBAR 157H ST1", "AMBAR 116", "50", "50568", "H (horizontal)", "ST (Sidetrack)", "P (Productor)", "LR (Liner Ranurado)",
        "50568AMBA0157AM0116HST1P-LR")]
    public void Generate_MatchesInstructivo(
        string name, string sgc, string cluster, string depto, string muni,
        string? angulo, string? trayectoria, string? objetivo, string? terminacion,
        string expected)
    {
        var input = new UwiWellInput
        {
            NombrePozoSgc = sgc,
            LocacionCluster = cluster,
            CodigoDaneDepto = depto,
            CodigoDaneMuni = muni,
            TipoAngulo = angulo,
            TipoTrayectoria = trayectoria,
            TipoObjetivo = objetivo,
            TipoTerminacion = terminacion,
        };

        var uwi = UwiGenerator.Generate(input);

        Assert.Equal(expected, uwi);
        Assert.True(UwiGenerator.ValidateFormat(uwi), $"[{name}] UWI '{uwi}' no cumple el formato del instructivo.");
    }

    [Fact]
    public void Generate_ReturnsNull_WhenNameMissing()
    {
        var input = new UwiWellInput { CodigoDaneDepto = "50", CodigoDaneMuni = "50568" };
        Assert.Null(UwiGenerator.Generate(input));
    }

    [Fact]
    public void Generate_ReturnsNull_WhenDaneMissing()
    {
        var input = new UwiWellInput { NombrePozoSgc = "RUBIALES 323" };
        Assert.Null(UwiGenerator.Generate(input));
    }
}
