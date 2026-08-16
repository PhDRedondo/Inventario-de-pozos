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
}
