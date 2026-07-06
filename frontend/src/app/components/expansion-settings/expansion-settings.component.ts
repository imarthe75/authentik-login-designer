import { Component, computed, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthentikExpansionConfig } from '../../models/models';

const DEFAULT_CONFIG: AuthentikExpansionConfig = {
  mfaLayout: {
    totpInstructionsHtml: 'Escanea el código QR con tu aplicación autenticadora para configurar tu cuenta.',
    qrBorderSize: 2,
    passkeyButtonColor: '#2b6cb0',
    backupCodesBgColor: '#f7fafc',
    allowDownloadTxt: true
  },
  consentStage: {
    showAppIcon: true,
    customScopeDescriptions: {
      'openid': 'Acceso a tu identidad básica de CASMARTS Core',
      'email': 'Acceso a tu dirección de correo electrónico',
      'profile': 'Acceso a tu perfil público (nombre, foto)'
    },
    termsAndPrivacyLinks: { terms: 'https://casmart.internal/terms', privacy: 'https://casmart.internal/privacy' }
  },
  errors: {
    err403Title: 'Acceso Denegado',
    err403Message: 'No tienes los permisos necesarios para acceder a este recurso.',
    err404Message: 'La página o el recurso que buscas no existe.',
    sessionExpiredMessage: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.'
  },
  localization: {
    forceLocale: 'es',
    customTranslations: {
      'Log In': 'Iniciar Sesión',
      'Username': 'Usuario',
      'Password': 'Contraseña',
      'Forgot password?': '¿Olvidaste tu contraseña?',
      'Sign Up': 'Registrarse',
      'Flow does not apply to current user': 'El flujo no aplica al usuario actual.',
      'Continue': 'Continuar',
      'Please enter your password.': 'Por favor introduce tu contraseña.',
      'Log in to your account': 'Inicia sesión en tu cuenta',
      'Reset your password': 'Restablecer contraseña',
      'Your password has been reset successfully.': 'Tu contraseña ha sido restablecida con éxito.',
      'Access denied': 'Acceso denegado',
      'Something went wrong.': 'Algo salió mal.',
      'Email address': 'Dirección de correo',
      'Confirm Password': 'Confirmar contraseña',
      'Passwords do not match': 'Las contraseñas no coinciden',
      'Select an application': 'Selecciona una aplicación',
      'Log out': 'Cerrar sesión',
      'Are you sure you want to log out?': '¿Estás seguro de que deseas cerrar sesión?'
    },
    validationMessages: {
      requiredField: 'Este campo es obligatorio',
      invalidEmail: 'Introduce un correo válido',
      passwordMismatch: 'Las contraseñas no coinciden'
    }
  },
  userDashboard: {
    enableCustomDashboard: true,
    cardStyle: 'elevated',
    categoryOrder: ['Core Apps', 'AI Analytics', 'Security Tools'],
    showActiveSessions: true
  }
};

