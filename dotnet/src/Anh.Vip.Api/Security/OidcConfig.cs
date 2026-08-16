namespace Anh.Vip.Api.Security;

/// <summary>
/// Validación fail-closed de la configuración OIDC/Entra: en producción la API
/// exige <c>Oidc:Authority</c> y <c>Oidc:Audience</c> (p. ej. el tenant Entra ID
/// institucional). Sin ellos, el JWT Bearer no podría validar tokens y toda
/// petición quedaría en 401 de forma silenciosa; preferimos abortar el arranque
/// con un mensaje claro. En desarrollo se usa el esquema Dev y no se exige.
/// </summary>
public static class OidcConfig
{
    /// <summary>
    /// Lanza <see cref="InvalidOperationException"/> si falta configuración cuando
    /// la validación está activa. <paramref name="skip"/> es <c>true</c> en el
    /// perfil Dev y en el arnés de pruebas (que sustituyen la autenticación).
    /// </summary>
    public static void Validate(string? authority, string? audience, bool skip)
    {
        if (skip) return;

        var faltantes = new List<string>();
        if (string.IsNullOrWhiteSpace(authority)) faltantes.Add("Oidc:Authority");
        if (string.IsNullOrWhiteSpace(audience)) faltantes.Add("Oidc:Audience");

        if (faltantes.Count > 0)
            throw new InvalidOperationException(
                "Configuración OIDC/Entra incompleta en producción: falta " +
                string.Join(", ", faltantes) +
                ". Defina el tenant Entra ID (Authority=https://login.microsoftonline.com/{tenantId}/v2.0) " +
                "y el Audience (App ID URI / client id), o ejecute en Development.");
    }
}
