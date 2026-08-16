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

        // (operadora, depto, municipio, daneMuni, lat, lng, estado, objetivo, validación).
        // Municipios y códigos DANE (MPIO_CCNCT) reales, con centroide del polígono,
        // para el coropleto municipal del mapa.
        var rows = new[]
        {
            ("HOCOL S.A.", "META", "CASTILLA LA NUEVA", "50150", 3.8331, -73.5388, "Activo", "P (Productor)", "valid"),
            ("HOCOL S.A.", "META", "ACACÍAS", "50006", 4.0381, -73.7467, "Activo", "P (Productor)", "warning"),
            ("HOCOL S.A.", "CASANARE", "AGUAZUL", "85010", 5.0981, -72.5376, "Inactivo", "I (Inyector)", "valid"),
            ("ECOPETROL S.A.", "META", "CASTILLA LA NUEVA", "50150", 3.8331, -73.5388, "Activo", "P (Productor)", "valid"),
            ("ECOPETROL S.A.", "CASANARE", "YOPAL", "85001", 5.2861, -72.2871, "Activo", "P (Productor)", "valid"),
            ("ECOPETROL S.A.", "ARAUCA", "ARAUQUITA", "81065", 6.8171, -71.2495, "Suspendido Temporalmente", "I (Inyector)", "warning"),
            ("GEOPARK COLOMBIA S.A.S.", "META", "CABUYARO", "50124", 4.3141, -72.9332, "Activo", "P (Productor)", "valid"),
            ("GEOPARK COLOMBIA S.A.S.", "CASANARE", "MANÍ", "85139", 4.7125, -72.1725, "Inactivo", "P (Productor)", "warning"),
            ("PAREX RESOURCES COLOMBIA LTD", "ARAUCA", "ARAUCA", "81001", 6.7925, -70.5164, "Activo", "P (Productor)", "valid"),
            ("PAREX RESOURCES COLOMBIA LTD", "CASANARE", "AGUAZUL", "85010", 5.0981, -72.5376, "Activo", "I (Inyector)", "valid"),
            ("CANACOL ENERGY COLOMBIA SAS", "META", "ACACÍAS", "50006", 4.0381, -73.7467, "Abandonado Temporalmente", "P (Productor)", "valid"),
            ("CANACOL ENERGY COLOMBIA SAS", "META", "VILLAVICENCIO", "50001", 4.1036, -73.4937, "Activo", "P (Productor)", "warning"),
        };

        var n = 100;
        var perMuni = new Dictionary<string, int>();
        foreach (var (operadora, depto, municipio, daneMuni, baseLat, baseLng, estado, objetivo, status) in rows)
        {
            n++;
            // Pequeña dispersión determinista para no superponer pozos del mismo municipio.
            var k = perMuni.TryGetValue(daneMuni, out var kk) ? kk : 0;
            perMuni[daneMuni] = k + 1;
            var lat = baseLat + k * 0.03;
            var lng = baseLng + k * 0.03;

            var inv = System.Globalization.CultureInfo.InvariantCulture;
            var esInyector = objetivo.StartsWith("I");
            upload.Wells.Add(new Well
            {
                Operadora = operadora,
                Departamento = depto,
                Municipio = municipio,
                CodigoDaneDepto = daneMuni[..2],
                CodigoDaneMuni = daneMuni,
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
