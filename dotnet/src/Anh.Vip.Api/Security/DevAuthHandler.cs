using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Anh.Vip.Api.Security;

/// <summary>
/// Esquema de autenticación SOLO para el perfil de desarrollo/demo: autentica
/// cada petición como un usuario demo (todos los roles). En producción se usa
/// JWT Bearer contra el proveedor OIDC/AD institucional. Nunca habilitar en prod.
/// </summary>
public sealed class DevAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Dev";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.Email, "dev@anh.gov.co"),
            new Claim("operadora", "HOCOL S.A."),
            new Claim(ClaimTypes.Role, Roles.Operadora),
            new Claim(ClaimTypes.Role, Roles.Anh),
            new Claim(ClaimTypes.Role, Roles.Admin),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
