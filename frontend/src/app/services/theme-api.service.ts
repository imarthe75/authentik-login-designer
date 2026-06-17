import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Theme } from '../models/theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  getThemes(skip = 0, limit = 50): Observable<Theme[]> {
    const params = new HttpParams()
      .set('skip', skip)
      .set('limit', limit);
    return this.http.get<Theme[]>(`${this.base}/v1/themes`, { params });
  }

  getTheme(slug: string, appSlug?: string | null): Observable<Theme> {
    let params = new HttpParams();
    if (appSlug) params = params.set('app_slug', appSlug);
    return this.http.get<Theme>(`${this.base}/v1/themes/${slug}`, { params });
  }

  upsertTheme(theme: Theme): Observable<Theme> {
    return this.http.post<Theme>(`${this.base}/v1/themes`, theme);
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

  getAuthentikApplications(): Observable<{ slug: string; name: string }[]> {
    return this.http.get<{ slug: string; name: string }[]>(
      `${this.base}/v1/themes/authentik/applications`
    );
  }

  sendTestEmail(flowSlug: string, eventType: string, toEmail: string, appSlug?: string | null): Observable<{ status: string; to: string; subject: string }> {
    return this.http.post<{ status: string; to: string; subject: string }>(
      `${this.base}/v1/themes/${flowSlug}/emails/test`,
      { to_email: toEmail, event_type: eventType, app_slug: appSlug || null }
    );
  }

  getEmailPreview(flowSlug: string, eventType: string): Observable<string> {
    return this.http.get(
      `${this.base}/v1/themes/${flowSlug}/emails/preview/${eventType}`,
      { responseType: 'text' }
    );
  }
}
