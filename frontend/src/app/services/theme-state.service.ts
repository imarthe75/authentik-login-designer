import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Theme, SavePhase } from '../models/theme.model';
import { ThemeApiService } from './theme-api.service';

const DEFAULT_THEME: Theme = {
  authentik_flow_slug: 'default-authentication-flow',
  authentik_app_slug: null,
  display_name: 'CASMARTS Portal',
  system_name: 'CASMARTS<br>Core',
  system_subtitle: 'Gobierno del estado de México',
  layout_position: 'left',
  name_align: 'center',
  subtitle_align: 'center',
  privacy_align: 'center',
  primary_color: '#4272A5',
  hover_color: '#2d5580',
  card_bg_color: '#FFFFFF',
  panel_bg_color: '#F6F9FD',
  bg_type: 'gradient',
  bg_flat_color: null,
  bg_gradient_from: '#c8c4bc',
  bg_gradient_to: '#a09890',
  bg_image_base64: null,
  bg_opacity: 1.0,
  form_opacity: 0.55,
  form_height_pct: null,
  logos_opacity: 0.55,
  logos_height_pct: null,
  logo_top_base64: null,
  logo_bottom_base64: null,
  logo_top_text: null,
  logo_bottom_text: null,
  privacy_pdf_url: '/static/aviso_privacidad.pdf',
  is_active: true
};

@Injectable({ providedIn: 'root' })
export class ThemeStateService {
  private readonly api = inject(ThemeApiService);

  private readonly _currentSlug = signal<string>('default-authentication-flow');
  private readonly _theme = signal<Theme>({ ...DEFAULT_THEME });
  private readonly _isDirty = signal<boolean>(false);
  private readonly _savePhase = signal<SavePhase>('idle');
  private readonly _deployError = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly currentSlug = this._currentSlug.asReadonly();
  readonly theme = this._theme.asReadonly();
  readonly isDirty = this._isDirty.asReadonly();
  readonly savePhase = this._savePhase.asReadonly();
  readonly deployError = this._deployError.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isSaving = computed(() =>
    this._savePhase() === 'saving' || this._savePhase() === 'deploying'
  );

  async loadTheme(slug: string, appSlug?: string | null): Promise<void> {
    this._error.set(null);
    this._currentSlug.set(slug);
    try {
      if (appSlug) {
        try {
          const data = await firstValueFrom(this.api.getTheme(slug, appSlug));
          this._theme.set(data);
          this._isDirty.set(false);
          this._savePhase.set('idle');
          this._deployError.set(null);
          return;
        } catch {
          try {
            const globalData: Theme = await firstValueFrom(this.api.getTheme(slug, null));
            const appTheme: Theme = { ...globalData, authentik_app_slug: appSlug,
              display_name: `${globalData.display_name} - ${appSlug}` };
            delete (appTheme as any).id;
            this._theme.set(appTheme);
            this._isDirty.set(true);
            this._savePhase.set('idle');
            this._deployError.set(null);
            return;
          } catch { /* fall to default below */ }
        }
      } else {
        try {
          const data = await firstValueFrom(this.api.getTheme(slug, null));
          this._theme.set(data);
          this._isDirty.set(false);
          this._savePhase.set('idle');
          this._deployError.set(null);
          return;
        } catch { /* fall to default below */ }
      }
      this._theme.set({
        ...DEFAULT_THEME,
        authentik_flow_slug: slug,
        authentik_app_slug: appSlug ?? null,
        display_name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      });
      this._isDirty.set(true);
      this._savePhase.set('idle');
      this._deployError.set(null);
    } catch (err: any) {
      this._theme.set({
        ...DEFAULT_THEME,
        authentik_flow_slug: slug,
        authentik_app_slug: appSlug ?? null,
        display_name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      });
      this._isDirty.set(true);
    }
  }

  updateField<K extends keyof Theme>(key: K, value: Theme[K]): void {
    this._theme.update((t: Theme) => ({ ...t, [key]: value }));
    this._isDirty.set(true);
    this._savePhase.set('idle');
    this._deployError.set(null);
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
  }

  setIsDirty(dirty: boolean): void {
    this._isDirty.set(dirty);
  }

  async uploadFileField(
    key: 'logo_top_base64' | 'logo_bottom_base64' | 'bg_image_base64',
    file: File
  ): Promise<void> {
    try {
      const base64 = await this.fileToBase64(file);
      this.updateField(key, base64);
    } catch {
      this._error.set('Error converting file to Base64.');
    }
  }

  async saveTheme(): Promise<void> {
    let phase: SavePhase = 'idle';
    try {
      this._error.set(null);
      this._deployError.set(null);
      phase = 'saving';
      this._savePhase.set('saving');
      const saved = await firstValueFrom(this.api.upsertTheme(this._theme()));
      this._theme.set(saved);
      this._isDirty.set(false);
      phase = 'deploying';
      this._savePhase.set('deploying');
      await firstValueFrom(this.api.invalidatePublicCache(this._theme().authentik_flow_slug));
      await firstValueFrom(this.api.deployTheme(this._theme().authentik_flow_slug));
      this._savePhase.set('done');
    } catch (err: any) {
      const msg = err?.error?.detail ?? err?.message ?? 'Error al guardar o desplegar.';
      if (phase === 'saving') {
        this._error.set(msg);
        this._savePhase.set('idle');
      } else {
        this._deployError.set(msg);
        this._savePhase.set('deploy_error');
      }
    }
  }

  async retryDeploy(): Promise<void> {
    try {
      this._deployError.set(null);
      this._savePhase.set('deploying');
      await firstValueFrom(this.api.deployTheme(this._theme().authentik_flow_slug));
      this._savePhase.set('done');
    } catch (err: any) {
      this._deployError.set(err?.error?.detail ?? err?.message ?? 'Error al desplegar.');
      this._savePhase.set('deploy_error');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }
}
