using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Anh.Vip.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "vip");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    actor_email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    action = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    entity_type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    entity_id = table.Column<int>(type: "int", nullable: true),
                    before_json = table.Column<string>(type: "nvarchar(max)", maxLength: 300, nullable: true),
                    after_json = table.Column<string>(type: "nvarchar(max)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cat_departamento",
                schema: "vip",
                columns: table => new
                {
                    codigo_dane = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    nombre = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cat_departamento", x => x.codigo_dane);
                });

            migrationBuilder.CreateTable(
                name: "cat_lista_valor",
                schema: "vip",
                columns: table => new
                {
                    catalogo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    valor = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    orden = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cat_lista_valor", x => new { x.catalogo, x.valor });
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    username = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    role = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    operadora = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    password_hash = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    active = table.Column<bool>(type: "bit", nullable: false),
                    created_by = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cat_municipio",
                schema: "vip",
                columns: table => new
                {
                    codigo_dane = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    nombre = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    codigo_dane_depto = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cat_municipio", x => x.codigo_dane);
                    table.ForeignKey(
                        name: "FK_cat_municipio_cat_departamento_codigo_dane_depto",
                        column: x => x.codigo_dane_depto,
                        principalSchema: "vip",
                        principalTable: "cat_departamento",
                        principalColumn: "codigo_dane");
                });

            migrationBuilder.CreateTable(
                name: "notebook_events",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    notebook_id = table.Column<int>(type: "int", nullable: false),
                    event_type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    upload_id = table.Column<int>(type: "int", nullable: true),
                    actor_email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    metadata_json = table.Column<string>(type: "nvarchar(max)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notebook_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notebooks",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    operadora = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    active_version_id = table.Column<int>(type: "int", nullable: true),
                    submitted_version_id = table.Column<int>(type: "int", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    submitted_by = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    created_by = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notebooks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "uploads",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    filename = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    operadora = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    notebook_id = table.Column<int>(type: "int", nullable: true),
                    version_number = table.Column<int>(type: "int", nullable: false),
                    total_records = table.Column<int>(type: "int", nullable: false),
                    valid_records = table.Column<int>(type: "int", nullable: false),
                    invalid_records = table.Column<int>(type: "int", nullable: false),
                    warning_records = table.Column<int>(type: "int", nullable: false),
                    error_issues = table.Column<int>(type: "int", nullable: false),
                    warning_issues = table.Column<int>(type: "int", nullable: false),
                    info_issues = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    submitted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    submitted_by = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_uploads", x => x.id);
                    table.ForeignKey(
                        name: "FK_uploads_notebooks_notebook_id",
                        column: x => x.notebook_id,
                        principalSchema: "vip",
                        principalTable: "notebooks",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "wells",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    upload_id = table.Column<int>(type: "int", nullable: true),
                    pozo_existente_avm = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    operadora = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    contrato = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    campo_avm = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    pozo_formacion_avm = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    pozo_avm = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    formacion_avm = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    formacion_forma_9sh = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    formacion_ruty = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    yacimiento_ruty = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    tipo_angulo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    tipo_trayectoria = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    tipo_objetivo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    tipo_terminacion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    sistema_levantamiento = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    clasificacion_lahee = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    nombre_pozo_forma_6cr = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    uwi_sgc = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    uwi_fiscalizado = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    nombre_pozo_sgc = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    estado_pozo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    departamento = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    municipio = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    codigo_dane_depto = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    codigo_dane_muni = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    locacion_cluster = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    coord_bogota_x = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    coord_bogota_y = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    coord_nacional_x = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    coord_nacional_y = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    longitud = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    latitud = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    prod_dias = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    prod_petroleo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    prod_agua = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    prod_gas = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    iny_dias = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    iny_agua = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    iny_gas = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    iny_otros = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    validation_status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wells", x => x.id);
                    table.ForeignKey(
                        name: "FK_wells_uploads_upload_id",
                        column: x => x.upload_id,
                        principalSchema: "vip",
                        principalTable: "uploads",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "validation_issues",
                schema: "vip",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    well_id = table.Column<int>(type: "int", nullable: false),
                    field = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    severity = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    rule = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_validation_issues", x => x.id);
                    table.ForeignKey(
                        name: "FK_validation_issues_wells_well_id",
                        column: x => x.well_id,
                        principalSchema: "vip",
                        principalTable: "wells",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_cat_lista_valor_catalogo",
                schema: "vip",
                table: "cat_lista_valor",
                column: "catalogo");

            migrationBuilder.CreateIndex(
                name: "IX_cat_municipio_codigo_dane_depto",
                schema: "vip",
                table: "cat_municipio",
                column: "codigo_dane_depto");

            migrationBuilder.CreateIndex(
                name: "IX_notebook_events_notebook_id",
                schema: "vip",
                table: "notebook_events",
                column: "notebook_id");

            migrationBuilder.CreateIndex(
                name: "IX_notebooks_active_version_id",
                schema: "vip",
                table: "notebooks",
                column: "active_version_id");

            migrationBuilder.CreateIndex(
                name: "IX_notebooks_submitted_version_id",
                schema: "vip",
                table: "notebooks",
                column: "submitted_version_id");

            migrationBuilder.CreateIndex(
                name: "IX_uploads_notebook_id",
                schema: "vip",
                table: "uploads",
                column: "notebook_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                schema: "vip",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_validation_issues_well_id",
                schema: "vip",
                table: "validation_issues",
                column: "well_id");

            migrationBuilder.CreateIndex(
                name: "IX_wells_upload_id",
                schema: "vip",
                table: "wells",
                column: "upload_id");

            migrationBuilder.AddForeignKey(
                name: "FK_notebook_events_notebooks_notebook_id",
                schema: "vip",
                table: "notebook_events",
                column: "notebook_id",
                principalSchema: "vip",
                principalTable: "notebooks",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_notebooks_uploads_active_version_id",
                schema: "vip",
                table: "notebooks",
                column: "active_version_id",
                principalSchema: "vip",
                principalTable: "uploads",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_notebooks_uploads_submitted_version_id",
                schema: "vip",
                table: "notebooks",
                column: "submitted_version_id",
                principalSchema: "vip",
                principalTable: "uploads",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_uploads_notebooks_notebook_id",
                schema: "vip",
                table: "uploads");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "cat_lista_valor",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "cat_municipio",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "notebook_events",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "users",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "validation_issues",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "cat_departamento",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "wells",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "notebooks",
                schema: "vip");

            migrationBuilder.DropTable(
                name: "uploads",
                schema: "vip");
        }
    }
}
