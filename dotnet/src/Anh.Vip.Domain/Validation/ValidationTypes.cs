namespace Anh.Vip.Domain.Validation;

/// <summary>Hallazgo de validación de un pozo (error | warning | info).</summary>
public sealed record ValidationIssue(string Field, string Severity, string Message, string Rule);

/// <summary>Resultado de validar un pozo — port de <c>ValidationResult</c> (validation.ts).</summary>
public sealed record WellValidationResult
{
    public int? WellId { get; init; }
    public int? RowNumber { get; init; }
    public string? Operadora { get; init; }
    public string? NombrePozoSgc { get; init; }
    public bool IsValid { get; init; }
    public int ErrorCount { get; init; }
    public int WarningCount { get; init; }
    public IReadOnlyList<ValidationIssue> Issues { get; init; } = Array.Empty<ValidationIssue>();
    public string? UwiFiscalizado { get; init; }
}

/// <summary>Resumen agregado de un lote — port de <c>summarizeValidation</c>.</summary>
public sealed record ValidationSummary
{
    public int Total { get; init; }
    public int Valid { get; init; }
    public int WithWarnings { get; init; }
    public int Invalid { get; init; }
    public int ErrorTotal { get; init; }
    public int WarningTotal { get; init; }
}
