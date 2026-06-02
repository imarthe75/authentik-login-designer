import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const adminKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const cloned = req.clone({
    setHeaders: { 'X-Admin-Key': environment.adminKey }
  });
  return next(cloned);
};
