import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  readonly authenticated = signal(false);
  readonly checking = signal(true);

  async checkStatus(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ authenticated: boolean }>(`${this.base}/v1/auth/status`, { withCredentials: true })
      );
      this.authenticated.set(!!res.authenticated);
    } catch {
      this.authenticated.set(false);
    } finally {
      this.checking.set(false);
    }
  }

  async login(adminKey: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/v1/auth/login`, { admin_key: adminKey }, { withCredentials: true })
    );
    this.authenticated.set(true);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/v1/auth/logout`, {}, { withCredentials: true }));
    this.authenticated.set(false);
  }
}
