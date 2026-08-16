using Anh.Vip.Domain.Entities;
using Anh.Vip.Domain.Text;

namespace Anh.Vip.Domain.Excel;

/// <summary>
/// Mapeo de columnas del Excel ANH a atributos del pozo — port de
/// <c>EXCEL_COLUMN_MAP</c> (catalogs.ts), <c>EXCEL_SPECIAL_COLUMN_BINDINGS</c>
/// (attributes.ts) y <c>TEMPLATE_SPECIAL_COLUMN_MAP</c> (template-columns.ts),
/// más <c>parseExcelRow</c> (upload/route.ts).
/// </summary>
public static class ExcelColumnMap
{
    /// <summary>Encabezado oficial -> atributo (29 columnas mapeadas). Preserva dobles espacios.</summary>
    public static readonly IReadOnlyList<(string Header, string Key)> ColumnMap = new[]
    {
        ("POZO EXISTENTE EN AVM ANH?", "pozo_existente_avm"),
        ("OPERADORA", "operadora"),
        ("CONTRATO SEGÚN AVM ANH", "contrato"),
        ("CAMPO AVM", "campo_avm"),
        ("POZO FORMACION AVM", "pozo_formacion_avm"),
        ("POZO AVM", "pozo_avm"),
        ("FORMACION AVM", "formacion_avm"),
        ("FORMACIÓN FORMA 9SH", "formacion_forma_9sh"),
        ("FORMACIÓN RUTY", "formacion_ruty"),
        ("YACIMIENTO RUTY", "yacimiento_ruty"),
        ("TIPO DE POZO POR ANGULO", "tipo_angulo"),
        ("TIPO DE POZO POR TRAYECTORIA", "tipo_trayectoria"),
        ("TIPO DE POZO (SEGUN OBJETIVO)", "tipo_objetivo"),
        ("TIPO DE TERMINACIÓN", "tipo_terminacion"),
        ("SISTEMA DE LEVANTAMENTO", "sistema_levantamiento"),
        ("CLASIFICACIÓN LAHEE FINAL", "clasificacion_lahee"),
        ("NOMBRE POZO FORMA 6CR", "nombre_pozo_forma_6cr"),
        ("UWI (SGC)", "uwi_sgc"),
        ("NOMBRE POZO (SGC)", "nombre_pozo_sgc"),
        ("ESTADO DEL POZO", "estado_pozo"),
        ("DEPARTAMENTO", "departamento"),
        ("MUNICIPIO", "municipio"),
        ("CODIGO DANE DEPARTAMENTO", "codigo_dane_depto"),
        ("CODIGO DANE MUNICIPIO", "codigo_dane_muni"),
        ("LOCACIÓN-CLUSTER", "locacion_cluster"),
        ("DIAS ACUMULADOS", "prod_dias"),
        ("PETRÓLEO ACUMULADO  (BBL)", "prod_petroleo"),
        ("AGUA ACUMULADA (BBL)", "prod_agua"),
        ("GAS ACUMULADO  (KPC)", "prod_gas"),
    };

    /// <summary>Encabezados especiales del archivo real (coordenadas e inyección).</summary>
    public static readonly IReadOnlyList<(string Header, string Key)> SpecialBindings = new[]
    {
        ("Coordenadas Planas Origen Bogotá", "coord_bogota_x"),
        ("__EMPTY", "coord_bogota_y"),
        ("Coordenadas Planas Origen Nacional", "coord_nacional_x"),
        ("Unnamed: 31", "coord_nacional_y"),
        ("Coordenadas Geograficas", "longitud"),
        ("Unnamed: 33", "latitud"),
        ("DIAS ACUMULADOS.1", "iny_dias"),
        ("AGUA ACUMULADA (BBL).1", "iny_agua"),
        ("GAS ACUMULADO  (KPC).1", "iny_gas"),
        ("OTROS ACUMULADO", "iny_otros"),
    };

    /// <summary>Encabezados limpios de la plantilla descargable (coordenadas e inyección).</summary>
    public static readonly IReadOnlyList<(string Header, string Key)> TemplateSpecial = new[]
    {
        ("COORDENADA SUPERFICIE X (BOGOTÁ)", "coord_bogota_x"),
        ("COORDENADA SUPERFICIE Y (BOGOTÁ)", "coord_bogota_y"),
        ("COORDENADA SUPERFICIE X (NACIONAL)", "coord_nacional_x"),
        ("COORDENADA SUPERFICIE Y (NACIONAL)", "coord_nacional_y"),
        ("LONGITUD (GEOGRÁFICA)", "longitud"),
        ("LATITUD (GEOGRÁFICA)", "latitud"),
        ("INYECCIÓN — DÍAS ACUMULADOS", "iny_dias"),
        ("INYECCIÓN — AGUA ACUMULADA (BBL)", "iny_agua"),
        ("INYECCIÓN — GAS ACUMULADO (KPC)", "iny_gas"),
        ("INYECCIÓN — OTROS ACUMULADO", "iny_otros"),
    };

    private static string? Get(IReadOnlyDictionary<string, string> row, string key) =>
        row.TryGetValue(key, out var v) ? v : null;

    /// <summary>Convierte una fila (encabezado -> valor) en un pozo — port de <c>parseExcelRow</c>.</summary>
    public static Well MapRow(IReadOnlyDictionary<string, string> row)
    {
        var well = new Well();

        foreach (var (header, key) in ColumnMap)
        {
            var value = Get(row, header);
            if (!string.IsNullOrEmpty(value) && value.Trim().Length > 0)
                WellFields.Set(well, key, SpanishText.SanitizeSpanishText(value.Trim()));
        }

        foreach (var (header, key) in SpecialBindings)
        {
            var value = Get(row, header)
                ?? (key == "coord_bogota_y" ? Get(row, "Unnamed: 29") : null)
                ?? (key == "iny_dias" ? Get(row, "DIAS ACUMULADOS ") : null);
            if (!string.IsNullOrEmpty(value) && value.Trim().Length > 0)
                WellFields.Set(well, key, value);
        }

        foreach (var (header, key) in TemplateSpecial)
        {
            var value = Get(row, header);
            if (!string.IsNullOrEmpty(value) && value.Trim().Length > 0)
                WellFields.Set(well, key, value);
        }

        return well;
    }
}
