import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';

// bypassSecurityTrustHtml por si solo anula el sanitizador de Angular sin
// reemplazarlo por nada — se usa para system_name/logo_top_text/
// logo_bottom_text, que se renderizan directo (sin iframe) en el panel de
// vista previa. Mismo criterio que React (LoginPreview.tsx: DOMPurify.sanitize
// antes de dangerouslySetInnerHTML) — ver auditoría de seguridad 2026-07.
@Pipe({
  name: 'safeHtml',
  standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(value));
  }
}
