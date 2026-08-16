using Anh.Vip.Domain.Entities;

namespace Anh.Vip.Infrastructure.Ingestion;

/// <summary>
/// Siembra un pequeño inventario aplicado (upload submitted + pozos) para que el
/// panel muestre datos en el perfil de desarrollo. No usar en producción.
/// </summary>
public static class DemoDataSeeder
{
    public static void Seed(VipDbContext db)
    {
        if (db.Uploads.Any(u => u.Status == "submitted")) return;

        var now = DateTime.UtcNow;
        var upload = new Upload
        {
            Filename = "demo-inventario.xlsx",
            Operadora = "VARIAS",
            VersionNumber = 1,
            Status = "submitted",
            SubmittedAt = now,
            SubmittedBy = "demo@anh.gov.co",
            CreatedAt = now,
        };

        // (operadora, departamento, estado, objetivo, validación)
        var rows = new[]
        {
            ("HOCOL S.A.", "META", "Activo", "P (Productor)", "valid"),
            ("HOCOL S.A.", "META", "Activo", "P (Productor)", "warning"),
            ("HOCOL S.A.", "CASANARE", "Inactivo", "I (Inyector)", "valid"),
            ("ECOPETROL S.A.", "META", "Activo", "P (Productor)", "valid"),
            ("ECOPETROL S.A.", "CASANARE", "Activo", "P (Productor)", "valid"),
            ("ECOPETROL S.A.", "ARAUCA", "Suspendido Temporalmente", "I (Inyector)", "warning"),
            ("GEOPARK COLOMBIA S.A.S.", "META", "Activo", "P (Productor)", "valid"),
            ("GEOPARK COLOMBIA S.A.S.", "CASANARE", "Inactivo", "P (Productor)", "warning"),
            ("PAREX RESOURCES COLOMBIA LTD", "ARAUCA", "Activo", "P (Productor)", "valid"),
            ("PAREX RESOURCES COLOMBIA LTD", "CASANARE", "Activo", "I (Inyector)", "valid"),
            ("CANACOL ENERGY COLOMBIA SAS", "META", "Abandonado Temporalmente", "P (Productor)", "valid"),
            ("CANACOL ENERGY COLOMBIA SAS", "META", "Activo", "P (Productor)", "warning"),
        };

        // Centroides aproximados para georreferenciar los pozos demo.
        var centroids = new Dictionary<string, (double Lat, double Lng)>
        {
            ["META"] = (3.35, -73.05),
            ["CASANARE"] = (5.35, -71.60),
            ["ARAUCA"] = (6.55, -71.00),
        };

        var n = 100;
        var perDept = new Dictionary<string, int>();
        foreach (var (operadora, depto, estado, objetivo, status) in rows)
        {
            n++;
            var (baseLat, baseLng) = centroids.TryGetValue(depto, out var c) ? c : (4.6, -73.8);
            var k = perDept.TryGetValue(depto, out var kk) ? kk : 0;
            perDept[depto] = k + 1;
            // Dispersión determinista alrededor del centroide.
            var lat = baseLat + (k % 3) * 0.18 - 0.18;
            var lng = baseLng + (k / 3) * 0.18 - 0.18;

            var inv = System.Globalization.CultureInfo.InvariantCulture;
            var esInyector = objetivo.StartsWith("I");
            upload.Wells.Add(new Well
            {
                Operadora = operadora,
                Departamento = depto,
                EstadoPozo = estado,
                TipoObjetivo = objetivo,
                NombrePozoSgc = $"POZO DEMO {n}",
                UwiFiscalizado = $"50568DEMO{n:0000}CP-CC",
                ValidationStatus = status,
                Latitud = lat.ToString(inv),
                Longitud = lng.ToString(inv),
                // Producción (mayor en productores) e inyección (mayor en inyectores).
                ProdDias = (300 + n % 5 * 30).ToString(inv),
                ProdPetroleo = (esInyector ? 0 : 5000 + n % 7 * 1500).ToString(inv),
                ProdAgua = (2000 + n % 4 * 800).ToString(inv),
                ProdGas = (esInyector ? 0 : 1200 + n % 6 * 400).ToString(inv),
                InyDias = (esInyector ? 200 + n % 5 * 25 : 0).ToString(inv),
                InyAgua = (esInyector ? 3000 + n % 5 * 900 : 0).ToString(inv),
                InyGas = (esInyector ? 800 + n % 4 * 300 : 0).ToString(inv),
                InyOtros = (esInyector ? 100 + n % 3 * 50 : 0).ToString(inv),
                CreatedAt = now,
            });
        }

        db.Uploads.Add(upload);
        db.SaveChanges();
    }
}
