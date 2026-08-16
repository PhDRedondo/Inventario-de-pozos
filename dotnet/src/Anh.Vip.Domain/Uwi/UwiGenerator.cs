using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Anh.Vip.Domain.Uwi;

/// <summary>
/// Generación del UWI fiscalizado — port fiel de <c>src/lib/uwi.ts</c> (instructivo ANH, abril 2026).
///
/// Los métodos replican la semántica de JavaScript usada en el piloto:
///   - <c>slice(0, n)</c>  -> <see cref="SliceStart"/>
///   - <c>slice(-n)</c>    -> <see cref="TakeLast"/>
///   - <c>padStart(n,'0').slice(-n)</c> -> <see cref="PadTake"/>
/// La paridad con el piloto se verifica en Anh.Vip.Domain.Tests (casos del instructivo).
/// </summary>
public static class UwiGenerator
{
    private static readonly string[] AngleCodes = { "H", "V", "D" };
    private static readonly string[] TrajectoryCodes = { "ST", "PR", "ML", "P", "G", "O" };
    private static readonly string[] ObjectiveCodes = { "EST", "P", "I", "M", "D" };
    private static readonly string[] TerminationCodes = { "CD", "LC", "LR", "GP", "CC", "OH", "O" };

    // Marcas diacríticas combinantes U+0300–U+036F (equivale a /[\u0300-\u036f]/ de uwi.ts).
    private static readonly Regex CombiningMarks = new(@"[\u0300-\u036F]", RegexOptions.Compiled);
    private static readonly Regex NonAllowed = new(@"[^A-Z0-9\s-]", RegexOptions.Compiled);
    private static readonly Regex MultiSpace = new(@"\s+", RegexOptions.Compiled);
    private static readonly Regex HasLetter = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex NonLetter = new("[^A-Z]", RegexOptions.Compiled);
    private static readonly Regex Digits = new("[0-9]+", RegexOptions.Compiled);
    private static readonly Regex ParenCode = new(@"\(([A-Z]+)\)", RegexOptions.Compiled);
    private static readonly Regex StBoundaryNum = new(@"\bST([0-9]+)\b", RegexOptions.Compiled);
    private static readonly Regex UwiFormat = new(
        @"^\d{5}[A-Z]{4,}\d{4}[A-Z0-9]{1,7}[HVD]?(ST\d+|PR|ML|P|G|O)?(EST|P|I|M|D)?(-(CD|LC|LR|GP|CC|OH|O))?$",
        RegexOptions.Compiled);

    // ---- Helpers de cadena con semántica JavaScript --------------------------

    private static string SliceStart(string s, int end) => s.Length <= end ? s : s[..end];

    private static string TakeLast(string s, int n) => s.Length <= n ? s : s[^n..];

    private static string PadTake(string s, int n) => TakeLast(s.PadLeft(n, '0'), n);

    private static string DigitsOnly(string? s) => s is null ? "" : Regex.Replace(s, @"\D", "");

    // ---- Normalización -------------------------------------------------------

