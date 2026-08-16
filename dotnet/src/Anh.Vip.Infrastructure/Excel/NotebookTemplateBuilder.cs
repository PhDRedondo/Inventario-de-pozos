using Anh.Vip.Domain.Excel;
using ClosedXML.Excel;

namespace Anh.Vip.Infrastructure.Excel;

/// <summary>
/// Genera la plantilla `.xlsx` del cuaderno con ClosedXML — port de
/// <c>notebook-template.ts</c>: hoja INVENTARIO con encabezados oficiales,
/// N filas, selectores desde una hoja Listas oculta, y hoja de Instrucciones.
/// </summary>
public static class NotebookTemplateBuilder
{
    private static readonly XLColor HeaderFill = XLColor.FromArgb(0x1A, 0x1A, 0x1A);          // ANH negro
    private static readonly XLColor HeaderRequiredFill = XLColor.FromArgb(0xFF, 0x8C, 0x00);  // ANH naranja

    public static byte[] Build(int rows, string? operadora, IReadOnlyDictionary<string, IReadOnlyList<string>> catalogOptions)
    {
        rows = TemplateColumns.ClampRows(rows);
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("INVENTARIO");
        ws.SheetView.FreezeRows(1);
        var listas = wb.AddWorksheet("Listas");
        listas.Visibility = XLWorksheetVisibility.Hidden;

        // 1) Hoja Listas: una columna por catálogo usado; guardar el rango.
        var rangeByCatalog = new Dictionary<string, IXLRange>(StringComparer.Ordinal);
        var listCol = 1;
        foreach (var catalogKey in TemplateColumns.All.Where(c => c.CatalogKey is not null).Select(c => c.CatalogKey!).Distinct())
        {
            var opts = catalogOptions.TryGetValue(catalogKey, out var v) ? v : Array.Empty<string>();
            listas.Cell(1, listCol).Value = catalogKey;
            for (var i = 0; i < opts.Count; i++)
                listas.Cell(i + 2, listCol).Value = opts[i];
            var lastRow = Math.Max(opts.Count + 1, 2);
            rangeByCatalog[catalogKey] = listas.Range(2, listCol, lastRow, listCol);
            listCol++;
        }

        // 2) Encabezados.
        var columns = TemplateColumns.All;
        for (var c = 0; c < columns.Count; c++)
        {
            var col = columns[c];
            var cell = ws.Cell(1, c + 1);
            cell.Value = col.Header; // exacto: es la llave que usa el parser
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Font.FontSize = 10;
            cell.Style.Fill.BackgroundColor = col.Required ? HeaderRequiredFill : HeaderFill;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Alignment.WrapText = true;
            if (col.Required)
                cell.CreateComment().AddText("Campo obligatorio");
            ws.Column(c + 1).Width = Math.Min(38, Math.Max(16, col.Header.Length + 2));
        }
        ws.Row(1).Height = 34;

        // 3) Filas de datos: prellenar operadora y aplicar selectores por rango.
        var op = string.IsNullOrWhiteSpace(operadora) ? null : operadora.Trim();
        for (var c = 0; c < columns.Count; c++)
        {
            var col = columns[c];
            if (col.Key == "operadora" && op is not null)
                for (var r = 2; r <= rows + 1; r++)
                    ws.Cell(r, c + 1).Value = op;

            if (col.CatalogKey is not null && rangeByCatalog.TryGetValue(col.CatalogKey, out var range))
            {
                var dv = ws.Range(2, c + 1, rows + 1, c + 1).CreateDataValidation();
                dv.List(range, true);
                dv.IgnoreBlanks = true;
                dv.ErrorStyle = XLErrorStyle.Warning;
                dv.ErrorTitle = "Valor fuera de catálogo";
                dv.ErrorMessage = "El valor no está en la lista oficial. Puede continuar, pero se marcará en la validación.";
            }
        }

        BuildInstructions(wb, rows);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void BuildInstructions(XLWorkbook wb, int rows)
    {
        var sheet = wb.AddWorksheet("Instrucciones");
        sheet.Column(1).Width = 4;
        sheet.Column(2).Width = 100;

        var lines = new (string Text, string Style)[]
        {
            ("Plantilla del cuaderno — Inventario de Pozos (VIP · ANH)", "title"),
            ("", ""),
            ($"Esta plantilla se generó para registrar hasta {rows} pozo(s).", "subtitle"),
            ("", ""),
            ("Cómo diligenciarla:", "subtitle"),
            ("1. Diligencie una fila por pozo en la hoja «INVENTARIO». No cambie los encabezados de la fila 1.", "bullet"),
            ("2. Las columnas obligatorias están resaltadas en naranja (con nota «Campo obligatorio»).", "bullet"),
            ("3. En las columnas con lista desplegable, elija un valor del selector.", "bullet"),
            ("4. Los códigos DANE y el UWI fiscalizado se calculan automáticamente al cargar.", "bullet"),
            ("5. Si necesita más filas, copie una fila existente hacia abajo para conservar los selectores.", "bullet"),
            ("6. Guarde en formato .xlsx y cárguelo con «Validar y crear versión».", "bullet"),
        };

        for (var i = 0; i < lines.Length; i++)
        {
            var cell = sheet.Cell(i + 1, 2);
            cell.Value = lines[i].Text;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Font.Bold = lines[i].Style is "title" or "subtitle";
            if (lines[i].Style == "title") cell.Style.Font.FontSize = 15;
        }
    }
}
