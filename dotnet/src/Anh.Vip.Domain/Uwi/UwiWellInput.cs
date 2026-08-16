namespace Anh.Vip.Domain.Uwi;

/// <summary>
/// Datos mínimos del pozo necesarios para generar el UWI fiscalizado.
/// Equivale al subconjunto de <c>WellRecord</c> que consume <c>uwi.ts</c> en el piloto.
/// </summary>
public sealed record UwiWellInput
{
    public string? NombrePozoSgc { get; init; }
    public string? NombrePozoForma6cr { get; init; }
    public string? PozoAvm { get; init; }
    public string? CodigoDaneDepto { get; init; }
    public string? CodigoDaneMuni { get; init; }
    public string? TipoAngulo { get; init; }
    public string? TipoTrayectoria { get; init; }
    public string? TipoObjetivo { get; init; }
    public string? TipoTerminacion { get; init; }
    public string? LocacionCluster { get; init; }
}
