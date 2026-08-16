/* =====================================================================
   VIP — Inventario de Pozos ANH · Migración a Microsoft SQL Server
   Fase 1 · 02_catalogs_schema.sql — Tablas de catálogos (referencia)

   Reemplazan a data/seed.json. La validación (.NET, Fase 2) consultará
   estas tablas en lugar de un archivo JSON embebido.

   - cat_departamento / cat_municipio: catálogo DANE con códigos y relación.
   - cat_lista_valor: catálogos de lista simple (operadoras, contratos,
     campos AVM, formaciones/yacimientos RUTY y los enumerados del formato),
     identificados por su clave 'catalogo' (misma que usa validation.ts).
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* --- Departamentos (DANE) ------------------------------------------- */
IF OBJECT_ID(N'vip.cat_departamento', N'U') IS NULL
BEGIN
    CREATE TABLE vip.cat_departamento (
        codigo_dane CHAR(2)       NOT NULL,
        nombre      NVARCHAR(150) NOT NULL,
        CONSTRAINT PK_cat_departamento PRIMARY KEY (codigo_dane),
        CONSTRAINT UQ_cat_departamento_nombre UNIQUE (nombre)
    );
END
GO

/* --- Municipios (DANE) ---------------------------------------------- */
IF OBJECT_ID(N'vip.cat_municipio', N'U') IS NULL
BEGIN
    CREATE TABLE vip.cat_municipio (
        codigo_dane       CHAR(5)       NOT NULL,
        nombre            NVARCHAR(150) NOT NULL,
        codigo_dane_depto CHAR(2)       NOT NULL,
        CONSTRAINT PK_cat_municipio PRIMARY KEY (codigo_dane),
        CONSTRAINT FK_cat_municipio_depto
            FOREIGN KEY (codigo_dane_depto) REFERENCES vip.cat_departamento(codigo_dane)
    );
    CREATE INDEX IX_cat_municipio_depto  ON vip.cat_municipio(codigo_dane_depto);
    CREATE INDEX IX_cat_municipio_nombre ON vip.cat_municipio(nombre);
END
GO

/* --- Catálogos de lista simple -------------------------------------- */
/* catalogo: operadoras | contratos | campos_avm | formaciones_ruty |
             yacimientos_ruty | pozo_existente_avm | tipo_angulo |
             tipo_trayectoria | tipo_objetivo | tipo_terminacion |
             sistema_levantamiento | estado_pozo                        */
IF OBJECT_ID(N'vip.cat_lista_valor', N'U') IS NULL
BEGIN
    CREATE TABLE vip.cat_lista_valor (
        catalogo NVARCHAR(60)  NOT NULL,
        valor    NVARCHAR(300) NOT NULL,
        orden    INT           NOT NULL CONSTRAINT DF_cat_lista_orden DEFAULT (0),
        CONSTRAINT PK_cat_lista_valor PRIMARY KEY (catalogo, valor)
    );
    CREATE INDEX IX_cat_lista_catalogo ON vip.cat_lista_valor(catalogo);
END
GO

PRINT N'VIP · tablas de catálogos verificadas/creadas correctamente.';
GO