@Component({
  selector: 'app-expansion-settings-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="w-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-left font-sans">
      <!-- Navigation Sub-Tabs -->
      <div class="flex bg-gray-50 border-b border-gray-200 overflow-x-auto">
        <button
          *ngFor="let tab of tabs"
          type="button"
          (click)="setActiveSection(tab.id)"
          [class]="'px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ' +
            (activeSection() === tab.id ? 'border-[#4272A5] text-[#4272A5] bg-white' : 'border-transparent text-gray-500 hover:text-gray-800')"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="p-6 space-y-6">
        <!-- SECTION: MFA / 2FA -->
        <div *ngIf="activeSection() === 'mfa'" class="space-y-4">
          <h4 class="text-sm font-bold text-gray-700">Configuración Visual de Multifactor (MFA)</h4>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Instrucciones TOTP (HTML permitido)</label>
            <textarea
              [ngModel]="config().mfaLayout.totpInstructionsHtml"
              (ngModelChange)="updateMfa('totpInstructionsHtml', $event)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50"
              rows="3"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Grosor de Borde QR (px)</label>
              <input
                type="number"
                [ngModel]="config().mfaLayout.qrBorderSize"
                (ngModelChange)="updateMfa('qrBorderSize', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Color del Botón Passkey</label>
              <div class="flex gap-2 items-center">
                <input
                  type="color"
                  [ngModel]="config().mfaLayout.passkeyButtonColor"
                  (ngModelChange)="updateMfa('passkeyButtonColor', $event)"
                  class="w-10 h-10 border border-gray-300 rounded cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  [ngModel]="config().mfaLayout.passkeyButtonColor"
                  (ngModelChange)="updateMfa('passkeyButtonColor', $event)"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-mono"
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Fondo Códigos de Respaldo</label>
              <div class="flex gap-2 items-center">
                <input
                  type="color"
                  [ngModel]="config().mfaLayout.backupCodesBgColor"
                  (ngModelChange)="updateMfa('backupCodesBgColor', $event)"
                  class="w-10 h-10 border border-gray-300 rounded cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  [ngModel]="config().mfaLayout.backupCodesBgColor"
                  (ngModelChange)="updateMfa('backupCodesBgColor', $event)"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-mono"
                />
              </div>
            </div>

            <div class="flex items-center pt-6">
              <label class="flex items-center gap-2 cursor-pointer font-sans">
                <input
                  type="checkbox"
                  [ngModel]="config().mfaLayout.allowDownloadTxt"
                  (ngModelChange)="updateMfa('allowDownloadTxt', $event)"
                  class="rounded border-gray-300 text-[#4272A5] focus:ring-[#4272A5]"
                />
                <span class="text-xs font-semibold text-gray-600">Permitir descargar códigos como archivo .TXT</span>
              </label>
            </div>
          </div>
        </div>

        <!-- SECTION: Consentimiento -->
        <div *ngIf="activeSection() === 'consent'" class="space-y-4">
          <h4 class="text-sm font-bold text-gray-700">Consentimiento Explícito OAuth2 / OIDC</h4>

          <label class="flex items-center gap-2 cursor-pointer mb-4 font-sans">
            <input
              type="checkbox"
              [ngModel]="config().consentStage.showAppIcon"
              (ngModelChange)="updateConsent('showAppIcon', $event)"
              class="rounded border-gray-300 text-[#4272A5] focus:ring-[#4272A5]"
            />
            <span class="text-xs font-semibold text-gray-600">Mostrar icono de la aplicación solicitante</span>
          </label>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Enlace a Términos del Servicio</label>
              <input
                type="text"
                [ngModel]="config().consentStage.termsAndPrivacyLinks.terms"
                (ngModelChange)="updateConsentLink('terms', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                placeholder="https://..."
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Enlace a Políticas de Privacidad</label>
              <input
                type="text"
                [ngModel]="config().consentStage.termsAndPrivacyLinks.privacy"
                (ngModelChange)="updateConsentLink('privacy', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Descripciones Personalizadas de Permisos (Scopes)</label>
            <div class="space-y-2">
              <div *ngFor="let scope of scopes(); trackBy: trackByKey" class="flex gap-2">
                <span class="px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs font-mono border border-gray-200 shrink-0 select-all">{{ scope.key }}</span>
                <input
                  type="text"
                  [ngModel]="scope.value"
                  (ngModelChange)="updateScopeDescription(scope.key, $event)"
                  class="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION: Errores -->
        <div *ngIf="activeSection() === 'errors'" class="space-y-4">
          <h4 class="text-sm font-bold text-gray-700">Páginas de Error Customizadas</h4>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Título Error 403 (Acceso Denegado)</label>
              <input
                type="text"
                [ngModel]="config().errors.err403Title"
                (ngModelChange)="updateErrors('err403Title', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Mensaje Error 403</label>
              <input
                type="text"
                [ngModel]="config().errors.err403Message"
                (ngModelChange)="updateErrors('err403Message', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Mensaje Error 404 (Página no encontrada)</label>
              <input
                type="text"
                [ngModel]="config().errors.err404Message"
                (ngModelChange)="updateErrors('err404Message', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Mensaje Sesión Expirada</label>
              <input
                type="text"
                [ngModel]="config().errors.sessionExpiredMessage"
                (ngModelChange)="updateErrors('sessionExpiredMessage', $event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              />
            </div>
          </div>
        </div>

        <!-- SECTION: Traducciones y Localización -->
        <div *ngIf="activeSection() === 'localization'" class="space-y-6">
          <div>
            <h4 class="text-sm font-bold text-gray-700 mb-3">Módulo de Localización (Prevención de Inglés Residual)</h4>
            <div class="grid grid-cols-2 gap-4 items-center">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Idioma Forzado</label>
                <select
                  [ngModel]="config().localization.forceLocale"
                  (ngModelChange)="updateLocalization('forceLocale', $event)"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-sans"
                >
                  <option value="es">Español (es)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4">
            <h5 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mensajes de Validación</h5>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-[10px] font-semibold text-gray-600 mb-1 font-sans">Campo Requerido</label>
                <input
                  type="text"
                  [ngModel]="config().localization.validationMessages.requiredField"
                  (ngModelChange)="updateValidationMessage('requiredField', $event)"
                  class="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50"
                />
              </div>
              <div>
                <label class="block text-[10px] font-semibold text-gray-600 mb-1 font-sans">Email Inválido</label>
                <input
                  type="text"
                  [ngModel]="config().localization.validationMessages.invalidEmail"
                  (ngModelChange)="updateValidationMessage('invalidEmail', $event)"
                  class="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50"
                />
              </div>
              <div>
                <label class="block text-[10px] font-semibold text-gray-600 mb-1 font-sans">Contraseñas No Coinciden</label>
                <input
                  type="text"
                  [ngModel]="config().localization.validationMessages.passwordMismatch"
                  (ngModelChange)="updateValidationMessage('passwordMismatch', $event)"
                  class="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-gray-50"
                />
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4">
            <h5 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sustitución de Cadenas del DOM</h5>
            <div class="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Cadena en inglés (ej: Log In)"
                [(ngModel)]="newKey"
                class="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              />
              <input
                type="text"
                placeholder="Sustitución en español (ej: Iniciar Sesión)"
                [(ngModel)]="newVal"
                class="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              />
              <button
                type="button"
                (click)="handleAddTranslation()"
                class="px-4 py-1.5 bg-[#4272A5] text-white text-xs font-bold rounded-lg hover:bg-[#2d5580] transition-colors"
              >
                Agregar
              </button>
            </div>

            <div class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
              <table class="min-w-full bg-white divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase font-sans">Cadena Original (DOM)</th>
                    <th class="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase font-sans">Sustitución en Español</th>
                    <th class="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-xs">
                  <tr *ngFor="let translation of translations(); trackBy: trackByKey">
                    <td class="px-4 py-2 font-mono font-medium text-gray-500 select-all">{{ translation.key }}</td>
                    <td class="px-4 py-2">
                      <input
                        type="text"
                        [ngModel]="translation.value"
                        (ngModelChange)="updateTranslation(translation.key, $event)"
                        class="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50 focus:bg-white"
                      />
                    </td>
                    <td class="px-4 py-2 text-right">
                      <button
                        type="button"
                        (click)="handleRemoveTranslation(translation.key)"
                        class="text-red-500 hover:text-red-700 font-bold transition-colors"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SECTION: User Dashboard -->
        <div *ngIf="activeSection() === 'dashboard'" class="space-y-4">
          <h4 class="text-sm font-bold text-gray-700">Catálogo de Aplicaciones (Launchpad) / Portal</h4>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-center">
              <label class="flex items-center gap-2 cursor-pointer font-sans">
                <input
                  type="checkbox"
                  [ngModel]="config().userDashboard.enableCustomDashboard"
                  (ngModelChange)="updateDashboard('enableCustomDashboard', $event)"
                  class="rounded border-gray-300 text-[#4272A5] focus:ring-[#4272A5]"
                />
                <span class="text-xs font-semibold text-gray-600">Habilitar Launchpad unificado en CASMARTS Core</span>
              </label>
            </div>

            <div class="flex items-center">
              <label class="flex items-center gap-2 cursor-pointer font-sans">
                <input
                  type="checkbox"
                  [ngModel]="config().userDashboard.showActiveSessions"
                  (ngModelChange)="updateDashboard('showActiveSessions', $event)"
                  class="rounded border-gray-300 text-[#4272A5] focus:ring-[#4272A5]"
                />
                <span class="text-xs font-semibold text-gray-600">Mostrar lista de sesiones de usuario activas</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Estilo de las Tarjetas (Cards) de Aplicación</label>
            <select
              [ngModel]="config().userDashboard.cardStyle"
              (ngModelChange)="updateDashboard('cardStyle', $event)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-sans"
            >
              <option value="flat">Estilo Plano (Flat)</option>
              <option value="elevated">Estilo Elevado con Sombra (Elevated)</option>
              <option value="minimal">Estilo Minimalista (Bordes Sutiles)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 font-sans">Orden de Categorías en Launchpad</label>
            <input
              type="text"
              [ngModel]="config().userDashboard.categoryOrder.join(', ')"
              (ngModelChange)="updateCategoryOrder($event)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              placeholder="Core Apps, Analytics, Admin Tools..."
            />
            <p class="text-[10px] text-gray-400 mt-1 font-sans">Ingresa las categorías separadas por comas.</p>
          </div>
        </div>
      </div>

      <!-- Save panel footer button -->
      <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
        <button
          type="button"
          (click)="saveConfiguration()"
          class="px-5 py-2.5 bg-[#4272A5] hover:bg-[#2d5580] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition-colors cursor-pointer font-sans"
        >
          Aplicar Configuración Avanzada
        </button>
      </div>
    </div>
  `
})
/**
 * Componente Angular que gestiona el panel y formulario para la edición de las opciones
 * de configuración de expansión avanzadas de Authentik (MFA, traducción del DOM, avisos de error, dashboard).
 */
export class ExpansionSettingsManagerComponent {
  /** Configuración inicial recibida para poblar el estado local del componente. */
  @Input() set initialConfig(val: AuthentikExpansionConfig | undefined) {
    if (val) {
      this.config.set({ ...DEFAULT_CONFIG, ...val });
    }
  }

  /** Evento emitido cada vez que se modifica y guarda la configuración de expansión. */
  @Output() configChanged = new EventEmitter<AuthentikExpansionConfig>();

  public config = signal<AuthentikExpansionConfig>({ ...DEFAULT_CONFIG });
  public activeSection = signal<'mfa' | 'consent' | 'errors' | 'localization' | 'dashboard'>('localization');

  // computed() memoiza el array derivado y solo recalcula cuando `config`
  // realmente cambia — invocar Object.entries(...).map(...) directo desde el
  // template (*ngFor="let x of getX()") devolvía un array con identidades
  // nuevas en CADA ciclo de detección de cambios; combinado con [(ngModel)]
  // dentro de ese *ngFor, Angular destruía/recreaba los <input> en cada
  // ciclo, lo que retrigueaba otro ciclo de inmediato — un loop sin
  // convergencia que colgaba y terminaba crasheando la pestaña (reproducido
  // 2026-07-06: la página dejaba de responder al abrir esta pestaña).
  public scopes = computed(() =>
    Object.entries(this.config().consentStage.customScopeDescriptions).map(([key, value]) => ({ key, value }))
  );
  public translations = computed(() =>
    Object.entries(this.config().localization.customTranslations).map(([key, value]) => ({ key, value }))
  );

  public newKey = '';
  public newVal = '';

  public tabs = [
    { id: 'consent', label: '🤝 Consentimiento' },
    { id: 'localization', label: '🗣 Traducciones' }
  ];

  trackByKey(_index: number, item: { key: string }): string {
    return item.key;
  }

  setActiveSection(section: 'mfa' | 'consent' | 'errors' | 'localization' | 'dashboard') {
    this.activeSection.set(section);
  }

  updateMfa<K extends keyof AuthentikExpansionConfig['mfaLayout']>(field: K, value: AuthentikExpansionConfig['mfaLayout'][K]) {
    this.config.update(current => ({ ...current, mfaLayout: { ...current.mfaLayout, [field]: value } }));
    this.triggerUpdate();
  }

  updateConsent<K extends keyof AuthentikExpansionConfig['consentStage']>(field: K, value: AuthentikExpansionConfig['consentStage'][K]) {
    this.config.update(current => ({ ...current, consentStage: { ...current.consentStage, [field]: value } }));
    this.triggerUpdate();
  }

  updateConsentLink(field: 'terms' | 'privacy', value: string) {
    this.config.update(current => ({
      ...current,
      consentStage: {
        ...current.consentStage,
        termsAndPrivacyLinks: { ...current.consentStage.termsAndPrivacyLinks, [field]: value }
      }
    }));
    this.triggerUpdate();
  }

  updateErrors<K extends keyof AuthentikExpansionConfig['errors']>(field: K, value: AuthentikExpansionConfig['errors'][K]) {
    this.config.update(current => ({ ...current, errors: { ...current.errors, [field]: value } }));
    this.triggerUpdate();
  }

  updateLocalization<K extends keyof Omit<AuthentikExpansionConfig['localization'], 'customTranslations' | 'validationMessages'>>(
    field: K,
    value: AuthentikExpansionConfig['localization'][K]
  ) {
    this.config.update(current => ({ ...current, localization: { ...current.localization, [field]: value } }));
    this.triggerUpdate();
  }

  updateValidationMessage<K extends keyof AuthentikExpansionConfig['localization']['validationMessages']>(
    field: K,
    value: string
  ) {
    this.config.update(current => ({
      ...current,
      localization: {
        ...current.localization,
        validationMessages: { ...current.localization.validationMessages, [field]: value }
      }
    }));
    this.triggerUpdate();
  }

  updateDashboard<K extends keyof AuthentikExpansionConfig['userDashboard']>(field: K, value: AuthentikExpansionConfig['userDashboard'][K]) {
    this.config.update(current => ({ ...current, userDashboard: { ...current.userDashboard, [field]: value } }));
    this.triggerUpdate();
  }

  updateTranslation(key: string, newValue: string) {
    this.config.update(current => ({
      ...current,
      localization: {
        ...current.localization,
        customTranslations: { ...current.localization.customTranslations, [key]: newValue }
      }
    }));
    this.triggerUpdate();
  }

  updateScopeDescription(key: string, newValue: string) {
    this.config.update(current => ({
      ...current,
      consentStage: {
        ...current.consentStage,
        customScopeDescriptions: { ...current.consentStage.customScopeDescriptions, [key]: newValue }
      }
    }));
    this.triggerUpdate();
  }

  updateCategoryOrder(val: string) {
    this.config.update(current => ({
      ...current,
      userDashboard: { ...current.userDashboard, categoryOrder: val.split(',').map(s => s.trim()) }
    }));
    this.triggerUpdate();
  }

  handleAddTranslation() {
    const key = this.newKey.trim();
    if (!key) return;
    const value = this.newVal.trim();
    this.config.update(current => ({
      ...current,
      localization: {
        ...current.localization,
        customTranslations: { ...current.localization.customTranslations, [key]: value }
      }
    }));
    this.newKey = '';
    this.newVal = '';
    this.triggerUpdate();
  }

  handleRemoveTranslation(key: string) {
    this.config.update(current => {
      const customTranslations = { ...current.localization.customTranslations };
      delete customTranslations[key];
      return { ...current, localization: { ...current.localization, customTranslations } };
    });
    this.triggerUpdate();
  }

  triggerUpdate() {
    this.configChanged.emit(this.config());
  }

  saveConfiguration() {
    this.triggerUpdate();
  }
}
