using Anh.Vip.Domain.Attributes;
using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Geo;
using Anh.Vip.Domain.Text;
using Anh.Vip.Domain.Validation;
using ValidationIssue = Anh.Vip.Domain.Validation.ValidationIssue;

namespace Anh.Vip.Domain.Etl;

/// <summary>Pozo normalizado más los hallazgos de ETL generados durante la carga.</summary>
public sealed record EtlResult(Well Record, IReadOnlyList<ValidationIssue> Issues);

/// <summary>
/// Normalización de un pozo para ingesta — port fiel de
/// <c>normalizeWellRecordForIngest</c> (etl.ts): canoniza departamento/municipio,
/// rellena el código DANE de departamento desde el municipio y repara la
/// codificación de los atributos de texto.
/// </summary>
public sealed class WellEtl(GeographyResolver geo)
{
    // Atributos de texto que se reparan por codificación (mismo orden que etl.ts).
    private static readonly string[] TextFields =
    {
        "operadora", "campo_avm", "nombre_pozo_sgc", "contrato",
        "locacion_cluster", "formacion_ruty", "yacimiento_ruty",
    };

    public EtlResult NormalizeForIngest(Well record)
    {
        var issues = new List<ValidationIssue>();
        var next = record.Clone();

        var dept = geo.ResolveDepartamento(record.Departamento);
        issues.AddRange(GeographyIssues("departamento", "Departamento", dept));
        if (dept.Value is not null) next.Departamento = dept.Value;

        var muni = geo.ResolveMunicipio(record.Municipio);
        issues.AddRange(GeographyIssues("municipio", "Municipio", muni));
        if (muni.Value is not null) next.Municipio = muni.Value;
        if (!string.IsNullOrEmpty(muni.DeptCode) && string.IsNullOrEmpty(next.CodigoDaneDepto))
            next.CodigoDaneDepto = muni.DeptCode;

        foreach (var key in TextFields)
        {
            var value = GetField(record, key);
            if (string.IsNullOrEmpty(value)) continue;
            var repaired = SpanishText.SanitizeSpanishText(value);
            if (repaired != value)
            {
                SetField(next, key, repaired);
                issues.Add(new ValidationIssue(key, "warning",
                    $"El atributo \"{AttributeLabels.Get(key)}\" fue corregido por codificación de caracteres durante la carga.",
                    "etl_encoding"));
            }
        }

        return new EtlResult(next, issues);
    }

    private static List<ValidationIssue> GeographyIssues(string field, string label, GeographyResolution resolution)
    {
        var issues = new List<ValidationIssue>();
        if (string.IsNullOrEmpty(resolution.Original)) return issues;

        if (!resolution.Matched)
        {
            issues.Add(new ValidationIssue(field, "error",
                $"El valor \"{resolution.Original}\" no corresponde al catálogo oficial de {label}. La operadora debe corregirlo en el inventario.",
                "catalog_geography"));
            return issues;
        }

        if (resolution.EncodingRepaired || resolution.Canonicalized)
        {
            issues.Add(new ValidationIssue(field, "warning",
                $"El {label.ToLowerInvariant()} \"{resolution.Original}\" fue normalizado a \"{resolution.Value}\" durante la carga (codificación o formato).",
                "etl_geography"));
        }

        return issues;
    }

    private static string? GetField(Well r, string key) => key switch
    {
        "operadora" => r.Operadora,
        "campo_avm" => r.CampoAvm,
        "nombre_pozo_sgc" => r.NombrePozoSgc,
        "contrato" => r.Contrato,
        "locacion_cluster" => r.LocacionCluster,
        "formacion_ruty" => r.FormacionRuty,
        "yacimiento_ruty" => r.YacimientoRuty,
        _ => null,
    };

    private static void SetField(Well r, string key, string value)
    {
        switch (key)
        {
            case "operadora": r.Operadora = value; break;
            case "campo_avm": r.CampoAvm = value; break;
            case "nombre_pozo_sgc": r.NombrePozoSgc = value; break;
            case "contrato": r.Contrato = value; break;
            case "locacion_cluster": r.LocacionCluster = value; break;
            case "formacion_ruty": r.FormacionRuty = value; break;
            case "yacimiento_ruty": r.YacimientoRuty = value; break;
        }
    }
}
