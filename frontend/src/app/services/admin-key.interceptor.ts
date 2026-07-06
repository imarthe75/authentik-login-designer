import { HttpInterceptorFn } from '@angular/common/http';

// La autenticación admin viaja como cookie de sesión HttpOnly emitida por
// /api/v1/auth/login (ver AdminAuthService) — nunca como una clave estática
// embebida en el bundle (el `environment.adminKey` que existía antes se
// compilaba en texto plano en el JS servido a cualquier visitante, sin login
// alguno, con el mismo valor hardcodeado desde el primer commit del repo).
export const adminKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const cloned = req.clone({ withCredentials: true });
  return next(cloned);
};
