import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeApiService } from '../../services/theme-api.service';
import { EmailEventType, EMAIL_EVENT_LABELS } from '../../models/theme.model';
import { Subscription } from 'rxjs';

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

  @ViewChild('iframe') iframeRef!: ElementRef<HTMLIFrameElement>;

  readonly EMAIL_EVENT_LABELS = EMAIL_EVENT_LABELS;
  readonly subject = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private blobUrl: string | null = null;
  private previewSub?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['flowSlug'] || changes['eventType'] || changes['refreshKey']) {
      this.loadPreview();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  loadPreview(): void {
    if (!this.flowSlug || !this.eventType) return;
    
    this.loading.set(true);
    this.error.set(null);
    this.previewSub?.unsubscribe();

    this.previewSub = this.api.getEmailPreview(this.flowSlug, this.eventType).subscribe({
      next: (html) => {
        // Extract subject from <title> tag
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        this.subject.set(titleMatch?.[1]?.trim() ?? EMAIL_EVENT_LABELS[this.eventType]);

        this.cleanup();

        // Use a blob URL to prevent sandbox and script-blocking issues in iframe
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        this.blobUrl = URL.createObjectURL(blob);

        if (this.iframeRef?.nativeElement) {
          this.iframeRef.nativeElement.src = this.blobUrl;
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Error al cargar la vista previa del correo.');
        this.loading.set(false);
      }
    });
  }

  private cleanup(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }
}
