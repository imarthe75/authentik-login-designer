import { Injectable } from '@angular/core';
import { Theme, EmailEventType, EmailBody } from '../models/theme.model';

const MAX_LOGO_BYTES = 200 * 1024; // 200 KB

const PREVIEW_SUBS: Record<string, string> = {
  '{{ url }}': 'https://preview.casmarts.example/reset/TOK-PREVIEW-12345',
  '{{ user.username }}': 'usuario.ejemplo',
  '{{ user.email }}': 'usuario.ejemplo@casmarts.internal',
  '{{ token }}': 'TOK-PREVIEW-12345',
};

const DEFAULT_BODIES: Record<EmailEventType, { subject: string; body_html: string }> = {
  password_reset: {
    subject: 'Restablecer contraseña',
    body_html: '<h2 style="font-size:20px;font-weight:bold;color:#222;margin:0 0 16px;">Restablecer contraseña</h2>'
      + '<p style="margin:0 0 16px;">Hola <strong>{{ user.username }}</strong>,</p>'
      + '<p style="margin:0 0 16px;">Haz clic en el botón para restablecer tu contraseña.</p>'
      + '<p style="margin:24px 0 0;font-size:12px;color:#888;">Si no solicitaste este cambio, ignora este correo.</p>',
  },
  new_account: {
    subject: 'Bienvenido',
    body_html: '<h2 style="font-size:20px;font-weight:bold;color:#222;margin:0 0 16px;">Bienvenido, {{ user.username }}</h2>'
      + '<p style="margin:0 0 16px;">Tu cuenta ha sido creada exitosamente.</p>'
      + '<p style="margin:0 0 16px;">Activa tu cuenta haciendo clic en el botón.</p>',
  },
  account_lockout: {
    subject: 'Cuenta bloqueada temporalmente',
    body_html: '<h2 style="font-size:20px;font-weight:bold;color:#d32f2f;margin:0 0 16px;">Cuenta bloqueada</h2>'
      + '<p style="margin:0 0 16px;">Hola <strong>{{ user.username }}</strong>,</p>'
      + '<p style="margin:0 0 16px;">Tu cuenta ha sido bloqueada por múltiples intentos fallidos.</p>',
  },
  email_verification: {
    subject: 'Verifica tu correo electrónico',
    body_html: '<h2 style="font-size:20px;font-weight:bold;color:#222;margin:0 0 16px;">Verifica tu correo</h2>'
      + '<p style="margin:0 0 16px;">Hola <strong>{{ user.username }}</strong>,</p>'
      + '<p style="margin:0 0 16px;">Verifica tu dirección de correo haciendo clic en el botón.</p>',
  },
  security_change: {
    subject: 'Cambio de seguridad en tu cuenta',
    body_html: '<h2 style="font-size:20px;font-weight:bold;color:#222;margin:0 0 16px;">Aviso de seguridad</h2>'
      + '<p style="margin:0 0 16px;">Hola <strong>{{ user.username }}</strong>,</p>'
      + '<p style="margin:0 0 16px;">Se realizó un cambio de seguridad en tu cuenta.</p>'
      + '<p style="margin:24px 0 0;font-size:12px;color:#888;">Si no reconoces este cambio, contacta al administrador.</p>',
  },
};

@Injectable({ providedIn: 'root' })
export class EmailTemplateService {
  /**
   * Generates full email HTML identical in structure to the backend Jinja2 templates.
   * Pure function — no side effects, safe to call in tests.
   */
  generateEmailHtml(
    theme: Theme,
    eventType: EmailEventType,
    overrides?: Partial<EmailBody>
  ): string {
    const defaults = DEFAULT_BODIES[eventType];
    const stored = theme.email_bodies?.[eventType];

    let subject = overrides?.subject ?? stored?.subject ?? defaults.subject;
    let bodyHtml = overrides?.body_html ?? stored?.body_html ?? defaults.body_html;

    // Substitute Authentik preview variables
    for (const [token, value] of Object.entries(PREVIEW_SUBS)) {
      bodyHtml = bodyHtml.replaceAll(token, value);
      subject = subject.replaceAll(token, value);
    }
    subject = subject.replaceAll('{{ tenant.name }}', theme.display_name);
    bodyHtml = bodyHtml.replaceAll('{{ tenant.name }}', theme.display_name);

    // Logo: skip if > 200 KB
    let logoSrc: string | null = theme.logo_top_base64;
    if (logoSrc && this.byteLength(logoSrc) > MAX_LOGO_BYTES) {
      console.warn(`[EmailTemplateService] logo_top_base64 exceeds 200 KB for flow '${theme.authentik_flow_slug}' — omitting.`);
      logoSrc = null;
    }

    const footerText = theme.email_footer_text?.trim() ?? '';
    const ctaUrl = 'https://preview.casmarts.example/reset/TOK-PREVIEW-12345';

    return this.buildHtml({ subject, bodyHtml, theme, logoSrc, footerText, ctaUrl });
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private buildHtml(opts: {
    subject: string;
    bodyHtml: string;
    theme: Theme;
    logoSrc: string | null;
    footerText: string;
    ctaUrl: string;
  }): string {
    const { subject, bodyHtml, theme, logoSrc, footerText, ctaUrl } = opts;
    const primary = theme.primary_color;

    const logoBlock = logoSrc
      ? `<tr>
          <td align="center" style="padding:24px 32px 8px;background-color:#ffffff;">
            <img src="${this.esc(logoSrc)}" alt="Logo"
                 style="max-height:72px;max-width:260px;display:block;border:0;outline:0;" />
          </td>
        </tr>`
      : '';

    const ctaBlock = ctaUrl
      ? `<tr>
          <td align="center" style="padding:0 32px 24px;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center"
                    style="background-color:${this.esc(primary)};border-radius:6px;mso-padding-alt:0;">
                  <a href="${this.esc(ctaUrl)}" target="_blank"
                     style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;
                            border-radius:6px;border:none;background-color:${this.esc(primary)};">
                    Acceder
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : '';

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${this.esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%"
       style="background-color:#f4f4f4;padding:24px 0;">
  <tr>
    <td align="center" valign="top">
      <table border="0" cellpadding="0" cellspacing="0" width="600"
             style="background-color:#ffffff;border-radius:6px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        ${logoBlock}
        <tr>
          <td height="4"
              style="background-color:${this.esc(primary)};font-size:0;line-height:0;mso-line-height-rule:exactly;">
            &nbsp;
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:15px;line-height:1.65;color:#333333;
                     font-family:Arial,Helvetica,sans-serif;">
            ${bodyHtml}
          </td>
        </tr>
        ${ctaBlock}
        <tr>
          <td style="height:1px;background-color:#eeeeee;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center"
              style="padding:16px 32px;background-color:#f9f9f9;
                     font-family:Arial,Helvetica,sans-serif;">
            <p style="font-size:11px;color:#888888;margin:0;line-height:1.5;">
              ${this.esc(footerText)}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private byteLength(s: string): number {
    return new Blob([s]).size;
  }
}
