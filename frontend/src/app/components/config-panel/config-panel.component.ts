import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeApiService } from '../../services/theme-api.service';
import { firstValueFrom } from 'rxjs';
import {
  Theme, SavePhase, EmailEventType, EmailBody,
  EMAIL_EVENT_TYPES, EMAIL_EVENT_LABELS, EMPTY_EMAIL_BODY
} from '../../models/theme.model';

@Component({
  selector: 'app-config-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './config-panel.component.html'
})
export class ConfigPanelComponent {
  private readonly api = inject(ThemeApiService);

  @Input({ required: true }) theme!: Theme;
  @Input({ required: true }) isDirty = false;
  @Input({ required: true }) savePhase: SavePhase = 'idle';
  @Input({ required: true }) deployError: string | null = null;
  @Input({ required: true }) authentikApps: { slug: string; name: string }[] = [];
  @Output() updateField = new EventEmitter<{ key: keyof Theme; value: any }>();
  @Output() uploadFile = new EventEmitter<{ key: 'logo_top_base64'|'logo_bottom_base64'|'bg_image_base64'; file: File }>();
  @Output() save = new EventEmitter<void>();
  @Output() retryDeploy = new EventEmitter<void>();
  @Output() changeApp = new EventEmitter<string | null>();
  @Output() updateEmailBody = new EventEmitter<{ eventType: string; body: EmailBody }>();

  @ViewChild('logoTopInput') logoTopRef!: ElementRef<HTMLInputElement>;
  @ViewChild('logoBottomInput') logoBottomRef!: ElementRef<HTMLInputElement>;
  @ViewChild('bgImgInput') bgImgRef!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfInput') pdfRef!: ElementRef<HTMLInputElement>;

  readonly PREDEFINED_COLORS = [
    { name: 'Civika', color: '#4272A5', hover: '#2d5580' },
    { name: 'Marino', color: '#1a3a6b', hover: '#254f94' },
    { name: 'Azul', color: '#1976d2', hover: '#2196f3' },
    { name: 'Verde', color: '#2e7d32', hover: '#43a047' },
    { name: 'Morado', color: '#5e35b1', hover: '#7c4dff' },
    { name: 'Gris', color: '#424242', hover: '#616161' },
  ];

  readonly TAB_CONTENT = {
    general: true,
    appearance: false,
    images: false,
    privacy: false,
    notifications: false
  };

  activeTab = signal('general');
  activeEmailEvent = signal<EmailEventType>('password_reset');
  copiedVar = signal<string | null>(null);

  testEmail = signal('');
  testSending = signal(false);
  testStatus = signal<{ ok: boolean; msg: string } | null>(null);

  readonly EMAIL_EVENT_TYPES = EMAIL_EVENT_TYPES;
  readonly EMAIL_EVENT_LABELS = EMAIL_EVENT_LABELS;

  readonly VARIABLE_GUIDE = [
    { var: '{{ user.username }}', desc: 'Nombre de usuario' },
    { var: '{{ user.email }}', desc: 'Correo electrónico del usuario' },
    { var: '{{ url }}', desc: 'Enlace de acción' },
    { var: '{{ token }}', desc: 'Token de un solo uso' },
    { var: '{{ tenant.name }}', desc: 'Nombre del tenant' },
  ];

  get isBusy(): boolean {
    return this.savePhase === 'saving' || this.savePhase === 'deploying';
  }

  onField<K extends keyof Theme>(key: K, value: Theme[K]): void {
    this.updateField.emit({ key, value });
  }

  onSave(): void {
    this.save.emit();
  }

  onRetryDeploy(): void {
    this.retryDeploy.emit();
  }

  onChangeApp(appSlug: string | null): void {
    this.changeApp.emit(appSlug);
  }

  setTab(tab: string): void {
    this.activeTab.set(tab);
  }

  triggerLogoTopInput(): void {
    this.logoTopRef?.nativeElement.click();
  }

  triggerLogoBottomInput(): void {
    this.logoBottomRef?.nativeElement.click();
  }

  triggerBgImageInput(): void {
    this.bgImgRef?.nativeElement.click();
  }

  triggerPdfInput(): void {
    this.pdfRef?.nativeElement.click();
  }

  handleFileChange(key: 'logo_top_base64'|'logo_bottom_base64'|'bg_image_base64', event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('El tamaño máximo permitido para archivos es de 5MB.'); return; }
    this.uploadFile.emit({ key, file });
  }

  getEmailBody(eventType: EmailEventType): EmailBody {
    return this.theme.email_bodies?.[eventType] ?? { ...EMPTY_EMAIL_BODY };
  }

  onEmailSubjectChange(value: string): void {
    const evt = this.activeEmailEvent();
    this.updateEmailBody.emit({ eventType: evt, body: { ...this.getEmailBody(evt), subject: value } });
  }

  onEmailBodyChange(value: string): void {
    const evt = this.activeEmailEvent();
    this.updateEmailBody.emit({ eventType: evt, body: { ...this.getEmailBody(evt), body_html: value } });
  }

  copyVar(v: string): void {
    navigator.clipboard.writeText(v).catch(() => {});
    this.copiedVar.set(v);
    setTimeout(() => this.copiedVar.set(null), 1500);
  }

  handlePdfChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('El archivo debe ser un formato PDF válido.'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('El tamaño máximo permitido para el PDF es de 8MB.'); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => this.onField('privacy_pdf_url', reader.result as string);
    reader.onerror = () => alert('Error al cargar el archivo de privacidad PDF.');
  }

  async handleSendTest(): Promise<void> {
    const email = this.testEmail().trim();
    if (!email) return;
    this.testSending.set(true);
    this.testStatus.set(null);
    try {
      await firstValueFrom(
        this.api.sendTestEmail(
          this.theme.authentik_flow_slug,
          this.activeEmailEvent(),
          email,
          this.theme.authentik_app_slug
        )
      );
      this.testStatus.set({ ok: true, msg: `✅ Enviado a ${email}` });
    } catch (err: any) {
      this.testStatus.set({ ok: false, msg: `❌ ${err?.error?.detail || err?.message || 'Error al enviar'}` });
    } finally {
      this.testSending.set(false);
    }
  }
}
