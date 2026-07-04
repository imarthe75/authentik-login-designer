import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PasswordPolicyApiService } from '../../services/password-policy-api.service';
import { PasswordPolicy, PasswordPolicyUpdate } from '../../models/password-policy.model';

const ZXCVBN_LABELS: Record<number, string> = {
  0: '0 — Muy débil (acepta casi cualquier cosa)',
  1: '1 — Débil',
  2: '2 — Razonable',
  3: '3 — Fuerte (recomendado)',
  4: '4 — Muy fuerte',
};

// Espejo de _format_link_expiry_text en admin.py (login-manager) — mismo
// texto que verá el usuario en el correo, para la vista previa en vivo.
export function formatLinkExpiryText(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  }
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

function buildSuggestedHelpText(p: PasswordPolicyUpdate): string {
  const parts: string[] = [`Mínimo ${p.length_min ?? 10} caracteres`];
  const reqs: string[] = [];
  if ((p.amount_uppercase ?? 0) > 0) reqs.push(`${p.amount_uppercase} mayúscula${(p.amount_uppercase as number) > 1 ? 's' : ''}`);
  if ((p.amount_lowercase ?? 0) > 0) reqs.push(`${p.amount_lowercase} minúscula${(p.amount_lowercase as number) > 1 ? 's' : ''}`);
  if ((p.amount_digits ?? 0) > 0) reqs.push(`${p.amount_digits} número${(p.amount_digits as number) > 1 ? 's' : ''}`);
  if ((p.amount_symbols ?? 0) > 0) reqs.push(`${p.amount_symbols} símbolo${(p.amount_symbols as number) > 1 ? 's' : ''}`);
  if (reqs.length) parts.push(`incluye al menos ${reqs.join(', ')}`);
  if (p.check_zxcvbn) parts.push(`evita palabras comunes, nombres o patrones predecibles (fechas, secuencias como '1234')`);
  return parts.join(', ') + '.';
}

@Component({
  selector: 'app-password-policy-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './password-policy-panel.component.html',
})
export class PasswordPolicyPanelComponent implements OnInit {
  private readonly api = inject(PasswordPolicyApiService);

  readonly zxcvbnLabels = ZXCVBN_LABELS;
  readonly zxcvbnLevels = [0, 1, 2, 3, 4];
  readonly formatLinkExpiryText = formatLinkExpiryText;

  readonly policy = signal<PasswordPolicy | null>(null);
  readonly draft = signal<PasswordPolicyUpdate>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastSyncError = signal<string | null>(null);

  readonly isDirty = computed(() => {
    const p = this.policy();
    if (!p) return false;
    return JSON.stringify(this.draft()) !== JSON.stringify(p);
  });

  async ngOnInit(): Promise<void> {
    try {
      const p = await firstValueFrom(this.api.get());
      this.policy.set(p);
      this.draft.set(p);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al cargar la política de contraseña.');
    } finally {
      this.loading.set(false);
    }
  }

  updateField<K extends keyof PasswordPolicyUpdate>(key: K, value: PasswordPolicyUpdate[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  onNumberField(key: keyof PasswordPolicyUpdate, event: Event, min = 0, max = 20): void {
    const raw = Number((event.target as HTMLInputElement).value) || 0;
    this.updateField(key, Math.max(min, Math.min(max, raw)) as any);
  }

  onTextField(key: keyof PasswordPolicyUpdate, event: Event): void {
    this.updateField(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value as any);
  }

  onCheckboxField(key: keyof PasswordPolicyUpdate, event: Event): void {
    this.updateField(key, (event.target as HTMLInputElement).checked as any);
  }

  generateHelpText(): void {
    this.updateField('help_text', buildSuggestedHelpText(this.draft()));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await firstValueFrom(this.api.update(this.draft()));
      this.policy.set(updated);
      this.draft.set(updated);
      this.lastSyncError.set(updated.sync_error);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al guardar la política de contraseña.');
    } finally {
      this.saving.set(false);
    }
  }

  async resync(): Promise<void> {
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(this.api.resync());
      this.policy.set(updated);
      this.draft.set(updated);
      this.lastSyncError.set(updated.sync_error);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al reintentar la sincronización.');
    } finally {
      this.saving.set(false);
    }
  }
}
