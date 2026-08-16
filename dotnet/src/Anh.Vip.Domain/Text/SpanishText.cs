using System.Text;
using System.Text.RegularExpressions;

namespace Anh.Vip.Domain.Text;

/// <summary>
/// Normalización de texto en español — port fiel de <c>src/lib/geo.ts</c>.
/// Repara mojibake, normaliza (NFC/NFD) y canoniza nombres geográficos.
/// </summary>
public static class SpanishText
{
    // Pares (secuencia corrupta -> carácter correcto), en el mismo orden que geo.ts.
    private static readonly (string From, string To)[] EncodingFixes =
    {
        ("\u251c\u00f4", "\u00d3"),
        ("\u251c\u00fc", "\u00c1"),
        ("\u251c\u00dc", "\u00dc"),
        ("\u251c\u255d", "\u00fa"),
        ("\u251c\u2524", "\u00f3"),
        ("\u251c\u00ec", "\u00cd"),
        ("\u251c\u00eb", "\u00c9"),
        ("\u251c\u2551", "\u00da"),
        ("\u251c\u2592", "\u00d1"),
        ("\u221a\u2265", "\u00f3"),
        ("\u221a\u2260", "\u00ed"),
        ("\u221a\u00b0", "\u00e1"),
        ("\u221a\u00a9", "\u00e9"),
        ("\u221a\u222b", "\u00fa"),
        ("\u221a\u00b1", "\u00f1"),
        ("\u00c3\u00b3", "\u00f3"),
        ("\u00c3\u00ad", "\u00ed"),
        ("\u00c3\u00a1", "\u00e1"),
        ("\u00c3\u00a9", "\u00e9"),
        ("\u00c3\u00ba", "\u00fa"),
        ("\u00c3\u00b1", "\u00f1"),
        ("\u00c3\"", "\u00d3"),
        ("\u00c3'", "\u00c1"),
    };

    private static readonly Regex CombiningMarks = new(@"[\u0300-\u036F]", RegexOptions.Compiled);
    private static readonly Regex MultiSpace = new(@"\s+", RegexOptions.Compiled);

    /// <summary>Repara codificaciones corruptas (mojibake) frecuentes.</summary>
    public static string FixEncoding(string text)
    {
        foreach (var (from, to) in EncodingFixes)
            text = text.Replace(from, to, StringComparison.Ordinal);
        return text;
    }

    /// <summary>Repara codificación y normaliza a NFC.</summary>
    public static string SanitizeSpanishText(string? text) =>
        string.IsNullOrEmpty(text) ? "" : FixEncoding(text).Normalize(NormalizationForm.FormC);

    /// <summary>Canoniza un nombre geográfico: repara, quita tildes, mayúsculas y espacios.</summary>
    public static string NormalizeGeoName(string name)
    {
        var fixedText = FixEncoding(name).Normalize(NormalizationForm.FormD);
        var noMarks = CombiningMarks.Replace(fixedText, "");
        var upper = noMarks.ToUpperInvariant();
        return MultiSpace.Replace(upper, " ").Trim();
    }
}
