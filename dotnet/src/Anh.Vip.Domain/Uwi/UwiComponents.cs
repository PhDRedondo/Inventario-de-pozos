namespace Anh.Vip.Domain.Uwi;

/// <summary>Componentes del UWI fiscalizado según el instructivo ANH (abril 2026).</summary>
public sealed record UwiComponents
{
    public required string Departamento { get; init; }
    public required string Municipio { get; init; }
    public required string Sigla { get; init; }
    public required string Numero { get; init; }
    public required string Cluster { get; init; }
    public required string Angulo { get; init; }
    public required string Trayectoria { get; init; }
    public required string Objetivo { get; init; }
    public required string Terminacion { get; init; }
}
