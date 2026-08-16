using System.Globalization;
using System.Text.RegularExpressions;
using Anh.Vip.Domain.Attributes;
using Anh.Vip.Domain.Catalogs;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Uwi;

namespace Anh.Vip.Domain.Validation;

/// <summary>
/// Motor de validación por pozo — port fiel de <c>validateWell</c> (validation.ts).
/// Depende de <see cref="ICatalogProvider"/> para los catálogos y del generador UWI.
/// </summary>
public sealed class WellValidator(ICatalogProvider catalogs)
{
    private static readonly Regex CoordinateRegex = new(@"^-?\d+(\.\d+)?$", RegexOptions.Compiled);

    private static readonly (string Key, string Label)[] RequiredFields =
    {
        ("pozo_existente_avm", "¿Pozo existente en AVM ANH?"),
        ("operadora", "Operadora"),
        ("contrato", "Contrato según AVM ANH"),
        ("campo_avm", "Campo AVM"),
        ("nombre_pozo_sgc", "Nombre pozo (SGC)"),
        ("estado_pozo", "Estado del pozo"),
        ("departamento", "Departamento"),
        ("municipio", "Municipio"),
    };

    private static readonly (string Key, string Catalog, string Label)[] SelectChecks =
    {
        ("pozo_existente_avm", "pozo_existente_avm", "¿Pozo existente en AVM ANH?"),
        ("operadora", "operadoras", "Operadora"),
        ("contrato", "contratos", "Contrato según AVM ANH"),
        ("campo_avm", "campos_avm", "Campo AVM"),
        ("formacion_ruty", "formaciones_ruty", "Formación RUTY"),
        ("yacimiento_ruty", "yacimientos_ruty", "Yacimiento RUTY"),
        ("tipo_angulo", "tipo_angulo", "Tipo de pozo por ángulo"),
        ("tipo_trayectoria", "tipo_trayectoria", "Tipo de pozo por trayectoria"),
        ("tipo_objetivo", "tipo_objetivo", "Tipo de pozo por objetivo"),
        ("tipo_terminacion", "tipo_terminacion", "Tipo de terminación"),
        ("sistema_levantamiento", "sistema_levantamiento", "Sistema de levantamiento"),
        ("estado_pozo", "estado_pozo", "Estado del pozo"),
        ("departamento", "departamentos", "Departamento"),
    };

    private static readonly (string Key, string Label)[] NumericFields =
    {
        ("prod_dias", "Días acumulados (producción)"),
        ("prod_petroleo", "Petróleo acumulado"),
        ("prod_agua", "Agua acumulada (producción)"),
        ("prod_gas", "Gas acumulado (producción)"),
        ("iny_dias", "Días acumulados (inyección)"),
        ("iny_agua", "Agua acumulada (inyección)"),
        ("iny_gas", "Gas acumulado (inyección)"),
        ("iny_otros", "Otros acumulado"),
    };

    public WellValidationResult Validate(Well record, int? rowNumber = null, IEnumerable<ValidationIssue>? extraIssues = null)
    {
        var issues = new List<ValidationIssue>(extraIssues ?? Array.Empty<ValidationIssue>());

        // Obligatorios
        foreach (var (key, label) in RequiredFields)
        {
            if (string.IsNullOrWhiteSpace(Field(record, key)))
                issues.Add(new ValidationIssue(key, "error", $"El atributo \"{label}\" es obligatorio.", "required"));
        }

        // Catálogos
        foreach (var (key, catalog, label) in SelectChecks)
        {
            var value = Field(record, key);
            if (string.IsNullOrEmpty(value)) continue;

            if (catalog == "departamentos")
            {
                if (!catalogs.IsCanonicalDepartamento(value))
                    issues.Add(new ValidationIssue(key, "error",
                        $"El valor \"{value}\" no está en la lista oficial de departamentos (DANE).", "catalog"));
                continue;
            }

            if (!catalogs.IsInList(catalog, value))
                issues.Add(new ValidationIssue(key, "error",
                    $"El valor \"{value}\" no está en la lista permitida para \"{label}\".", "catalog"));
        }

        // Condicionales AVM
        if (RequiresAvmFields(record))
        {
            foreach (var key in new[] { "pozo_avm", "formacion_avm", "pozo_formacion_avm" })
            {
                if (string.IsNullOrEmpty(Field(record, key)))
                    issues.Add(new ValidationIssue(key, "warning",
                        $"Para registros de mantenimiento o modificación se recomienda diligenciar el atributo \"{AttributeLabels.Get(key)}\".",
                        "conditional_required"));
            }
        }

        if (RequiresLevantamiento(record) && string.IsNullOrEmpty(record.SistemaLevantamiento))
            issues.Add(new ValidationIssue("sistema_levantamiento", "warning",
                "Los pozos productores deben reportar el sistema de levantamiento.", "conditional_required"));

        // Numéricos
        foreach (var (key, label) in NumericFields)
        {
            if (!IsNumeric(Field(record, key)))
                issues.Add(new ValidationIssue(key, "error", $"\"{label}\" debe ser numérico.", "numeric"));
        }

        // Coordenadas planas
        foreach (var key in new[] { "coord_bogota_x", "coord_bogota_y", "coord_nacional_x", "coord_nacional_y" })
        {
            if (!IsCoordinate(Field(record, key)))
                issues.Add(new ValidationIssue(key, "error",
                    $"El atributo \"{AttributeLabels.Get(key)}\" no tiene formato numérico válido.", "coordinate"));
        }

        if (!IsLatLong(record.Longitud))
            issues.Add(new ValidationIssue("longitud", "error", "La longitud debe estar entre -180 y 180 grados.", "coordinate"));

        if (!IsLatLong(record.Latitud))
            issues.Add(new ValidationIssue("latitud", "error", "La latitud debe estar entre -90 y 90 grados.", "coordinate"));

        // UWI fiscalizado + instructivo
        var uwiInput = record.ToUwiInput();
        var uwiFiscalizado = UwiGenerator.Generate(uwiInput);
        var uwiIssues = UwiGenerator.ValidateInstructivo(uwiInput);

        foreach (var i in uwiIssues)
            issues.Add(new ValidationIssue(i.Field, i.Severity, i.Message, i.Rule));

        if (uwiFiscalizado is null && uwiIssues.Count == 0)
            issues.Add(new ValidationIssue("uwi_fiscalizado", "warning",
                "No fue posible generar el UWI fiscalizado. Verifique códigos DANE, nombre del pozo y clasificación técnica.",
                "uwi_generation"));

        if (!string.IsNullOrEmpty(record.UwiSgc) && uwiFiscalizado is not null && record.UwiSgc != uwiFiscalizado)
            issues.Add(new ValidationIssue("uwi_sgc", "info",
                $"El UWI SGC ({record.UwiSgc}) difiere del UWI fiscalizado generado ({uwiFiscalizado}).", "uwi_consistency"));

        var errorCount = issues.Count(i => i.Severity == "error");
        var warningCount = issues.Count(i => i.Severity == "warning");

        return new WellValidationResult
        {
            WellId = record.Id,
            RowNumber = rowNumber,
            Operadora = record.Operadora,
            NombrePozoSgc = record.NombrePozoSgc,
            IsValid = errorCount == 0,
            ErrorCount = errorCount,
            WarningCount = warningCount,
            Issues = issues,
            UwiFiscalizado = uwiFiscalizado,
        };
    }

