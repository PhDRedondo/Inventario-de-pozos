using System.Security.Claims;

namespace Anh.Vip.Api.Security;

/// <summary>Roles y políticas de autorización (segregación de funciones, GU-18 Anexo 2).</summary>
public static class Roles
{
    public const string Operadora = "operadora";
    public const string Anh = "anh";
    public const string Admin = "admin";

    /// <summary>Gestiona cuadernos (carga, envío): operadora o admin.</summary>
    public const string OperatorOrAdmin = "OperatorOrAdmin";

    /// <summary>Consulta del inventario validado: operadora, anh o admin.</summary>
    public const string ReadInventory = "ReadInventory";
}

/// <summary>Lectura de identidad desde los claims del token (OIDC/AD).</summary>
public static class ClaimsPrincipalExtensions
{
    public static string GetEmail(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Email)
        ?? user.FindFirstValue("email")
        ?? user.FindFirstValue("preferred_username")
        ?? user.Identity?.Name
        ?? "desconocido";

    public static string? GetOperadora(this ClaimsPrincipal user) =>
        user.FindFirstValue("operadora");

    public static bool IsAdmin(this ClaimsPrincipal user) => user.IsInRole(Roles.Admin);
}
