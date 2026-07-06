import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeApiService } from '../../services/theme-api.service';
import { firstValueFrom } from 'rxjs';
import {
  Theme, SavePhase, EmailBody,
} from '../../models/theme.model';

import { ExpansionSettingsManagerComponent } from '../expansion-settings/expansion-settings.component';

@Component({
  selector: 'app-config-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ExpansionSettingsManagerComponent],
  templateUrl: './config-panel.component.html'
})
export class ConfigPanelComponent implements OnInit {
  private readonly api = inject(ThemeApiService);

  @Input({ required: true }) theme!: Theme;
  @Input({ required: true }) isDirty = false;
  @Input({ required: true }) savePhase: SavePhase = 'idle';
  @Input({ required: true }) deployError: string | null = null;
  @Input({ required: true }) authentikApps: { slug: string; name: string }[] = [];
  // El listado de aplicaciones no debe mostrarse hasta elegir un tenant
  // (ver app.component.ts: fetchApps() se difiere hasta handleSelectTenant).
  @Input() selectedTenantId: string | null = null;
  @Output() updateField = new EventEmitter<{ key: keyof Theme; value: any }>();
  @Output() uploadFile = new EventEmitter<{ key: 'logo_top_base64'|'logo_bottom_base64'|'bg_image_base64'; file: File }>();
  @Output() save = new EventEmitter<void>();
  @Output() retryDeploy = new EventEmitter<void>();
  @Output() changeApp = new EventEmitter<string | null>();
  @Output() updateEmailBody = new EventEmitter<{ eventType: string; body: EmailBody }>();
  @Output() openEmailEditor = new EventEmitter<void>();

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

  // Config a nivel tenant (no por tema/app) — a dónde se manda a un
  // usuario no-admin sin app específica en mente (ver custom_authentik.js).
  // Se carga una sola vez: es la misma para todo el tenant, no cambia al
  // cambiar de app en el selector.
  defaultAppUrl = signal('');
  defaultAppUrlSaving = signal(false);
  defaultAppUrlStatus = signal<{ ok: boolean; msg: string } | null>(null);

  ngOnInit(): void {
    this.api.getTenantSettings().subscribe({
      next: (res) => this.defaultAppUrl.set(res.default_app_url ?? ''),
      error: (err) => console.error('No se pudo cargar la config del tenant', err),
    });
  }

  async saveDefaultAppUrl(): Promise<void> {
    this.defaultAppUrlSaving.set(true);
    this.defaultAppUrlStatus.set(null);
    try {
      await firstValueFrom(this.api.updateTenantSettings(this.defaultAppUrl().trim() || null));
      this.defaultAppUrlStatus.set({ ok: true, msg: '✅ Guardado' });
    } catch (err: any) {
      this.defaultAppUrlStatus.set({ ok: false, msg: `❌ ${err?.error?.detail || err?.message || 'Error al guardar'}` });
    } finally {
      this.defaultAppUrlSaving.set(false);
    }
  }

  get isBusy(): boolean {
    return this.savePhase === 'saving' || this.savePhase === 'deploying';
  }

  onField<K extends keyof Theme>(key: K, value: Theme[K]): void {
    this.updateField.emit({ key, value });
  }

  // ── Custom messages / traducciones UI de Authentik ──────────────────────
  // Igual que en el manager (React): un mapa frase-original -> traducción,
  // con helpers de mensajes comunes predefinidos + editor de lista libre.
  newMessageKey = signal('');
  newMessageValue = signal('');

  get customMessages(): Record<string, string> {
    return this.theme.custom_messages || {};
  }

  getCustomMessage(key: string): string {
    return this.customMessages[key] || '';
  }

  updateCustomMessage(original: string, translation: string): void {
    const updated = { ...this.customMessages, [original]: translation };
    this.onField('custom_messages', updated);
  }

  removeCustomMessage(original: string): void {
    const updated = { ...this.customMessages };
    delete updated[original];
    this.onField('custom_messages', updated);
  }

  addCustomMessage(): void {
    const key = this.newMessageKey().trim();
    if (!key) return;
    // Lowercase key: la búsqueda de shadow-intercept en Authentik también se lowercasea
    const formattedKey = key.toLowerCase().replace(/\s+/g, ' ');
    this.updateCustomMessage(formattedKey, this.newMessageValue().trim());
    this.newMessageKey.set('');
    this.newMessageValue.set('');
  }

  readonly PREDEFINED_MESSAGE_KEYS = [
    'forgot your username or password?',
    'enter the email address or username associated with your account.',
    'enter your username or email address.',
  ];

  get otherCustomMessageKeys(): string[] {
    return Object.keys(this.customMessages).filter(
      k => !this.PREDEFINED_MESSAGE_KEYS.includes(k)
    );
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
}
