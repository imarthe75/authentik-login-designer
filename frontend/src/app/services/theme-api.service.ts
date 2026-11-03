import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Theme, FontPreset } from '../models/theme.model';

/** Swatch de la paleta sugerida del tenant (ver TenantSettings.brand_palette). */
export interface BrandPaletteSwatch {
  name: string;
  color: string;
  hover: string;
}

export interface TenantSettings {
  default_app_url: string | null;
  brand_palette: BrandPaletteSwatch[] | null;
  primary_color: string;
  secondary_color: string;
}

/** Enlace entre una Application de Authentik y el tenant de este backend. */
export interface TenantApplicationLink {
  id: string;
  tenant_id: string;
  application_slug: string;
  application_name: string;
  link_source: 'group_convention' | 'manual';
  is_confirmed: boolean;
}

export interface TenantApplicationsResponse {
  linked: TenantApplicationLink[];
  unassigned: { slug: string; name: string }[];
}

@Injectable({ providedIn: 'root' })
export class ThemeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  getThemes(tenantId?: string | null, skip = 0, limit = 50): Observable<Theme[]> {
    let params = new HttpParams()
      .set('skip', skip)
      .set('limit', limit);
    if (tenantId) params = params.set('tenant_id', tenantId);
    return this.http.get<Theme[]>(`${this.base}/v1/themes`, { params });
  }

  getTheme(slug: string, appSlug?: string | null, tenantId?: string | null): Observable<Theme> {
    let params = new HttpParams();
    if (appSlug) params = params.set('app_slug', appSlug);
    if (tenantId) params = params.set('tenant_id', tenantId);
    return this.http.get<Theme>(`${this.base}/v1/themes/${slug}`, { params });
  }

  upsertTheme(theme: Theme, tenantId?: string | null): Observable<Theme> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenant_id', tenantId);
    return this.http.post<Theme>(`${this.base}/v1/themes`, theme, { params });
  }

  patchTheme(slug: string, partial: Partial<Theme>): Observable<Theme> {
    return this.http.patch<Theme>(`${this.base}/v1/themes/${slug}`, partial);
  }

  deleteTheme(slug: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/v1/themes/${slug}`);
  }

  deployTheme(flowSlug: string): Observable<{ status: string; path: string }> {
    return this.http.post<{ status: string; path: string }>(
      `${this.base}/v1/themes/${flowSlug}/deploy`, {}
    );
  }

  invalidatePublicCache(slug: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/v1/public/theme/invalidate-cache/${slug}`, {}
    );
  }

  getAuthentikApplications(tenantId?: string | null): Observable<{ slug: string; name: string }[]> {
    const url = tenantId
      ? `${this.base}/v1/themes/authentik/applications?tenant_id=${tenantId}`
      : `${this.base}/v1/themes/authentik/applications`;
    return this.http.get<{ slug: string; name: string }[]>(url);
  }

  sendTestEmail(flowSlug: string, eventType: string, toEmail: string, appSlug?: string | null, displayName?: string | null): Observable<{ status: string; to: string; subject: string }> {
    return this.http.post<{ status: string; to: string; subject: string }>(
      `${this.base}/v1/themes/${flowSlug}/emails/test`,
      { to_email: toEmail, event_type: eventType, app_slug: appSlug || null, display_name: displayName || null }
    );
  }

  /**
   * A diferencia de sendTestEmail (render local + SMTP directo), dispara el
   * mecanismo real de Authentik para el evento (EmailStage real, o un
   * evento real que atraviesa el puente de webhooks).
   */
  sendTestEmailReal(flowSlug: string, eventType: string, username?: string | null): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base}/v1/themes/${flowSlug}/emails/test-real`,
      { event_type: eventType, username: username || null }
    );
  }

  getEmailPreview(flowSlug: string, eventType: string, appSlug?: string | null): Observable<string> {
    let params = new HttpParams();
    if (appSlug) params = params.set('app_slug', appSlug);
    return this.http.get(
      `${this.base}/v1/themes/${flowSlug}/emails/preview/${eventType}`,
      { params, responseType: 'text' }
    );
  }

  /**
   * Contenido por-defecto real del backend para un evento (extraído del
   * .j2), usado cuando el tenant no personalizó ese correo — sin esto el
   * editor se ve vacío mientras el preview sí muestra contenido real.
   */
  getDefaultEmailBody(flowSlug: string, eventType: string, appSlug?: string | null): Observable<{ subject: string; body_html: string }> {
    let params = new HttpParams();
    if (appSlug) params = params.set('app_slug', appSlug);
    return this.http.get<{ subject: string; body_html: string }>(
      `${this.base}/v1/themes/${flowSlug}/emails/default-body/${eventType}`,
      { params }
    );
  }

  /**
   * Config a nivel tenant (no por tema/app): default_app_url (a dónde se
   * manda a un usuario no-admin sin app específica en mente, ver
   * custom_authentik.js), primary_color/secondary_color (acento del propio
   * panel) y brand_palette (swatches sugeridas del selector rápido de
   * color). Este backend es single-tenant — siempre resuelve al mismo
   * tenant fijo, sin parámetro tenant_id.
   */
  getTenantSettings(): Observable<TenantSettings> {
    return this.http.get<TenantSettings>(`${this.base}/v1/tenant/settings`);
  }

  /** PATCH parcial: solo envía las claves presentes en `partial` (el backend
   * no pisa las que no vinieron — ver `exclude_unset` en update_tenant_settings). */
  updateTenantSettings(partial: Partial<{
    default_app_url: string | null;
    primary_color: string;
    secondary_color: string;
    brand_palette: BrandPaletteSwatch[] | null;
  }>): Observable<TenantSettings> {
    return this.http.patch<TenantSettings>(`${this.base}/v1/tenant/settings`, partial);
  }

  /** Lista curada de fuentes seleccionables (selector de tipografía del ConfigPanel). */
  getFontPresets(): Observable<FontPreset[]> {
    return this.http.get<FontPreset[]>(`${this.base}/v1/themes/font-presets`);
  }

  /** Pestaña "Aplicaciones": enlaces confirmados del tenant + apps de
   * Authentik aún sin asignar (ni por convención de grupo ni a mano). */
  getTenantApplications(): Observable<TenantApplicationsResponse> {
    return this.http.get<TenantApplicationsResponse>(`${this.base}/v1/tenant/applications`);
  }

  createTenantApplication(applicationSlug: string, applicationName?: string | null): Observable<TenantApplicationLink> {
    return this.http.post<TenantApplicationLink>(`${this.base}/v1/tenant/applications`, {
      application_slug: applicationSlug,
      application_name: applicationName || null,
    });
  }

  deleteTenantApplication(linkId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/v1/tenant/applications/${linkId}`);
  }

  /** Catálogo real de variables (con fallback estático si falla — ver DEFAULT_VARIABLES en email-editor-split). */
  getEmailTemplates(): Observable<{ variables: { variable: string; description: string }[]; event_types: string[] }> {
    return this.http.get<{ variables: { variable: string; description: string }[]; event_types: string[] }>(
      `${this.base}/v1/public/email-templates`
    );
  }

  /**
   * Resuelve el tenant actual (siempre el mismo, backend single-tenant) —
   * mismo contrato HTTP que el manager (React) en TenantContext.tsx.
   * El header X-Tenant-Domain se envía por paridad de firma pero este
   * backend lo ignora (ver routers/tenant.py: resolve_tenant no lo lee).
   */
  resolveTenant(hostname: string): Observable<{
    tenant_id: string; tenant_name: string; domain_pattern: string;
    primary_color: string; secondary_color: string;
  }> {
    return this.http.get<{
      tenant_id: string; tenant_name: string; domain_pattern: string;
      primary_color: string; secondary_color: string;
    }>(`${this.base}/v1/tenant/resolve`, {
      headers: { 'X-Tenant-Domain': hostname }
    });
  }

  /** Lista de tenants activos — en este backend siempre devuelve 1 fila (el tenant fijo). */
  getTenants(): Observable<{
    tenant_id: string; tenant_name: string; domain_pattern: string;
    primary_color: string; secondary_color: string;
  }[]> {
    return this.http.get<{
      tenant_id: string; tenant_name: string; domain_pattern: string;
      primary_color: string; secondary_color: string;
    }[]>(`${this.base}/v1/tenant/list`);
  }
}
