using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Anh.Vip.Domain.Tests.Api;

/// <summary>
/// Esquema de autenticación de prueba: autentica según cabeceras
/// <c>X-Test-User</c> (email), <c>X-Test-Roles</c> (roles separados por coma) y
/// <c>X-Test-Operadora</c>. Sin <c>X-Test-User</c> no autentica (produce 401),
/// permitiendo probar 401/403/200 sin un IdP real.
/// </summary>
public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-User", out var user) || string.IsNullOrEmpty(user))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new List<Claim> { new(ClaimTypes.Email, user.ToString()) };

        if (Request.Headers.TryGetValue("X-Test-Roles", out var roles))
            foreach (var r in roles.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                claims.Add(new Claim(ClaimTypes.Role, r));

        if (Request.Headers.TryGetValue("X-Test-Operadora", out var operadora) && !string.IsNullOrEmpty(operadora))
            claims.Add(new Claim("operadora", operadora.ToString()));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
