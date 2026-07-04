import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeStateService } from './services/theme-state.service';
import { ThemeApiService } from './services/theme-api.service';
import { TenantStateService } from './services/tenant-state.service';
import { Theme, EmailEventType } from './models/theme.model';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector.component';
import { LoginPreviewComponent } from './components/login-preview/login-preview.component';
import { ConfigPanelComponent } from './components/config-panel/config-panel.component';
import { EmailEditorSplitComponent } from './components/email-editor-split/email-editor-split.component';
import { TenantSelectorComponent } from './components/tenant-selector/tenant-selector.component';
import { PasswordPolicyPanelComponent } from './components/password-policy-panel/password-policy-panel.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, ThemeSelectorComponent, LoginPreviewComponent, ConfigPanelComponent,
    EmailEditorSplitComponent, TenantSelectorComponent, PasswordPolicyPanelComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  protected readonly state = inject(ThemeStateService);
  private readonly api = inject(ThemeApiService);
  protected readonly tenantState = inject(TenantStateService);

  readonly themesList = signal<Theme[]>([]);
  readonly authentikApps = signal<{ slug: string; name: string }[]>([]);
  readonly loading = signal<boolean>(true);

  // Multi-tenancy: id del tenant seleccionado en el selector del header
  // (puerto de selectedTenantId/onSelectTenant en App.tsx del manager).
  readonly selectedTenantId = signal<string | null>(null);

  // Vista Correo: editor de plantillas de email — necesita el ancho completo
  // (split editor+preview con drawers), no cabe en el sidebar de 380px de
  // app-config-panel, así que reemplaza TODO el <main> mientras está activa
  // (mismo patrón que React: vista de nivel superior, no anidada).
  readonly emailEditorOpen = signal(false);
  readonly emailActiveEvent = signal<EmailEventType>('password_reset');

  // Política de Contraseña: configuración GLOBAL de Authentik (una sola
  // PasswordPolicy real, no una por tenant) — a diferencia de todo lo demás
  // en este componente, es alcanzable SIN seleccionar un tenant primero.
  readonly passwordPolicyOpen = signal(false);

  async ngOnInit(): Promise<void> {
    // Nada (temas, aplicaciones, panel principal) debe activarse hasta que
    // se seleccione un tenant explícitamente — solo se resuelve el tenant
    // para mostrarlo en el header/selector, pero no se cargan temas ni apps
    // todavía (ver handleSelectTenant).
    this.loading.set(false);
    await this.tenantState.resolveTenant();
  }

  handleSelectTenant(event: { tenantId: string; tenantName: string }): void {
    this.selectedTenantId.set(event.tenantId);
    this.fetchApps();
    this.fetchThemes();
  }

  private async fetchApps(): Promise<void> {
    try {
      const apps = await firstValueFrom(this.api.getAuthentikApplications());
      this.authentikApps.set(apps);
    } catch (err) {
      console.error('Error fetching Authentik applications list:', err);
    }
  }

  async fetchThemes(): Promise<void> {
    try {
      this.loading.set(true);
      const data = await firstValueFrom(this.api.getThemes());
      this.themesList.set(data);
      if (data.length > 0) {
        const found = data.find(t => t.authentik_flow_slug === this.state.currentSlug());
        if (found) {
          this.state.setTheme(found);
          this.state.setIsDirty(false);
        } else {
          await this.state.loadTheme(data[0].authentik_flow_slug);
        }
      } else {
        const seed = this.buildSeedTheme();
        this.themesList.set([seed]);
        this.state.setTheme(seed);
        this.state.setIsDirty(false);
      }
    } catch (err) {
      console.error('Error loading theme configurations list:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async handleSelectSlug(slug: string): Promise<void> {
    if (this.state.isDirty()) {
      if (!confirm('Tienes cambios sin guardar en este portal. ¿Deseas descartarlos y cambiar de portal?')) return;
    }
    await this.state.loadTheme(slug);
  }

  async handleChangeApp(appSlug: string | null): Promise<void> {
    if (this.state.isDirty()) {
      if (!confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y cambiar de aplicación?')) return;
    }
    await this.state.loadTheme(this.state.theme().authentik_flow_slug, appSlug);
  }

  handleCreateTheme(payload: { displayName: string; flowSlug: string }): void {
    const newTheme: Theme = { ...this.buildSeedTheme(),
      authentik_flow_slug: payload.flowSlug,
      display_name: payload.displayName
    };
    this.themesList.update(prev => [newTheme, ...prev]);
    this.state.setTheme(newTheme);
    this.state.setIsDirty(true);
  }

  async handleSave(): Promise<void> {
    await this.state.saveTheme();
    await this.fetchThemes();
  }

  private buildSeedTheme(): Theme {
    return {
      authentik_flow_slug: 'default-authentication-flow',
      authentik_app_slug: null,
      display_name: 'CASMARTS Core Portal',
      system_name: 'CASMARTS<br>Core',
      system_subtitle: 'Gobierno del estado de México',
      layout_position: 'left',
      name_align: 'center', subtitle_align: 'center', privacy_align: 'center',
      primary_color: '#4272A5', hover_color: '#2d5580',
      card_bg_color: '#FFFFFF', panel_bg_color: '#F6F9FD',
      bg_type: 'gradient', bg_flat_color: null,
      bg_gradient_from: '#c8c4bc', bg_gradient_to: '#a09890',
      bg_image_base64: null, bg_opacity: 1.0,
      form_opacity: 0.55, form_height_pct: null,
      logos_opacity: 0.55, logos_height_pct: null,
      logo_top_base64: null, logo_bottom_base64: null,
      logo_top_text: null, logo_bottom_text: null,
      privacy_pdf_url: '/static/aviso_privacidad.pdf',
      is_active: true,
      allow_self_registration: false,
      require_email_verification: false,
      show_social_google: false,
      show_social_microsoft: false,
      show_social_gov_id: false,
      show_forgot_password: true,
      show_logos_panel: true,
      show_password_toggle: true,
      show_system_name: true,
      show_system_subtitle: true,
      show_field_labels: true,
      show_app_message: true,
      email_footer_text: null,
      email_template_type: 'integrated',
      custom_messages: {}
    };
  }
}
