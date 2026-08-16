namespace Anh.Vip.Domain.Uwi;

/// <summary>Hallazgo de la validación del instructivo UWI (error | warning).</summary>
public sealed record UwiValidationIssue(string Field, string Severity, string Message, string Rule);
