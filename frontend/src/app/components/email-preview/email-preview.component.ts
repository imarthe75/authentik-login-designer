import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeApiService } from '../../services/theme-api.service';
import { EmailEventType, EMAIL_EVENT_LABELS } from '../../models/theme.model';
import { Subscription } from 'rxjs';

function buildLiveHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1a1a2e;background:#f4f4f4;margin:0;padding:24px 16px}
.env{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.env-h{background:#4272A5;padding:20px 28px;color:#fff;font-size:15px;font-weight:600}
.badge{display:inline-block;background:rgba(255,255,255,.2);font-size:10px;font-weight:600;letter-spacing:.05em;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle}
.env-b{padding:28px}
.env-b h1{font-size:1.4em;margin:0 0 .5em}
.env-b h2{font-size:1.2em;margin:0 0 .4em}
.env-b p{margin:.4em 0;line-height:1.6}
.env-b a{color:#4272A5}
.env-b ul,.env-b ol{padding-left:1.4em;margin:.4em 0}
.env-b hr{border:none;border-top:1px solid #e5e7eb;margin:1em 0}
.env-f{padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
</style></head>
<body>
<div class="env">
  <div class="env-h">CASMARTS <span class="badge">VISTA PREVIA EN VIVO</span></div>
  <div class="env-b">${bodyHtml || '<p style="color:#9ca3af;font-style:italic">Sin contenido aún…</p>'}</div>
  <div class="env-f">noreply@casmarts.internal · Este es un correo automático</div>
</div>
</body></html>`;
}

@Component({
  selector: 'app-email-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-preview.component.html'
})
export class EmailPreviewComponent implements OnChanges, OnDestroy {
  private readonly api = inject(ThemeApiService);

  @Input({ required: true }) flowSlug!: string;
  @Input({ required: true }) eventType!: EmailEventType;
  @Input() refreshKey = 0;
  @Input() liveBodyHtml?: string;

  @ViewChild('iframe') iframeRef!: ElementRef<HTMLIFrameElement>;

  readonly EMAIL_EVENT_LABELS = EMAIL_EVENT_LABELS;
  readonly subject = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly isLive = signal<boolean>(false);

  private blobUrl: string | null = null;
  private previewSub?: Subscription;
  private liveTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['flowSlug'] || changes['eventType'] || changes['refreshKey']) {
      this.loadPreview();
    }

    if (changes['liveBodyHtml'] && !changes['liveBodyHtml'].firstChange) {
      if (this.liveTimer) clearTimeout(this.liveTimer);
      this.liveTimer = setTimeout(() => {
        this.renderLive(this.liveBodyHtml ?? '');
      }, 400);
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
    if (this.liveTimer) clearTimeout(this.liveTimer);
  }

  loadPreview(): void {
    if (!this.flowSlug || !this.eventType) return;

    this.loading.set(true);
    this.isLive.set(false);
    this.error.set(null);
    this.previewSub?.unsubscribe();

    this.previewSub = this.api.getEmailPreview(this.flowSlug, this.eventType).subscribe({
      next: (html) => {
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        this.subject.set(titleMatch?.[1]?.trim() ?? EMAIL_EVENT_LABELS[this.eventType]);
        this.setIframeSrc(html);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Error al cargar la vista previa del correo.');
        this.loading.set(false);
      }
    });
  }

  private renderLive(bodyHtml: string): void {
    this.isLive.set(true);
    this.error.set(null);
    this.setIframeSrc(buildLiveHtml(bodyHtml));
  }

  private setIframeSrc(html: string): void {
    this.cleanup();
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    this.blobUrl = URL.createObjectURL(blob);
    if (this.iframeRef?.nativeElement) {
      this.iframeRef.nativeElement.src = this.blobUrl;
    }
  }

  private cleanup(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }
}
