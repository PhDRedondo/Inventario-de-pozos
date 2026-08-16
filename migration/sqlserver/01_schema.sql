/* =====================================================================
   VIP — Inventario de Pozos ANH · Migración a Microsoft SQL Server
   Fase 1 · 01_schema.sql — Esquema núcleo (tablas operativas)

   Estándar: ANH-GTIC-MA-02 §9.1.1.3.1 (SQL Server 2019/2022).
   Portado desde el modelo SQLite del piloto (db.ts, notebook-db.ts, auth-db.ts).

   Convenciones:
   - Esquema lógico [vip] para aislar los objetos de la herramienta.
   - Texto en NVARCHAR (Unicode) para tildes y caracteres del español.
   - Marcas de tiempo en DATETIME2(3) con DEFAULT SYSUTCDATETIME() (UTC).
   - Identidades INT IDENTITY(1,1); claves foráneas explícitas.
   - Idempotente: se puede re-ejecutar sin error (IF OBJECT_ID ... IS NULL).

   Nota de fidelidad: los 40 atributos del pozo se conservan como NVARCHAR
   para preservar el ingreso crudo del Excel (la validación por reglas se
   ejecuta aparte y necesita almacenar incluso valores inválidos para
   reportarlos). El endurecimiento de tipos numéricos es tarea de la Fase 2.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* --- Esquema lógico ------------------------------------------------- */
IF SCHEMA_ID(N'vip') IS NULL
    EXEC(N'CREATE SCHEMA vip AUTHORIZATION dbo;');
GO

/* --- users ---------------------------------------------------------- */
IF OBJECT_ID(N'vip.users', N'U') IS NULL
BEGIN
    CREATE TABLE vip.users (
        id            INT IDENTITY(1,1) NOT NULL,
        email         NVARCHAR(256) NOT NULL,
        username      NVARCHAR(256) NOT NULL,
        role          NVARCHAR(20)  NOT NULL,
        operadora     NVARCHAR(300) NULL,
        password_hash NVARCHAR(512) NOT NULL,
        display_name  NVARCHAR(256) NULL,
        active        BIT           NOT NULL CONSTRAINT DF_users_active DEFAULT (1),
        created_by    NVARCHAR(256) NULL,
        created_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_users_created DEFAULT (SYSUTCDATETIME()),
        updated_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_users_updated DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_users PRIMARY KEY (id),
        CONSTRAINT UQ_users_email UNIQUE (email),
        CONSTRAINT CK_users_role CHECK (role IN (N'operadora', N'anh', N'admin'))
    );
    CREATE INDEX IX_users_role      ON vip.users(role);
    CREATE INDEX IX_users_operadora ON vip.users(operadora);
END
GO

/* --- audit_log ------------------------------------------------------ */
IF OBJECT_ID(N'vip.audit_log', N'U') IS NULL
BEGIN
    CREATE TABLE vip.audit_log (
        id          INT IDENTITY(1,1) NOT NULL,
        actor_email NVARCHAR(256) NOT NULL,
        action      NVARCHAR(120) NOT NULL,
        entity_type NVARCHAR(60)  NOT NULL,
        entity_id   INT           NULL,
        before_json NVARCHAR(MAX) NULL,
        after_json  NVARCHAR(MAX) NULL,
        created_at  DATETIME2(3)  NOT NULL CONSTRAINT DF_audit_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_audit_log PRIMARY KEY (id)
    );
    CREATE INDEX IX_audit_entity ON vip.audit_log(entity_type, entity_id);
    CREATE INDEX IX_audit_actor  ON vip.audit_log(actor_email);
END
GO

/* --- notebooks ------------------------------------------------------ */
IF OBJECT_ID(N'vip.notebooks', N'U') IS NULL
BEGIN
    CREATE TABLE vip.notebooks (
        id                   INT IDENTITY(1,1) NOT NULL,
        operadora            NVARCHAR(300) NOT NULL,
        title                NVARCHAR(300) NOT NULL CONSTRAINT DF_notebooks_title DEFAULT (N''),
        status               NVARCHAR(20)  NOT NULL CONSTRAINT DF_notebooks_status DEFAULT (N'active'),
        active_version_id    INT           NULL,
        submitted_version_id INT           NULL,
        submitted_at         DATETIME2(3)  NULL,
        submitted_by         NVARCHAR(256) NULL,
        created_by           NVARCHAR(256) NULL,
        created_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_notebooks_created DEFAULT (SYSUTCDATETIME()),
        updated_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_notebooks_updated DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_notebooks PRIMARY KEY (id),
        CONSTRAINT CK_notebooks_status CHECK (status IN (N'active', N'submitted', N'archived'))
    );
    CREATE INDEX IX_notebooks_operadora ON vip.notebooks(operadora);
    CREATE INDEX IX_notebooks_status    ON vip.notebooks(status);
