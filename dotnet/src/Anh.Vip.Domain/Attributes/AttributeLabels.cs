namespace Anh.Vip.Domain.Attributes;

/// <summary>
/// Etiquetas oficiales de cada atributo del formato ANH — port de
/// <c>ATTRIBUTE_LABELS</c> / <c>getAttributeLabel</c> (attributes.ts + catalogs.ts).
/// </summary>
public static class AttributeLabels
{
    private static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        ["pozo_existente_avm"] = "¿Pozo existente en AVM ANH?",
        ["operadora"] = "Operadora",
        ["contrato"] = "Contrato según AVM ANH",
        ["campo_avm"] = "Campo AVM",
        ["pozo_formacion_avm"] = "Pozo formación AVM",
        ["pozo_avm"] = "Pozo AVM",
        ["formacion_avm"] = "Formación AVM",
        ["formacion_forma_9sh"] = "Formación FORMA 9SH",
        ["formacion_ruty"] = "Formación RUTY",
        ["yacimiento_ruty"] = "Yacimiento RUTY",
        ["tipo_angulo"] = "Tipo de pozo por ángulo",
        ["tipo_trayectoria"] = "Tipo de pozo por trayectoria",
        ["tipo_objetivo"] = "Tipo de pozo (según objetivo)",
        ["tipo_terminacion"] = "Tipo de terminación",
        ["sistema_levantamiento"] = "Sistema de levantamiento",
        ["clasificacion_lahee"] = "Clasificación Lahee final",
        ["nombre_pozo_forma_6cr"] = "Nombre pozo FORMA 6CR",
        ["nombre_pozo_sgc"] = "Nombre pozo (SGC)",
        ["uwi_sgc"] = "UWI (SGC)",
        ["uwi_fiscalizado"] = "UWI fiscalizado (generado)",
        ["estado_pozo"] = "Estado del pozo",
        ["departamento"] = "Departamento",
        ["municipio"] = "Municipio",
        ["codigo_dane_depto"] = "Código DANE departamento",
        ["codigo_dane_muni"] = "Código DANE municipio",
        ["locacion_cluster"] = "Locación-clúster",
        ["coord_bogota_x"] = "Coordenada superficie X (Bogotá)",
        ["coord_bogota_y"] = "Coordenada superficie Y (Bogotá)",
        ["coord_nacional_x"] = "Coordenada superficie X (Nacional)",
        ["coord_nacional_y"] = "Coordenada superficie Y (Nacional)",
        ["longitud"] = "Longitud",
        ["latitud"] = "Latitud",
        ["prod_dias"] = "Días acumulados",
        ["prod_petroleo"] = "Petróleo acumulado (BBL)",
        ["prod_agua"] = "Agua acumulada (BBL)",
        ["prod_gas"] = "Gas acumulado (KPC)",
        ["iny_dias"] = "Días acumulados",
        ["iny_agua"] = "Agua acumulada (BBL)",
        ["iny_gas"] = "Gas acumulado (KPC)",
        ["iny_otros"] = "Otros acumulado",
    };

    /// <summary>Etiqueta legible de un atributo; si no existe, reemplaza '_' por espacio.</summary>
    public static string Get(string key) =>
        Labels.TryGetValue(key, out var label) ? label : key.Replace('_', ' ');
}
