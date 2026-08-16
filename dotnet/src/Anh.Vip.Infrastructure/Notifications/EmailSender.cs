using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Anh.Vip.Infrastructure.Notifications;

/// <summary>Mensaje de correo institucional (texto plano).</summary>
public sealed record EmailMessage(string To, string Subject, string Body);

/// <summary>Envío de correo — abstracción para desacoplar el flujo de submit del transporte.</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>Configuración SMTP institucional (sección <c>Smtp</c>).</summary>
public sealed class SmtpOptions
{
    /// <summary>Host SMTP; si está vacío se usa el emisor de solo-registro.</summary>
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    /// <summary>Remitente (buzón institucional).</summary>
    public string From { get; set; } = "vip@anh.gov.co";
    /// <summary>Destinatario de las notificaciones de aplicación (ANH).</summary>
    public string AnhRecipient { get; set; } = "inventariopozos@anh.gov.co";
    /// <summary>Credenciales opcionales; si el usuario está vacío se usa el envío anónimo/integrado.</summary>
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
}

/// <summary>Emisor SMTP real (System.Net.Mail), configurado desde <see cref="SmtpOptions"/>.</summary>
public sealed class SmtpEmailSender(IOptions<SmtpOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly SmtpOptions _opt = options.Value;

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        using var client = new SmtpClient(_opt.Host, _opt.Port) { EnableSsl = _opt.EnableSsl };
        if (!string.IsNullOrEmpty(_opt.User))
            client.Credentials = new NetworkCredential(_opt.User, _opt.Password);

        using var mail = new MailMessage(_opt.From, message.To, message.Subject, message.Body);
        await client.SendMailAsync(mail, ct);
        logger.LogInformation("Correo enviado a {To} vía {Host}:{Port}", message.To, _opt.Host, _opt.Port);
    }
}

/// <summary>Emisor de solo-registro para desarrollo/InMemory (no requiere servidor SMTP).</summary>
public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        logger.LogInformation("[correo simulado] Para: {To} · Asunto: {Subject}", message.To, message.Subject);
        return Task.CompletedTask;
    }
}
