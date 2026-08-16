using ClosedXML.Excel;

namespace Anh.Vip.Infrastructure.Excel;

/// <summary>Hoja leída: nombre y filas como diccionarios encabezado -> valor.</summary>
public sealed record SheetData(string SheetName, IReadOnlyList<IReadOnlyDictionary<string, string>> Rows);

/// <summary>
/// Lectura de la hoja INVENTARIO con ClosedXML, replicando el comportamiento de
/// <c>XLSX.utils.sheet_to_json</c> (SheetJS) del piloto: la primera fila del
/// rango usado son los encabezados; a los encabezados vacíos se les asigna
/// <c>__EMPTY</c>/<c>__EMPTY_N</c> y a los duplicados un sufijo <c>_N</c>.
/// </summary>
public static class ExcelSheetReader
{
    public static SheetData Read(Stream stream)
    {
        using var workbook = new XLWorkbook(stream);

        var sheet = workbook.Worksheets
            .FirstOrDefault(w => w.Name.ToUpperInvariant().Contains("INVENTARIO"))
            ?? workbook.Worksheets.First();

        var used = sheet.RangeUsed();
        if (used is null)
            return new SheetData(sheet.Name, Array.Empty<IReadOnlyDictionary<string, string>>());

        var firstRow = used.RangeAddress.FirstAddress.RowNumber;
        var lastRow = used.RangeAddress.LastAddress.RowNumber;
        var firstCol = used.RangeAddress.FirstAddress.ColumnNumber;
        var lastCol = used.RangeAddress.LastAddress.ColumnNumber;

        // Encabezados (fila 1 del rango usado), con nombres estilo SheetJS.
        var headers = new string[lastCol - firstCol + 1];
        var seen = new Dictionary<string, int>(StringComparer.Ordinal);
        var emptyCount = 0;
        for (var c = firstCol; c <= lastCol; c++)
        {
            var raw = sheet.Cell(firstRow, c).GetString();
            string name;
            if (string.IsNullOrEmpty(raw))
                name = emptyCount == 0 ? "__EMPTY" : $"__EMPTY_{emptyCount}";
            else
                name = raw;

            if (string.IsNullOrEmpty(raw)) emptyCount++;

            if (seen.TryGetValue(name, out var n))
            {
                seen[name] = n + 1;
                name = $"{name}_{n}";
            }
            else
            {
                seen[name] = 1;
            }

            headers[c - firstCol] = name;
        }

        var rows = new List<IReadOnlyDictionary<string, string>>();
        for (var r = firstRow + 1; r <= lastRow; r++)
        {
            var dict = new Dictionary<string, string>(StringComparer.Ordinal);
            for (var c = firstCol; c <= lastCol; c++)
                dict[headers[c - firstCol]] = sheet.Cell(r, c).GetString();
            rows.Add(dict);
        }

        return new SheetData(sheet.Name, rows);
    }
}
