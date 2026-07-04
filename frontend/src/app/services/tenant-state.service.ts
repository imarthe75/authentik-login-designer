import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Tenant, DEFAULT_TENANT } from '../models/tenant.model';
import { ThemeApiService } from './theme-api.service';

/**
 * Puerto Angular de TenantContext.tsx (manager/React). Resuelve el tenant
 * actual por hostname y expone la lista de tenants disponibles.
 *
 * BLOCKER conocido: el backend de authentik-login-designer no tiene montado
 * ningún router /api/v1/tenant/* (a diferencia del backend del manager, que
 * sí lo expone en app/routers/admin.py vía tenant_router). Este servicio
 * llama a esos mismos endpoints por si algún día se portan, pero hoy
 * resolverán en error de red / 404 — por diseño, cae siempre a
 * DEFAULT_TENANT igual que hace React (ver detectAndResolveTenant en
 * TenantContext.tsx), así que el resto de la UI nunca se rompe por esto.
 */
@Injectable({ providedIn: 'root' })
export class TenantStateService {
  private readonly api = inject(ThemeApiService);

  private readonly _tenant = signal<Tenant>({ ...DEFAULT_TENANT });
  private readonly _hostname = signal<string>(
    typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost'
  );
  private readonly _loading = signal<boolean>(true);
  private readonly _error = signal<string | null>(null);

  private readonly _tenants = signal<Tenant[]>([]);
  private readonly _tenantsLoading = signal<boolean>(false);
  private readonly _tenantsError = signal<string | null>(null);

  readonly tenant = this._tenant.asReadonly();
  readonly hostname = this._hostname.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly tenants = this._tenants.asReadonly();
  readonly tenantsLoading = this._tenantsLoading.asReadonly();
  readonly tenantsError = this._tenantsError.asReadonly();

  /** Detecta el hostname actual y resuelve el tenant correspondiente contra el backend. */
  async resolveTenant(): Promise<void> {
    const detectedHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    this._hostname.set(detectedHostname);
    this._loading.set(true);
    try {
      const data = await firstValueFrom(this.api.resolveTenant(detectedHostname));
      this._tenant.set(data);
      this._error.set(null);
    } catch (err: any) {
      this._tenant.set({ ...DEFAULT_TENANT });
      const msg = err?.message || err?.error?.detail || 'Unknown error';
      this._error.set(msg);
      console.debug('Tenant resolution fallback:', msg);
    } finally {
      this._loading.set(false);
    }
  }

  /** Carga la lista de tenants disponibles (para el selector). */
  async loadTenants(): Promise<void> {
    this._tenantsLoading.set(true);
    this._tenantsError.set(null);
    try {
      const data = await firstValueFrom(this.api.getTenants());
      this._tenants.set(data);
    } catch (err: any) {
      const msg = err?.message || err?.error?.detail || 'Error al cargar tenants';
      this._tenantsError.set(msg);
      console.error('Tenant fetch error:', msg);
    } finally {
      this._tenantsLoading.set(false);
    }
  }
}
