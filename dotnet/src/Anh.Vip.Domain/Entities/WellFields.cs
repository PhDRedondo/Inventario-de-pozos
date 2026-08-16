namespace Anh.Vip.Domain.Entities;

/// <summary>Asignación de atributos del pozo por clave snake_case (para el mapeo de Excel).</summary>
public static class WellFields
{
    public static string? Get(Well w, string key) => key switch
    {
        "pozo_existente_avm" => w.PozoExistenteAvm,
        "operadora" => w.Operadora,
        "contrato" => w.Contrato,
        "campo_avm" => w.CampoAvm,
        "pozo_formacion_avm" => w.PozoFormacionAvm,
        "pozo_avm" => w.PozoAvm,
        "formacion_avm" => w.FormacionAvm,
        "formacion_forma_9sh" => w.FormacionForma9sh,
        "formacion_ruty" => w.FormacionRuty,
        "yacimiento_ruty" => w.YacimientoRuty,
        "tipo_angulo" => w.TipoAngulo,
        "tipo_trayectoria" => w.TipoTrayectoria,
        "tipo_objetivo" => w.TipoObjetivo,
        "tipo_terminacion" => w.TipoTerminacion,
        "sistema_levantamiento" => w.SistemaLevantamiento,
        "clasificacion_lahee" => w.ClasificacionLahee,
        "nombre_pozo_forma_6cr" => w.NombrePozoForma6cr,
        "uwi_sgc" => w.UwiSgc,
        "nombre_pozo_sgc" => w.NombrePozoSgc,
        "estado_pozo" => w.EstadoPozo,
        "departamento" => w.Departamento,
        "municipio" => w.Municipio,
        "codigo_dane_depto" => w.CodigoDaneDepto,
        "codigo_dane_muni" => w.CodigoDaneMuni,
        "locacion_cluster" => w.LocacionCluster,
        "coord_bogota_x" => w.CoordBogotaX,
        "coord_bogota_y" => w.CoordBogotaY,
        "coord_nacional_x" => w.CoordNacionalX,
        "coord_nacional_y" => w.CoordNacionalY,
        "longitud" => w.Longitud,
        "latitud" => w.Latitud,
        "prod_dias" => w.ProdDias,
        "prod_petroleo" => w.ProdPetroleo,
        "prod_agua" => w.ProdAgua,
        "prod_gas" => w.ProdGas,
        "iny_dias" => w.InyDias,
        "iny_agua" => w.InyAgua,
        "iny_gas" => w.InyGas,
        "iny_otros" => w.InyOtros,
        _ => null,
    };

    public static void Set(Well w, string key, string? value)
    {
        switch (key)
        {
            case "pozo_existente_avm": w.PozoExistenteAvm = value; break;
            case "operadora": w.Operadora = value; break;
            case "contrato": w.Contrato = value; break;
            case "campo_avm": w.CampoAvm = value; break;
            case "pozo_formacion_avm": w.PozoFormacionAvm = value; break;
            case "pozo_avm": w.PozoAvm = value; break;
            case "formacion_avm": w.FormacionAvm = value; break;
            case "formacion_forma_9sh": w.FormacionForma9sh = value; break;
            case "formacion_ruty": w.FormacionRuty = value; break;
            case "yacimiento_ruty": w.YacimientoRuty = value; break;
            case "tipo_angulo": w.TipoAngulo = value; break;
            case "tipo_trayectoria": w.TipoTrayectoria = value; break;
            case "tipo_objetivo": w.TipoObjetivo = value; break;
            case "tipo_terminacion": w.TipoTerminacion = value; break;
            case "sistema_levantamiento": w.SistemaLevantamiento = value; break;
            case "clasificacion_lahee": w.ClasificacionLahee = value; break;
            case "nombre_pozo_forma_6cr": w.NombrePozoForma6cr = value; break;
            case "uwi_sgc": w.UwiSgc = value; break;
            case "nombre_pozo_sgc": w.NombrePozoSgc = value; break;
            case "estado_pozo": w.EstadoPozo = value; break;
            case "departamento": w.Departamento = value; break;
            case "municipio": w.Municipio = value; break;
            case "codigo_dane_depto": w.CodigoDaneDepto = value; break;
            case "codigo_dane_muni": w.CodigoDaneMuni = value; break;
            case "locacion_cluster": w.LocacionCluster = value; break;
            case "coord_bogota_x": w.CoordBogotaX = value; break;
            case "coord_bogota_y": w.CoordBogotaY = value; break;
            case "coord_nacional_x": w.CoordNacionalX = value; break;
            case "coord_nacional_y": w.CoordNacionalY = value; break;
            case "longitud": w.Longitud = value; break;
            case "latitud": w.Latitud = value; break;
            case "prod_dias": w.ProdDias = value; break;
            case "prod_petroleo": w.ProdPetroleo = value; break;
            case "prod_agua": w.ProdAgua = value; break;
            case "prod_gas": w.ProdGas = value; break;
            case "iny_dias": w.InyDias = value; break;
            case "iny_agua": w.InyAgua = value; break;
            case "iny_gas": w.InyGas = value; break;
            case "iny_otros": w.InyOtros = value; break;
        }
    }
}
