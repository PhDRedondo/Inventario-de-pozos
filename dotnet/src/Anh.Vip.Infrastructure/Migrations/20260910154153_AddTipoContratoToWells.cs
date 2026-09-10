using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Anh.Vip.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTipoContratoToWells : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "tipo_contrato",
                schema: "vip",
                table: "wells",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tipo_contrato",
                schema: "vip",
                table: "wells");
        }
    }
}