    private static string NormalizeText(string value)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var noMarks = CombiningMarks.Replace(decomposed, "");
        var upper = noMarks.ToUpperInvariant();
        var cleaned = NonAllowed.Replace(upper, " ");
        return MultiSpace.Replace(cleaned, " ").Trim();
    }

    private static List<string> WordsFrom(string text) =>
        text.Split(' ').Where(w => HasLetter.IsMatch(w)).ToList();

    private static List<string> NumbersFrom(string text) =>
        Digits.Matches(text).Select(m => m.Value).ToList();

    private static string ExtractCode(string? value, string[] codes)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var normalized = NormalizeText(value);
        var paren = ParenCode.Match(normalized);
        if (paren.Success)
        {
            var hit = codes.FirstOrDefault(c => c == paren.Groups[1].Value);
            if (hit is not null) return hit;
        }
        foreach (var code in codes)
        {
            if (normalized.StartsWith(code + " ", StringComparison.Ordinal) ||
                normalized.StartsWith(code, StringComparison.Ordinal))
                return code;
        }
        return "";
    }

    private static string StripTechnicalSuffixes(string nombre)
    {
        var norm = NormalizeText(nombre);
        norm = Regex.Replace(norm, @"\s*ST\d+\s*$", "", RegexOptions.IgnoreCase);
        norm = Regex.Replace(norm, @"\s*\d+[HVD]\b\s*$", "", RegexOptions.IgnoreCase);
        norm = Regex.Replace(norm, @"\s+\d+\s*$", "", RegexOptions.IgnoreCase);
        norm = Regex.Replace(norm, @"[HVD]$", "", RegexOptions.IgnoreCase);
        return norm.Trim();
    }

    private static string ExtractTrajectory(string? value, string wellName)
    {
        var fromName = NormalizeText(wellName);
        var nameSt = StBoundaryNum.Match(fromName);
        if (nameSt.Success) return "ST" + nameSt.Groups[1].Value;

        var fromField = NormalizeText(value ?? "");
        var fieldSt = Regex.Match(fromField, @"\bST\b.*?(\d+)");
        if (!fieldSt.Success) fieldSt = StBoundaryNum.Match(fromField);
        if (fieldSt.Success) return "ST" + (fieldSt.Groups.Count > 1 ? fieldSt.Groups[1].Value : "");

        var fromFieldCode = ExtractCode(value, TrajectoryCodes);
        if (fromFieldCode.Length > 0 && fromFieldCode != "ST") return fromFieldCode;
        if (fromField.Contains("ST")) return "ST";

        return "";
    }

    private static string ExtractAngle(string? value, string wellName)
    {
        var fromField = ExtractCode(value, AngleCodes);
        if (fromField.Length > 0) return fromField;

        var norm = NormalizeText(wellName);
        if (Regex.IsMatch(norm, @"\bHZ\b|\d+H\b|H\s*ST|-H\b")) return "H";
        if (Regex.IsMatch(norm, @"\bV\b") && !norm.Contains("VEN")) return "V";
        if (Regex.IsMatch(norm, @"\bD\b") && !norm.Contains("DE")) return "D";
        return "";
    }

    // ---- Componentes públicos ------------------------------------------------

    /// <summary>Sigla del nombre del pozo (instructivo ANH abril 2026).</summary>
    public static string BuildWellSigla(string nombrePozo, bool esEstratigrafico = false)
    {
        var baseText = StripTechnicalSuffixes(nombrePozo);
        var words = WordsFrom(baseText);

        string sigla;
        if (words.Count <= 1)
        {
            var w = words.Count >= 1 ? words[0] : baseText;
            sigla = SliceStart(NonLetter.Replace(w, ""), 4);
        }
        else
        {
            sigla = string.Concat(words.Select(word => SliceStart(NonLetter.Replace(word, ""), 2)));
        }

        return esEstratigrafico ? "ANH" + sigla : sigla;
    }

    /// <summary>Número del pozo — máx. 4 dígitos con ceros a la izquierda.</summary>
    public static string ExtractWellNumber(string nombrePozo)
    {
        var norm = NormalizeText(nombrePozo);
        norm = StBoundaryNum.Replace(norm, " ");
        var numbers = NumbersFrom(norm);
        if (numbers.Count == 0) return "0000";
        var main = numbers.Count > 1 ? numbers[^2] : numbers[^1];
        var picked = numbers.FirstOrDefault(n => n.Length >= 2) ?? main;
        return PadTake(picked, 4);
    }

    /// <summary>Locación-clúster (instructivo ANH).</summary>
    public static string BuildClusterCode(string? clusterName, string wellName)
    {
        var cluster = NormalizeText(clusterName ?? "");
        var well = NormalizeText(wellName);

        if (cluster.Length == 0 || cluster == well) return "C";

        var clusterWords = WordsFrom(cluster);
        var clusterNumbers = NumbersFrom(cluster);

        if (clusterWords.Count == 0 && clusterNumbers.Count > 0)
            return PadTake(clusterNumbers[^1], 4);

        var alpha = "";
        if (clusterWords.Count >= 3)
            alpha = string.Concat(clusterWords.Select(w => w[0]));
        else if (clusterWords.Count == 2)
            alpha = $"{clusterWords[0][0]}{clusterWords[1][0]}";
        else if (clusterWords.Count == 1)
            alpha = SliceStart(clusterWords[0], 2);

        var num = clusterNumbers.Count > 0 ? PadTake(clusterNumbers[^1], 4) : "";

        if (alpha.Length > 0 && num.Length > 0) return alpha + num;
        if (alpha.Length > 0) return alpha;
        if (num.Length > 0) return num;
        return "C";
    }

    /// <summary>Construye los componentes del UWI o <c>null</c> si faltan datos mínimos.</summary>
    public static UwiComponents? BuildComponents(UwiWellInput record)
    {
        var nombre = record.NombrePozoSgc ?? record.NombrePozoForma6cr ?? record.PozoAvm;
        if (string.IsNullOrEmpty(nombre)) return null;

        var departamento = PadTake(DigitsOnly(record.CodigoDaneDepto), 2);
        var municipioDigits = DigitsOnly(record.CodigoDaneMuni).PadLeft(5, '0');
        var municipio = TakeLast(municipioDigits, 3);

        if (departamento.Length == 0 || departamento == "00" ||
            municipio.Length == 0 || municipio == "000")
            return null;

        var esEstratigrafico =
            (record.TipoObjetivo ?? "").ToUpperInvariant().Contains("EST") ||
            NormalizeText(nombre).Contains("ANH ");

        return new UwiComponents
        {
            Departamento = departamento,
            Municipio = municipio,
            Sigla = BuildWellSigla(nombre, esEstratigrafico),
            Numero = ExtractWellNumber(nombre),
            Cluster = BuildClusterCode(record.LocacionCluster, nombre),
            Angulo = ExtractAngle(record.TipoAngulo, nombre),
            Trayectoria = ExtractTrajectory(record.TipoTrayectoria, nombre),
            Objetivo = ExtractCode(record.TipoObjetivo, ObjectiveCodes),
            Terminacion = ExtractCode(record.TipoTerminacion, TerminationCodes),
        };
    }

    /// <summary>Ensambla el UWI a partir de sus componentes.</summary>
    public static string Assemble(UwiComponents c, bool includeTerminacion = true)
    {
        var core = $"{c.Departamento}{c.Municipio}{c.Sigla}{c.Numero}{c.Cluster}{c.Angulo}{c.Trayectoria}{c.Objetivo}";
        if (includeTerminacion && c.Terminacion.Length > 0)
            return $"{core}-{c.Terminacion}";
        return core;
    }

    /// <summary>Genera el UWI fiscalizado o <c>null</c> si faltan datos mínimos.</summary>
    public static string? Generate(UwiWellInput record)
    {
        var components = BuildComponents(record);
        if (components is null) return null;
        return Assemble(components, components.Terminacion.Length > 0);
    }

    /// <summary>Valida que un UWI cumpla la estructura del instructivo.</summary>
    public static bool ValidateFormat(string? uwi) =>
        !string.IsNullOrEmpty(uwi) && UwiFormat.IsMatch(uwi);

    /// <summary>
    /// Valida el cumplimiento del instructivo UWI (abril 2026) — port de
    /// <c>validateUwiInstructivo</c> de uwi.ts.
    /// </summary>
    public static List<UwiValidationIssue> ValidateInstructivo(UwiWellInput record)
    {
        var issues = new List<UwiValidationIssue>();
        var nombre = record.NombrePozoSgc ?? record.NombrePozoForma6cr ?? record.PozoAvm;
        var components = BuildComponents(record);

        if (string.IsNullOrEmpty(nombre))
        {
            issues.Add(new UwiValidationIssue("nombre_pozo_sgc", "error",
                "Se requiere el nombre del pozo para generar el UWI fiscalizado.", "uwi_nombre"));
            return issues;
        }

        if (string.IsNullOrEmpty(record.CodigoDaneDepto) || string.IsNullOrEmpty(record.CodigoDaneMuni))
        {
            issues.Add(new UwiValidationIssue("codigo_dane_muni", "error",
                "Código DANE departamental (2 dígitos) y municipal (3 dígitos) son obligatorios.", "uwi_dane"));
        }
        else if (components is not null)
        {
            if (!Regex.IsMatch(components.Departamento, @"^\d{2}$"))
                issues.Add(new UwiValidationIssue("codigo_dane_depto", "error",
                    $"Código departamental inválido: \"{components.Departamento}\". Debe tener 2 dígitos.", "uwi_dane_depto"));
            if (!Regex.IsMatch(components.Municipio, @"^\d{3}$"))
                issues.Add(new UwiValidationIssue("codigo_dane_muni", "error",
                    $"Código municipal inválido: \"{components.Municipio}\". Debe tener 3 dígitos.", "uwi_dane_muni"));
        }

        if (string.IsNullOrEmpty(record.TipoAngulo) && ExtractAngle(null, nombre).Length == 0)
            issues.Add(new UwiValidationIssue("tipo_angulo", "error",
                "Tipo de pozo por ángulo (H, V, D) es obligatorio para el UWI fiscalizado.", "uwi_angulo"));

        if (string.IsNullOrEmpty(record.TipoTrayectoria) && ExtractTrajectory(null, nombre).Length == 0)
            issues.Add(new UwiValidationIssue("tipo_trayectoria", "warning",
                "Trayectoria del pozo (ST, P, PR, ML, G, O) no definida; se omitirá en el UWI.", "uwi_trayectoria"));

        if (string.IsNullOrEmpty(record.TipoObjetivo))
            issues.Add(new UwiValidationIssue("tipo_objetivo", "error",
                "Objetivo del pozo (P, I, M, D, EST) es obligatorio para el UWI fiscalizado.", "uwi_objetivo"));

        if (components is null) return issues;

        if (!Regex.IsMatch(components.Sigla, @"^[A-Z]{4,}$"))
            issues.Add(new UwiValidationIssue("nombre_pozo_sgc", "error",
                $"Sigla \"{components.Sigla}\" no cumple: mínimo 4 caracteres alfabéticos según reglas del nombre.", "uwi_sigla"));

        if (!Regex.IsMatch(components.Numero, @"^\d{4}$"))
            issues.Add(new UwiValidationIssue("nombre_pozo_sgc", "error",
                $"Numeración \"{components.Numero}\" debe ser exactamente 4 dígitos con ceros a la izquierda.", "uwi_numero"));

        if (components.Angulo.Length > 0 && !AngleCodes.Contains(components.Angulo))
            issues.Add(new UwiValidationIssue("tipo_angulo", "error",
                $"Código de ángulo \"{components.Angulo}\" no válido. Use H, V o D.", "uwi_angulo_code"));

        if (components.Trayectoria.Length > 0 && !Regex.IsMatch(components.Trayectoria, @"^ST\d*$|^PR$|^ML$|^P$|^G$|^O$"))
            issues.Add(new UwiValidationIssue("tipo_trayectoria", "error",
                $"Trayectoria \"{components.Trayectoria}\" no válida. Use ST[n], P, PR, ML, G u O.", "uwi_trayectoria_code"));

        if (components.Objetivo.Length > 0 && !ObjectiveCodes.Contains(components.Objetivo))
            issues.Add(new UwiValidationIssue("tipo_objetivo", "error",
                $"Objetivo \"{components.Objetivo}\" no válido. Use P, I, M, D o EST.", "uwi_objetivo_code"));

        if (components.Terminacion.Length > 0)
        {
            if (!TerminationCodes.Contains(components.Terminacion))
                issues.Add(new UwiValidationIssue("tipo_terminacion", "error",
                    $"Terminación \"{components.Terminacion}\" no válida.", "uwi_terminacion_code"));
            if (components.Terminacion == "OH" && !components.Objetivo.Contains("EST"))
                issues.Add(new UwiValidationIssue("tipo_terminacion", "warning",
                    "Hueco abierto (OH) solo aplica para pozos estratigráficos o excepciones aprobadas por la ANH.", "uwi_terminacion_oh"));
        }
        else
        {
            issues.Add(new UwiValidationIssue("tipo_terminacion", "warning",
                "Terminación no definida; el UWI se generará sin sufijo -[CD|LC|LR|GP|CC|OH|O].", "uwi_terminacion_missing"));
        }

        var uwi = Assemble(components, components.Terminacion.Length > 0);
        if (!ValidateFormat(uwi))
            issues.Add(new UwiValidationIssue("uwi_fiscalizado", "error",
                $"El UWI \"{uwi}\" no cumple la estructura del instructivo.", "uwi_format"));

        return issues;
    }
}
