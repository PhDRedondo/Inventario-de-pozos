using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Anh.Vip.Domain.Entities;

[Table("notebooks", Schema = "vip")]
public class Notebook
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("operadora")] public string Operadora { get; set; } = "";
    [Column("title")] public string Title { get; set; } = "";
    [Column("status")] public string Status { get; set; } = "active";
    [Column("active_version_id")] public int? ActiveVersionId { get; set; }
    [Column("submitted_version_id")] public int? SubmittedVersionId { get; set; }
    [Column("submitted_at")] public DateTime? SubmittedAt { get; set; }
    [Column("submitted_by")] public string? SubmittedBy { get; set; }
    [Column("created_by")] public string? CreatedBy { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    [Column("updated_at")] public DateTime UpdatedAt { get; set; }

    public ICollection<Upload> Uploads { get; set; } = new List<Upload>();
    public ICollection<NotebookEvent> Events { get; set; } = new List<NotebookEvent>();
}

[Table("uploads", Schema = "vip")]
public class Upload
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("filename")] public string Filename { get; set; } = "";
    [Column("operadora")] public string? Operadora { get; set; }
    [Column("notebook_id")] public int? NotebookId { get; set; }
    [Column("version_number")] public int VersionNumber { get; set; } = 1;
    [Column("total_records")] public int TotalRecords { get; set; }
    [Column("valid_records")] public int ValidRecords { get; set; }
    [Column("invalid_records")] public int InvalidRecords { get; set; }
    [Column("warning_records")] public int WarningRecords { get; set; }
    [Column("error_issues")] public int ErrorIssues { get; set; }
    [Column("warning_issues")] public int WarningIssues { get; set; }
    [Column("info_issues")] public int InfoIssues { get; set; }
    [Column("status")] public string Status { get; set; } = "processed";
    [Column("submitted_at")] public DateTime? SubmittedAt { get; set; }
    [Column("submitted_by")] public string? SubmittedBy { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }

    public Notebook? Notebook { get; set; }
    public ICollection<Well> Wells { get; set; } = new List<Well>();
}

[Table("wells", Schema = "vip")]
public class Well
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("upload_id")] public int? UploadId { get; set; }

    [Column("pozo_existente_avm")] public string? PozoExistenteAvm { get; set; }
    [Column("operadora")] public string? Operadora { get; set; }
    [Column("contrato")] public string? Contrato { get; set; }
    [Column("campo_avm")] public string? CampoAvm { get; set; }
    [Column("pozo_formacion_avm")] public string? PozoFormacionAvm { get; set; }
    [Column("pozo_avm")] public string? PozoAvm { get; set; }
    [Column("formacion_avm")] public string? FormacionAvm { get; set; }

    [Column("formacion_forma_9sh")] public string? FormacionForma9sh { get; set; }
    [Column("formacion_ruty")] public string? FormacionRuty { get; set; }
    [Column("yacimiento_ruty")] public string? YacimientoRuty { get; set; }

    [Column("tipo_angulo")] public string? TipoAngulo { get; set; }
    [Column("tipo_trayectoria")] public string? TipoTrayectoria { get; set; }
    [Column("tipo_objetivo")] public string? TipoObjetivo { get; set; }
    [Column("tipo_terminacion")] public string? TipoTerminacion { get; set; }
    [Column("sistema_levantamiento")] public string? SistemaLevantamiento { get; set; }
    [Column("clasificacion_lahee")] public string? ClasificacionLahee { get; set; }
    [Column("nombre_pozo_forma_6cr")] public string? NombrePozoForma6cr { get; set; }
    [Column("uwi_sgc")] public string? UwiSgc { get; set; }
    [Column("uwi_fiscalizado")] public string? UwiFiscalizado { get; set; }
    [Column("nombre_pozo_sgc")] public string? NombrePozoSgc { get; set; }
    [Column("estado_pozo")] public string? EstadoPozo { get; set; }

    [Column("departamento")] public string? Departamento { get; set; }
    [Column("municipio")] public string? Municipio { get; set; }
    [Column("codigo_dane_depto")] public string? CodigoDaneDepto { get; set; }
    [Column("codigo_dane_muni")] public string? CodigoDaneMuni { get; set; }
    [Column("locacion_cluster")] public string? LocacionCluster { get; set; }
    [Column("coord_bogota_x")] public string? CoordBogotaX { get; set; }
    [Column("coord_bogota_y")] public string? CoordBogotaY { get; set; }
    [Column("coord_nacional_x")] public string? CoordNacionalX { get; set; }
    [Column("coord_nacional_y")] public string? CoordNacionalY { get; set; }
    [Column("longitud")] public string? Longitud { get; set; }
    [Column("latitud")] public string? Latitud { get; set; }

    [Column("prod_dias")] public string? ProdDias { get; set; }
    [Column("prod_petroleo")] public string? ProdPetroleo { get; set; }
    [Column("prod_agua")] public string? ProdAgua { get; set; }
    [Column("prod_gas")] public string? ProdGas { get; set; }

    [Column("iny_dias")] public string? InyDias { get; set; }
    [Column("iny_agua")] public string? InyAgua { get; set; }
    [Column("iny_gas")] public string? InyGas { get; set; }
    [Column("iny_otros")] public string? InyOtros { get; set; }

    [Column("validation_status")] public string ValidationStatus { get; set; } = "pending";
    [Column("created_at")] public DateTime CreatedAt { get; set; }

    public Upload? Upload { get; set; }
    public ICollection<ValidationIssue> Issues { get; set; } = new List<ValidationIssue>();

    /// <summary>Copia superficial del pozo (el ETL no muta la entrada).</summary>
    public Well Clone() => (Well)MemberwiseClone();

    /// <summary>Proyecta el pozo al input que consume el generador de UWI.</summary>
    public Uwi.UwiWellInput ToUwiInput() => new()
    {
        NombrePozoSgc = NombrePozoSgc,
        NombrePozoForma6cr = NombrePozoForma6cr,
        PozoAvm = PozoAvm,
        CodigoDaneDepto = CodigoDaneDepto,
        CodigoDaneMuni = CodigoDaneMuni,
        TipoAngulo = TipoAngulo,
        TipoTrayectoria = TipoTrayectoria,
        TipoObjetivo = TipoObjetivo,
        TipoTerminacion = TipoTerminacion,
        LocacionCluster = LocacionCluster,
    };
}

[Table("validation_issues", Schema = "vip")]
public class ValidationIssue
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("well_id")] public int WellId { get; set; }
    [Column("field")] public string Field { get; set; } = "";
    [Column("severity")] public string Severity { get; set; } = "";
    [Column("message")] public string Message { get; set; } = "";
    [Column("rule")] public string Rule { get; set; } = "";

    public Well? Well { get; set; }
}

[Table("notebook_events", Schema = "vip")]
public class NotebookEvent
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("notebook_id")] public int NotebookId { get; set; }
    [Column("event_type")] public string EventType { get; set; } = "";
    [Column("upload_id")] public int? UploadId { get; set; }
    [Column("actor_email")] public string? ActorEmail { get; set; }
    [Column("message")] public string? Message { get; set; }
    [Column("metadata_json")] public string? MetadataJson { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }

    public Notebook? Notebook { get; set; }
}