END
GO

/* --- uploads (versiones de cargue del cuaderno) --------------------- */
IF OBJECT_ID(N'vip.uploads', N'U') IS NULL
BEGIN
    CREATE TABLE vip.uploads (
        id              INT IDENTITY(1,1) NOT NULL,
        filename        NVARCHAR(400) NOT NULL,
        operadora       NVARCHAR(300) NULL,
        notebook_id     INT           NULL,
        version_number  INT           NOT NULL CONSTRAINT DF_uploads_version DEFAULT (1),
        total_records   INT           NOT NULL CONSTRAINT DF_uploads_total   DEFAULT (0),
        valid_records   INT           NOT NULL CONSTRAINT DF_uploads_valid   DEFAULT (0),
        invalid_records INT           NOT NULL CONSTRAINT DF_uploads_invalid DEFAULT (0),
        warning_records INT           NOT NULL CONSTRAINT DF_uploads_warn    DEFAULT (0),
        error_issues    INT           NOT NULL CONSTRAINT DF_uploads_erri    DEFAULT (0),
        warning_issues  INT           NOT NULL CONSTRAINT DF_uploads_warni   DEFAULT (0),
        info_issues     INT           NOT NULL CONSTRAINT DF_uploads_infoi   DEFAULT (0),
        status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_uploads_status  DEFAULT (N'processed'),
        submitted_at    DATETIME2(3)  NULL,
        submitted_by    NVARCHAR(256) NULL,
        created_at      DATETIME2(3)  NOT NULL CONSTRAINT DF_uploads_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_uploads PRIMARY KEY (id),
        CONSTRAINT CK_uploads_status CHECK (status IN (N'draft', N'submitted', N'processed', N'seed')),
        CONSTRAINT FK_uploads_notebook FOREIGN KEY (notebook_id) REFERENCES vip.notebooks(id)
    );
    CREATE INDEX IX_uploads_notebook  ON vip.uploads(notebook_id);
    CREATE INDEX IX_uploads_operadora ON vip.uploads(operadora);
    CREATE INDEX IX_uploads_status    ON vip.uploads(status);
END
GO

/* --- notebooks: claves foráneas a la versión (tras existir uploads) - */
IF OBJECT_ID(N'FK_notebooks_active_version', N'F') IS NULL
    ALTER TABLE vip.notebooks
        ADD CONSTRAINT FK_notebooks_active_version
        FOREIGN KEY (active_version_id) REFERENCES vip.uploads(id);
GO
IF OBJECT_ID(N'FK_notebooks_submitted_version', N'F') IS NULL
    ALTER TABLE vip.notebooks
        ADD CONSTRAINT FK_notebooks_submitted_version
        FOREIGN KEY (submitted_version_id) REFERENCES vip.uploads(id);
GO

