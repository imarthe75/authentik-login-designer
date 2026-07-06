import { ApplicationConfig, importProvidersFrom, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { LucideAngularModule, Check, ChevronDown, Plus } from 'lucide-angular';
import { adminKeyInterceptor } from './app/services/admin-key.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([adminKeyInterceptor])),
    // Sin este provider global, <lucide-icon name="..."> falla en runtime con
    // "icon has not been provided by any available icon providers" — cada
    // ícono usado en la app (grep 'lucide-icon name=') debe registrarse aquí.
    importProvidersFrom(LucideAngularModule.pick({ Check, ChevronDown, Plus })),
  ]
};