    public static ValidationSummary Summarize(IReadOnlyCollection<WellValidationResult> results) => new()
    {
        Total = results.Count,
        Valid = results.Count(r => r.IsValid && r.WarningCount == 0),
        WithWarnings = results.Count(r => r.IsValid && r.WarningCount > 0),
        Invalid = results.Count(r => !r.IsValid),
        ErrorTotal = results.Sum(r => r.ErrorCount),
        WarningTotal = results.Sum(r => r.WarningCount),
    };

    /// <summary>Reglas activas en validateWell más el instructivo UWI (paridad con getActiveValidationRuleCount).</summary>
    public static int GetActiveValidationRuleCount() =>
        8 + 13 + 3 + 1 + 8 + 4 + 2 + 1 + 1 + 18;

    // ---- Helpers -------------------------------------------------------------

    private static bool RequiresLevantamiento(Well r) =>
        (r.TipoObjetivo ?? "").ToUpperInvariant().StartsWith("P", StringComparison.Ordinal);

    private static bool RequiresAvmFields(Well r)
    {
        var flag = (r.PozoExistenteAvm ?? "").ToUpperInvariant();
        return flag.Contains("MANTIENE") || flag.Contains("MODIFIC");
    }

    private static bool IsNumeric(string? value)
    {
        if (string.IsNullOrEmpty(value)) return true;
        var s = value.Replace(",", "").Trim();
        if (s.Length == 0) return true; // Number("") === 0
        return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out _);
    }

    private static bool IsCoordinate(string? value)
    {
        if (string.IsNullOrEmpty(value)) return true;
        return CoordinateRegex.IsMatch(value.Replace(",", "").Trim());
    }

    private static bool IsLatLong(string? value)
    {
        if (string.IsNullOrEmpty(value)) return true;
        var s = value.Replace(",", "").Trim();
        if (s.Length == 0) return true; // Number("  ") === 0
        if (!double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var num)) return false;
        return Math.Abs(num) <= 180;
    }

    /// <summary>Acceso por clave snake_case a los atributos que valida el motor.</summary>
    private static string? Field(Well r, string key) => key switch
    {
        "pozo_existente_avm" => r.PozoExistenteAvm,
        "operadora" => r.Operadora,
        "contrato" => r.Contrato,
        "campo_avm" => r.CampoAvm,
        "pozo_formacion_avm" => r.PozoFormacionAvm,
        "pozo_avm" => r.PozoAvm,
        "formacion_avm" => r.FormacionAvm,
        "formacion_ruty" => r.FormacionRuty,
        "yacimiento_ruty" => r.YacimientoRuty,
        "tipo_angulo" => r.TipoAngulo,
        "tipo_trayectoria" => r.TipoTrayectoria,
        "tipo_objetivo" => r.TipoObjetivo,
        "tipo_terminacion" => r.TipoTerminacion,
        "sistema_levantamiento" => r.SistemaLevantamiento,
        "nombre_pozo_sgc" => r.NombrePozoSgc,
        "estado_pozo" => r.EstadoPozo,
        "departamento" => r.Departamento,
        "municipio" => r.Municipio,
        "prod_dias" => r.ProdDias,
        "prod_petroleo" => r.ProdPetroleo,
        "prod_agua" => r.ProdAgua,
        "prod_gas" => r.ProdGas,
        "iny_dias" => r.InyDias,
        "iny_agua" => r.InyAgua,
        "iny_gas" => r.InyGas,
        "iny_otros" => r.InyOtros,
        "coord_bogota_x" => r.CoordBogotaX,
        "coord_bogota_y" => r.CoordBogotaY,
        "coord_nacional_x" => r.CoordNacionalX,
        "coord_nacional_y" => r.CoordNacionalY,
        _ => null,
    };
}
