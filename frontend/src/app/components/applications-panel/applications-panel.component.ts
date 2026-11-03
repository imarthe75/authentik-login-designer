import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ThemeApiService, TenantApplicationLink } from '../../services/theme-api.service';

/**
 * Puerto Angular de ApplicationsTab.tsx (manager/React), adaptado a un
 * backend single-tenant: no recibe `selectedTenantId` — list/create/delete
 * siempre operan sobre el único tenant de Designer (ver routers/tenant.py).
 */
@Component({
  selector: 'app-applications-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './applications-panel.component.html',
})
export class ApplicationsPanelComponent implements OnInit {
  private readonly api = inject(ThemeApiService);

  readonly linked = signal<TenantApplicationLink[]>([]);
  readonly unassigned = signal<{ slug: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busySlug = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      const data = await firstValueFrom(this.api.getTenantApplications());
      this.linked.set(data.linked);
      this.unassigned.set(data.unassigned);
    } catch (err: any) {
      this.error.set(err?.error?.detail || err?.message || 'Error al cargar aplicaciones');
    } finally {
      this.loading.set(false);
    }
  }

  async assign(app: { slug: string; name: string }): Promise<void> {
    try {
      this.busySlug.set(app.slug);
      await firstValueFrom(this.api.createTenantApplication(app.slug, app.name));
      await this.load();
    } catch (err: any) {
      this.error.set(err?.error?.detail || err?.message || 'Error al asignar la aplicación');
    } finally {
      this.busySlug.set(null);
    }
  }

  async unlink(link: TenantApplicationLink): Promise<void> {
    try {
      this.busySlug.set(link.application_slug);
      await firstValueFrom(this.api.deleteTenantApplication(link.id));
      await this.load();
    } catch (err: any) {
      this.error.set(err?.error?.detail || err?.message || 'Error al quitar la aplicación');
    } finally {
      this.busySlug.set(null);
    }
  }
}
