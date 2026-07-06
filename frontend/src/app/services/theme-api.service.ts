import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Theme } from '../models/theme.model';

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
   * Config a nivel tenant (no por tema/app) — hoy solo default_app_url,
   * a dónde se manda a un usuario no-admin sin app específica en mente
   * (ver custom_authentik.js). Se resuelve por el tenant del request
   * (header X-Tenant-Domain inyectado por el gateway), no por flowSlug.
   */
  getTenantSettings(): Observable<{ default_app_url: string | null }> {
    return this.http.get<{ default_app_url: string | null }>(`${this.base}/v1/tenant/settings`);
  }

  updateTenantSettings(defaultAppUrl: string | null): Observable<{ default_app_url: string | null }> {
    return this.http.patch<{ default_app_url: string | null }>(
      `${this.base}/v1/tenant/settings`,
      { default_app_url: defaultAppUrl }
    );
  }

  /** Catálogo real de variables (con fallback estático si falla — ver DEFAULT_VARIABLES en email-editor-split). */
  getEmailTemplates(): Observable<{ variables: { variable: string; description: string }[]; event_types: string[] }> {
    return this.http.get<{ variables: { variable: string; description: string }[]; event_types: string[] }>(
      `${this.base}/v1/public/email-templates`
    );
  }

  /**
   * Resuelve el tenant actual por hostname (header X-Tenant-Domain), igual
   * que el manager (React) en TenantContext.tsx. NOTA: el backend de este
   * designer (authentik-login-designer/backend) NO tiene montado un router
   * /api/v1/tenant/* — a diferencia del manager, que sí lo tiene en
   * app/routers/admin.py (tenant_router). Este método reproduce el mismo
   * contrato HTTP que React consume, pero hoy resolverá en 404 contra este
   * backend hasta que se porte el endpoint correspondiente (ver
   * TenantStateService, que ya asume esto y cae a un tenant por defecto).
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

  /** Lista de tenants disponibles (ver nota en resolveTenant sobre disponibilidad del backend). */
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
