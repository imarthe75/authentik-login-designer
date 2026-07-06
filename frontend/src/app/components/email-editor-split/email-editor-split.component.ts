import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges,
  signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ThemeApiService } from '../../services/theme-api.service';
import {
  Theme, EmailEventType, EmailBody, EMAIL_EVENT_TYPES, EMAIL_EVENT_LABELS, EMPTY_EMAIL_BODY,
} from '../../models/theme.model';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { EmailPreviewComponent } from '../email-preview/email-preview.component';
import { EmailVariable } from '../rich-text-editor/tiptap-email-extensions';

interface EventMeta {
  icon: string;
  desc: string;
  badgeClass: string;
}

const EMAIL_EVENT_META: Record<EmailEventType, EventMeta> = {
  password_reset: {
    icon: '🔑',
    desc: 'Solicitud para crear una nueva contraseña',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  new_account: {
    icon: '✨',
    desc: 'Bienvenida con enlace para establecer contraseña por primera vez',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
  },
  account_lockout: {
    icon: '🔒',
    desc: 'Alerta de seguridad por intentos fallidos de acceso',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
  security_change: {
    icon: '📝',
    desc: 'Confirmación de que la contraseña fue actualizada',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  email_verification: {
    icon: '✅',
    desc: 'Confirmación de dirección de correo electrónico',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  account_locked_admin: {
    icon: '🚫',
    desc: 'Cuenta bloqueada directamente por un administrador (no por intentos fallidos)',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
  account_unlocked_admin: {
    icon: '🔓',
    desc: 'Cuenta reactivada directamente por un administrador',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
  },
  login_success: {
    icon: '👋',
    desc: 'Aviso de un inicio de sesión exitoso',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
  },
  suspicious_request: {
    icon: '⚠️',
    desc: 'Alerta por una solicitud sospechosa detectada',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
  invitation_used: {
    icon: '🎟️',
    desc: 'Bienvenida al aceptar una invitación',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
  },
  app_authorized: {
    icon: '🔗',
    desc: 'Aviso de que se autorizó el acceso de una nueva aplicación (consentimiento OAuth)',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  impersonation_started: {
    icon: '🕵️',
    desc: 'Aviso de que un administrador accedió a la cuenta (impersonación)',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  account_deleted: {
    icon: '🗑️',
    desc: 'Confirmación de que la cuenta fue eliminada',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
  },
};

const DEFAULT_VARIABLES: EmailVariable[] = [
  { var: '{{nombre_usuario}}', desc: 'Nombre completo (Israel Martínez)' },
  { var: '{{nombre_usuario_nombre}}', desc: 'Solo nombre (Israel)' },
  { var: '{{nombre_usuario_apellido}}', desc: 'Solo apellido (Martínez)' },
  { var: '{{usuario_login}}', desc: 'Usuario/ID (israelm)' },
  { var: '{{usuario_email}}', desc: 'Correo electrónico' },
  { var: '{{nombre_sistema}}', desc: 'Sistema donde ocurre el evento' },
  { var: '{{empresa_nombre}}', desc: 'Nombre de la empresa' },
  { var: '{{aplicacion_nombre}}', desc: 'Aplicación (Portal RH, CRM, etc.)' },
  { var: '{{aplicacion_slug}}', desc: 'ID único de la aplicación' },
  { var: '{{color_primario}}', desc: 'Color primario (hex)' },
  { var: '{{logo_url}}', desc: 'URL del logo' },
  { var: '{{ip_origen}}', desc: 'IP remota (192.168.1.100)' },
  { var: '{{navegador}}', desc: 'User-Agent/Navegador' },
  { var: '{{dispositivo}}', desc: 'Dispositivo (Windows, macOS, etc.)' },
  { var: '{{fecha_evento}}', desc: 'Fecha/hora legible (30/06/2026 14:32)' },
  { var: '{{fecha_hora_cambio}}', desc: 'Fecha/hora ISO del cambio' },
  { var: '{{realizado_por}}', desc: 'Quién ejecutó la acción' },
  { var: '{{url_acceso}}', desc: 'Enlace de acceso al sistema' },
  { var: '{{contacto_soporte}}', desc: 'Correo/teléfono de soporte' },
  { var: '{{footer_legal}}', desc: 'Leyenda legal' },
  { var: '{{anio}}', desc: 'Año para copyright' },
  { var: '{{rol_asignado}}', desc: '[Alta] Rol asignado' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REAL_TEST_NEEDS_USERNAME = new Set<EmailEventType>(['password_reset', 'email_verification', 'account_lockout']);

@Component({
  selector: 'app-email-editor-split',
  standalone: true,
  imports: [CommonModule, FormsModule, RichTextEditorComponent, EmailPreviewComponent],
  templateUrl: './email-editor-split.component.html',
  // Los elementos custom son `display: inline` por defecto — sin esto,
  // h-full/flex-1 dentro de la plantilla no tienen un contenedor con
  // tamaño real del que heredar porcentajes.
  styles: [':host { display: block; width: 100%; height: 100%; }'],
})
export class EmailEditorSplitComponent implements OnInit, OnChanges {
  private readonly api = inject(ThemeApiService);

  @Input({ required: true }) theme!: Theme;
  @Input({ required: true }) activeEventType!: EmailEventType;
  @Output() updateEmailBody = new EventEmitter<{ eventType: EmailEventType; body: EmailBody }>();
  @Output() selectEvent = new EventEmitter<EmailEventType>();

  readonly EMAIL_EVENT_TYPES = EMAIL_EVENT_TYPES;
  readonly EMAIL_EVENT_LABELS = EMAIL_EVENT_LABELS;
  readonly EMAIL_EVENT_META = EMAIL_EVENT_META;
  readonly REAL_TEST_NEEDS_USERNAME = REAL_TEST_NEEDS_USERNAME;

  variables = signal<EmailVariable[]>(DEFAULT_VARIABLES);
  defaultBody = signal<EmailBody | null>(null);
  liveBodyHtml = signal<string>('');
  previewRefreshKey = signal(0);
  showVariables = signal(false);
  showTemplates = signal(false);
  copiedVar = signal<string | null>(null);

  // Correo de prueba simple (render local + SMTP directo)
  testEmail = signal('');
  testDisplayName = signal('');
  testSending = signal(false);
  testStatus = signal<{ ok: boolean; msg: string } | null>(null);

  // Prueba real vía Authentik (EmailStage/evento real)
  testUsername = signal('');
  testRealSending = signal(false);
  testRealStatus = signal<{ ok: boolean; msg: string } | null>(null);

  private liveTimer?: ReturnType<typeof setTimeout>;
  // Identidad evento/flow/app previamente vista — el `theme` completo cambia
  // de referencia en CADA tecleo (via updateEmailBody -> ThemeStateService
  // crea un objeto nuevo), así que no podemos usar `changes['theme']` como
  // señal de "cambió de correo": eso recargaba default-body y reiniciaba el
  // preview en vivo en cada letra tecleada (mismo criterio que React, que
  // solo depende de [activeEventType, flow_slug, app_slug], no de `theme`
  // entero — ver EmailEditorSplit.tsx:192).
  private lastIdentity = '';

  ngOnInit(): void {
    this.api.getEmailTemplates().subscribe({
      next: (data) => {
        if (data.variables?.length) {
          this.variables.set(data.variables.map((v) => ({ var: v.variable, desc: v.description })));
        }
      },
      error: (err) => console.error('Error loading email variables:', err),
    });
    this.lastIdentity = this.identityKey();
    this.loadDefaultBody();
  }

  private identityKey(): string {
    return `${this.activeEventType}::${this.theme?.authentik_flow_slug}::${this.theme?.authentik_app_slug ?? ''}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['activeEventType'] && !changes['theme']) return;
    const identity = this.identityKey();
    if (identity === this.lastIdentity) return;
    this.lastIdentity = identity;

    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveBodyHtml.set('');
    this.loadDefaultBody();
    this.previewRefreshKey.update((v) => v + 1);
    this.testStatus.set(null);
    this.testRealStatus.set(null);
  }

  private loadDefaultBody(): void {
    if (!this.theme) return;
    this.api.getDefaultEmailBody(this.theme.authentik_flow_slug, this.activeEventType, this.theme.authentik_app_slug).subscribe({
      next: (data) => this.defaultBody.set({ subject: data.subject, body_html: data.body_html }),
      error: (err) => {
        console.error('Error loading default email body:', err);
        this.defaultBody.set(null);
      },
    });
  }

  get savedBody(): EmailBody {
    return this.theme.email_bodies?.[this.activeEventType] ?? { ...EMPTY_EMAIL_BODY };
  }

  get hasCustomContent(): boolean {
    const b = this.savedBody;
    return !!(b.subject || b.body_html);
  }

  get currentBody(): EmailBody {
    return this.hasCustomContent ? this.savedBody : (this.defaultBody() ?? { ...EMPTY_EMAIL_BODY });
  }

  eventHasCustomContent(et: EmailEventType): boolean {
    const b = this.theme.email_bodies?.[et];
    return !!(b?.subject || b?.body_html);
  }

  onSubjectChange(value: string): void {
    this.updateEmailBody.emit({ eventType: this.activeEventType, body: { ...this.currentBody, subject: value } });
  }

  onBodyChange(value: string): void {
    const updated = { ...this.currentBody, body_html: value };
    this.updateEmailBody.emit({ eventType: this.activeEventType, body: updated });

    // Debounce: EmailPreviewComponent también debouncea internamente al
    // cambiar liveBodyHtml, pero evitamos disparar change detection en cada
    // tecla innecesariamente.
    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => {
      this.liveBodyHtml.set(updated.body_html);
    }, 400);
  }

  onSelectEventFromDrawer(et: EmailEventType): void {
    this.selectEvent.emit(et);
    this.showTemplates.set(false);
  }

  toggleVariables(): void {
    this.showVariables.update((v) => !v);
    if (this.showVariables()) this.showTemplates.set(false);
  }

  toggleTemplates(): void {
    this.showTemplates.update((v) => !v);
    if (this.showTemplates()) this.showVariables.set(false);
  }

  closeDrawers(): void {
    this.showVariables.set(false);
    this.showTemplates.set(false);
  }

  copyVar(v: string): void {
    navigator.clipboard.writeText(v).catch(() => {});
    this.copiedVar.set(v);
    setTimeout(() => this.copiedVar.set(null), 1500);
  }

  onVarDragStart(event: DragEvent, variable: string): void {
    event.dataTransfer?.setData('text/plain', variable);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  handleShowFullPreview(): void {
    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveBodyHtml.set('');
    this.previewRefreshKey.update((v) => v + 1);
  }

  async handleSendTest(): Promise<void> {
    const email = this.testEmail().trim();
    if (!email) return;
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      this.testStatus.set({ ok: false, msg: '❌ Ingresa un correo electrónico válido.' });
      return;
    }
    this.testSending.set(true);
    this.testStatus.set(null);
    try {
      await firstValueFrom(
        this.api.sendTestEmail(
          this.theme.authentik_flow_slug,
          this.activeEventType,
          email,
          this.theme.authentik_app_slug,
          this.testDisplayName().trim()
        )
      );
      this.testStatus.set({ ok: true, msg: `✅ Enviado a ${email}` });
    } catch (err: any) {
      this.testStatus.set({ ok: false, msg: `❌ ${err?.error?.detail || err?.message || 'Error al enviar'}` });
    } finally {
      this.testSending.set(false);
    }
  }

  realTestNeedsUsername(): boolean {
    return REAL_TEST_NEEDS_USERNAME.has(this.activeEventType);
  }

  async handleSendTestReal(): Promise<void> {
    const username = this.testUsername().trim();
    if (this.realTestNeedsUsername() && !username) return;
    this.testRealSending.set(true);
    this.testRealStatus.set(null);
    try {
      await firstValueFrom(
        this.api.sendTestEmailReal(this.theme.authentik_flow_slug, this.activeEventType, username)
      );
      this.testRealStatus.set({ ok: true, msg: '✅ Disparado vía Authentik real' });
    } catch (err: any) {
      this.testRealStatus.set({ ok: false, msg: `❌ ${err?.error?.detail || err?.message || 'Error al disparar'}` });
    } finally {
      this.testRealSending.set(false);
    }
  }
}
