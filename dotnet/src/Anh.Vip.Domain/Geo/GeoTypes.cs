namespace Anh.Vip.Domain.Geo;

/// <summary>Entrada del catálogo DANE de departamentos.</summary>
public sealed record DaneDepartamento(string Codigo, string Nombre);

/// <summary>Entrada del catálogo DANE de municipios (con su departamento).</summary>
public sealed record DaneMunicipio(string Codigo, string Nombre, string DeptCode);

/// <summary>Resultado de resolver un departamento — port de <c>GeographyResolution</c> (etl.ts).</summary>
public record GeographyResolution
{
    public string? Value { get; init; }
    public string? Original { get; init; }
    public bool EncodingRepaired { get; init; }
    public bool Canonicalized { get; init; }
    public bool Matched { get; init; }
}

/// <summary>Resultado de resolver un municipio (incluye el código de departamento).</summary>
public sealed record MunicipioResolution : GeographyResolution
{
    public string? DeptCode { get; init; }
}

/// <summary>Códigos DANE resueltos para un pozo.</summary>
public readonly record struct DaneCodes(string? CodigoDaneDepto, string? CodigoDaneMuni);
