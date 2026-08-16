using System.Text.Json;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Etl;
using Anh.Vip.Domain.Geo;
using Xunit;

namespace Anh.Vip.Domain.Tests;

/// <summary>
/// Paridad del ETL C# con el piloto (etl.ts + resolveDaneCodes). La verdad de
/// referencia proviene de ejecutar la implementación TS (Fixtures/etl-parity.json).
/// </summary>
public class WellEtlTests
{
    private readonly GeographyResolver _geo = GeoTestData.Build();
    private readonly WellEtl _etl;

    public WellEtlTests() => _etl = new WellEtl(_geo);

    private static JsonElement Expected(string key)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "etl-parity.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.GetProperty(key).Clone();
    }

    private static string? Str(JsonElement e, string prop) =>
        e.GetProperty(prop).ValueKind == JsonValueKind.Null ? null : e.GetProperty(prop).GetString();

    private void AssertParity(string key, Well input)
    {
        var expected = Expected(key);
        var result = _etl.NormalizeForIngest(input);
        var dane = _geo.ResolveDaneCodes(result.Record.Departamento, result.Record.Municipio);

        Assert.Equal(Str(expected, "departamento"), result.Record.Departamento);
        Assert.Equal(Str(expected, "municipio"), result.Record.Municipio);
        Assert.Equal(Str(expected, "codigo_dane_depto_normalize"), result.Record.CodigoDaneDepto);
        Assert.Equal(Str(expected, "operadora"), result.Record.Operadora);
        Assert.Equal(Str(expected, "dane_depto"), dane.CodigoDaneDepto);
        Assert.Equal(Str(expected, "dane_muni"), dane.CodigoDaneMuni);

        var expectedIssues = expected.GetProperty("etlIssues").EnumerateArray().ToList();
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
    public void Clean_MatchesPilot() =>
        AssertParity("clean", new Well { Departamento = "META", Municipio = "PUERTO GAITÁN" });

    [Fact]
    public void LowerCase_NormalizesWithWarnings() =>
        AssertParity("lower", new Well { Departamento = "meta", Municipio = "puerto gaitan" });

    [Fact]
    public void Unknown_ProducesGeographyErrors() =>
        AssertParity("unknown", new Well { Departamento = "NARNIA", Municipio = "CIUDAD PERDIDA" });

    [Fact]
    public void Mojibake_RepairsEncoding() =>
        AssertParity("mojibake", new Well { Departamento = "META", Municipio = "PUERTO GAITÁN", Operadora = "ECOPETROL \u00C3\u00B1" });

    [Fact]
    public void Empty_ProducesNothing() =>
        AssertParity("empty", new Well());

    [Fact]
    public void IsCanonicalDepartamento_MatchesEtl()
    {
        Assert.True(_geo.IsCanonicalDepartamento("META"));
        Assert.True(_geo.IsCanonicalDepartamento("meta"));
        Assert.True(_geo.IsCanonicalDepartamento(null));
        Assert.False(_geo.IsCanonicalDepartamento("NARNIA"));
    }
}