/* --- wells (40 atributos del formato ANH) --------------------------- */
IF OBJECT_ID(N'vip.wells', N'U') IS NULL
BEGIN
    CREATE TABLE vip.wells (
        id                    INT IDENTITY(1,1) NOT NULL,
        upload_id             INT NULL,
        -- Tema: tipo de registro / AVM
        pozo_existente_avm    NVARCHAR(60)  NULL,
        operadora             NVARCHAR(300) NULL,
        contrato              NVARCHAR(200) NULL,
        campo_avm             NVARCHAR(200) NULL,
        pozo_formacion_avm    NVARCHAR(200) NULL,
        pozo_avm              NVARCHAR(200) NULL,
        formacion_avm         NVARCHAR(200) NULL,
        -- Formaciones y yacimientos
        formacion_forma_9sh   NVARCHAR(200) NULL,
        formacion_ruty        NVARCHAR(200) NULL,
        yacimiento_ruty       NVARCHAR(200) NULL,
        -- Información general
        tipo_angulo           NVARCHAR(60)  NULL,
        tipo_trayectoria      NVARCHAR(60)  NULL,
        tipo_objetivo         NVARCHAR(60)  NULL,
        tipo_terminacion      NVARCHAR(80)  NULL,
        sistema_levantamiento NVARCHAR(120) NULL,
        clasificacion_lahee   NVARCHAR(120) NULL,
        nombre_pozo_forma_6cr NVARCHAR(200) NULL,
        uwi_sgc               NVARCHAR(120) NULL,
        uwi_fiscalizado       NVARCHAR(120) NULL,
        nombre_pozo_sgc       NVARCHAR(200) NULL,
        estado_pozo           NVARCHAR(80)  NULL,
        -- Ubicación
        departamento          NVARCHAR(150) NULL,
        municipio             NVARCHAR(150) NULL,
        codigo_dane_depto     NVARCHAR(10)  NULL,
        codigo_dane_muni      NVARCHAR(10)  NULL,
        locacion_cluster      NVARCHAR(200) NULL,
        coord_bogota_x        NVARCHAR(100) NULL,
        coord_bogota_y        NVARCHAR(100) NULL,
        coord_nacional_x      NVARCHAR(100) NULL,
        coord_nacional_y      NVARCHAR(100) NULL,
        longitud              NVARCHAR(100) NULL,
        latitud               NVARCHAR(100) NULL,
        -- Producción (crudo del Excel; ver nota de fidelidad)
        prod_dias             NVARCHAR(100) NULL,
        prod_petroleo         NVARCHAR(100) NULL,
        prod_agua             NVARCHAR(100) NULL,
        prod_gas              NVARCHAR(100) NULL,
        -- Inyección
        iny_dias              NVARCHAR(100) NULL,
        iny_agua              NVARCHAR(100) NULL,
        iny_gas               NVARCHAR(100) NULL,
        iny_otros             NVARCHAR(100) NULL,
        -- Estado de validación
        validation_status     NVARCHAR(20) NOT NULL CONSTRAINT DF_wells_valstatus DEFAULT (N'pending'),
        created_at            DATETIME2(3) NOT NULL CONSTRAINT DF_wells_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_wells PRIMARY KEY (id),
        CONSTRAINT CK_wells_valstatus CHECK (validation_status IN (N'pending', N'valid', N'warning', N'invalid')),
        CONSTRAINT FK_wells_upload FOREIGN KEY (upload_id) REFERENCES vip.uploads(id)
    );
    CREATE INDEX IX_wells_operadora ON vip.wells(operadora);
    CREATE INDEX IX_wells_estado    ON vip.wells(estado_pozo);
    CREATE INDEX IX_wells_upload    ON vip.wells(upload_id);
    CREATE INDEX IX_wells_uwi       ON vip.wells(uwi_fiscalizado);
END
GO

/* --- validation_issues (hallazgos por pozo) ------------------------- */
IF OBJECT_ID(N'vip.validation_issues', N'U') IS NULL
BEGIN
    CREATE TABLE vip.validation_issues (
        id       INT IDENTITY(1,1) NOT NULL,
        well_id  INT           NOT NULL,
        field    NVARCHAR(80)  NOT NULL,
        severity NVARCHAR(20)  NOT NULL,
        message  NVARCHAR(1000) NOT NULL,
        rule     NVARCHAR(80)  NOT NULL,
        CONSTRAINT PK_validation_issues PRIMARY KEY (id),
        CONSTRAINT CK_issues_severity CHECK (severity IN (N'error', N'warning', N'info')),
        CONSTRAINT FK_issues_well FOREIGN KEY (well_id) REFERENCES vip.wells(id)
    );
    CREATE INDEX IX_issues_well     ON vip.validation_issues(well_id);
    CREATE INDEX IX_issues_severity ON vip.validation_issues(severity);
END
GO

/* --- notebook_events (trazabilidad del cuaderno) -------------------- */
IF OBJECT_ID(N'vip.notebook_events', N'U') IS NULL
BEGIN
    CREATE TABLE vip.notebook_events (
        id            INT IDENTITY(1,1) NOT NULL,
        notebook_id   INT           NOT NULL,
        event_type    NVARCHAR(20)  NOT NULL,
        upload_id     INT           NULL,
        actor_email   NVARCHAR(256) NULL,
        message       NVARCHAR(1000) NULL,
        metadata_json NVARCHAR(MAX) NULL,
        created_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_events_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_notebook_events PRIMARY KEY (id),
        CONSTRAINT CK_events_type CHECK (event_type IN (N'created', N'upload', N'submit', N'archived')),
        CONSTRAINT FK_events_notebook FOREIGN KEY (notebook_id) REFERENCES vip.notebooks(id),
        CONSTRAINT FK_events_upload   FOREIGN KEY (upload_id)   REFERENCES vip.uploads(id)
    );
    CREATE INDEX IX_events_notebook ON vip.notebook_events(notebook_id);
END
GO

PRINT N'VIP · esquema núcleo [vip] verificado/creado correctamente.';
GO
