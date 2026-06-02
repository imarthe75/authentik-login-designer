import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { LucideAngularModule } from 'lucide-angular';
import { Theme } from '../../models/theme.model';

@Component({
  selector: 'app-login-preview',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe, LucideAngularModule],
  templateUrl: './login-preview.component.html'
})
export class LoginPreviewComponent {
  @Input({ required: true }) theme!: Theme;

  showPwd = signal(false);
  showModal = signal(false);

  hexToRgba(hex: string, alpha: number): string {
    try {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      return `rgba(255, 255, 255, ${alpha})`;
    }
  }

  get bgStyle(): Record<string, string> {
    const t = this.theme;
    const base: Record<string, string> = {
      opacity: String(t.bg_opacity),
      transition: 'opacity 0.4s, background 0.3s',
    };
    if (t.bg_type === 'color' && t.bg_flat_color) {
      base['background'] = t.bg_flat_color;
    } else if (t.bg_type === 'image' && t.bg_image_base64) {
      base['backgroundImage'] = `url(${t.bg_image_base64})`;
      base['backgroundSize'] = 'cover';
      base['backgroundPosition'] = 'center';
    } else {
      base['background'] = `linear-gradient(135deg, ${t.bg_gradient_from} 0%, ${t.bg_gradient_to} 100%)`;
    }
    return base;
  }

  get cardBgStyle(): Record<string, string> {
    return { background: this.hexToRgba(this.theme.card_bg_color ?? '#FFFFFF', this.theme.form_opacity) };
  }

  get panelBgStyle(): Record<string, string> {
    return { background: this.hexToRgba(this.theme.panel_bg_color ?? '#F6F9FD', this.theme.logos_opacity) };
  }

  get containerFlexDirection(): string {
    return this.theme.layout_position === 'right' ? 'row-reverse' : 'row';
  }

  get layoutJustify(): string {
    if (this.theme.layout_position === 'left') return 'flex-start';
    if (this.theme.layout_position === 'right') return 'flex-end';
    return 'center';
  }
}
