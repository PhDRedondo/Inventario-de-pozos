using Anh.Vip.Domain.Attributes;

namespace Anh.Vip.Domain.Excel;

/// <summary>Columna de la plantilla descargable del cuaderno.</summary>
public sealed record TemplateColumn(string Key, string Header, string Label, string Type, string? CatalogKey, bool Required);

/// <summary>
/// Definición ordenada de las columnas de la plantilla — port de
/// <c>TEMPLATE_COLUMNS</c> (template-columns.ts). El encabezado se resuelve desde
/// <see cref="ExcelColumnMap"/> y la etiqueta desde <see cref="AttributeLabels"/>.
/// </summary>
public static class TemplateColumns
{
    public const int MinRows = 1;
    public const int MaxRows = 500;
    public const int DefaultRows = 10;

    // (clave, tipo, catálogo, obligatorio) en el orden de los temas del formato.
    private static readonly (string Key, string Type, string? Catalog, bool Required)[] Defs =
    {
        ("pozo_existente_avm", "select", "pozo_existente_avm", true),
        ("operadora", "select", "operadoras", true),
        ("contrato", "select", "contratos", true),
        ("campo_avm", "select", "campos_avm", true),
        ("pozo_formacion_avm", "text", null, false),
        ("pozo_avm", "text", null, false),
        ("formacion_avm", "text", null, false),
        ("formacion_forma_9sh", "text", null, false),
        ("formacion_ruty", "select", "formaciones_ruty", false),
        ("yacimiento_ruty", "select", "yacimientos_ruty", false),
        ("tipo_angulo", "select", "tipo_angulo", false),
        ("tipo_trayectoria", "select", "tipo_trayectoria", false),
        ("tipo_objetivo", "select", "tipo_objetivo", false),
        ("tipo_terminacion", "select", "tipo_terminacion", false),
        ("sistema_levantamiento", "select", "sistema_levantamiento", false),
        ("clasificacion_lahee", "text", null, false),
        ("nombre_pozo_forma_6cr", "text", null, false),
        ("nombre_pozo_sgc", "text", null, true),
        ("uwi_sgc", "text", null, false),
        ("estado_pozo", "select", "estado_pozo", true),
        ("departamento", "select", "departamentos", true),
        ("municipio", "select", "municipios", true),
        ("locacion_cluster", "text", null, false),
        ("coord_bogota_x", "coordinate", null, false),
        ("coord_bogota_y", "coordinate", null, false),
        ("coord_nacional_x", "coordinate", null, false),
        ("coord_nacional_y", "coordinate", null, false),
        ("longitud", "coordinate", null, false),
        ("latitud", "coordinate", null, false),
        ("prod_dias", "number", null, false),
        ("prod_petroleo", "number", null, false),
        ("prod_agua", "number", null, false),
        ("prod_gas", "number", null, false),
        ("iny_dias", "number", null, false),
        ("iny_agua", "number", null, false),
        ("iny_gas", "number", null, false),
        ("iny_otros", "number", null, false),
    };

    public static readonly IReadOnlyList<TemplateColumn> All = Build();

    public static int ClampRows(int rows) => Math.Min(MaxRows, Math.Max(MinRows, rows));

    private static IReadOnlyList<TemplateColumn> Build()
    {
        var reverse = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (header, key) in ExcelColumnMap.ColumnMap) reverse[key] = header;
        foreach (var (header, key) in ExcelColumnMap.TemplateSpecial) reverse[key] = header;

        return Defs.Select(d =>
        {
            if (!reverse.TryGetValue(d.Key, out var header))
                throw new InvalidOperationException($"Sin encabezado de plantilla para \"{d.Key}\"");
            return new TemplateColumn(d.Key, header, AttributeLabels.Get(d.Key), d.Type, d.Catalog, d.Required);
        }).ToList();
    }
}
