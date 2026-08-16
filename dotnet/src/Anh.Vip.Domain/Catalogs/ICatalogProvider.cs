namespace Anh.Vip.Domain.Catalogs;

/// <summary>
/// Acceso a los catálogos oficiales para la validación. Abstrae la fuente
/// (seed.json en pruebas, SQL Server en producción) para que el dominio no
/// dependa de infraestructura.
/// </summary>
public interface ICatalogProvider
{
    /// <summary>
    /// Indica si <paramref name="value"/> pertenece al catálogo de lista
    /// <paramref name="catalogKey"/>. Equivale a <c>isInCatalog</c> de validation.ts:
    /// valor vacío o catálogo inexistente devuelven <c>true</c>.
    /// </summary>
    bool IsInList(string catalogKey, string? value);

    /// <summary>
    /// Indica si el departamento corresponde al catálogo oficial DANE.
    /// Equivale a <c>isCanonicalDepartamento</c> de etl.ts (valor vacío -> true).
    /// </summary>
    bool IsCanonicalDepartamento(string? value);
}
