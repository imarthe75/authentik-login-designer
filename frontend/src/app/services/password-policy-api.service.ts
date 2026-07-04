import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PasswordPolicy, PasswordPolicyUpdate } from '../models/password-policy.model';

// Política global (Authentik solo tiene una PasswordPolicy real hoy) — a
// diferencia de ThemeApiService, no depende de tenant ni de flow_slug.
@Injectable({ providedIn: 'root' })
export class PasswordPolicyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  get(): Observable<PasswordPolicy> {
    return this.http.get<PasswordPolicy>(`${this.base}/v1/password-policy`);
  }

  update(patch: PasswordPolicyUpdate): Observable<PasswordPolicy> {
    return this.http.patch<PasswordPolicy>(`${this.base}/v1/password-policy`, patch);
  }

  resync(): Observable<PasswordPolicy> {
    return this.http.post<PasswordPolicy>(`${this.base}/v1/password-policy/resync`, {});
  }
}
