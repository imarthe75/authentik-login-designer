import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Theme } from '../../models/theme.model';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './theme-selector.component.html'
})
export class ThemeSelectorComponent {
  @Input({ required: true }) themes: Theme[] = [];
  @Input({ required: true }) currentSlug = '';
  @Output() selectSlug = new EventEmitter<string>();
  @Output() createTheme = new EventEmitter<{ displayName: string; flowSlug: string }>();

  isOpen = signal(false);
  showModal = signal(false);
  newDisplayName = signal('');
  newFlowSlug = signal('');
  slugError = signal('');

  get currentTheme() {
    return this.themes.find(t => t.authentik_flow_slug === this.currentSlug)
      ?? { display_name: this.currentSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
           authentik_flow_slug: this.currentSlug };
  }

  toggleOpen(): void {
    this.isOpen.update(v => !v);
  }

  handleSelectTheme(slug: string): void {
    this.selectSlug.emit(slug);
    this.isOpen.set(false);
  }

  openModal(): void {
    this.newDisplayName.set('');
    this.newFlowSlug.set('');
    this.slugError.set('');
    this.showModal.set(true);
    this.isOpen.set(false);
  }

  handleSlugChange(val: string): void {
    const formatted = val.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-');
    this.newFlowSlug.set(formatted);
    this.slugError.set(formatted ? '' : 'El identificador del flujo es obligatorio.');
  }

  handleSubmit(): void {
    if (!this.newDisplayName().trim() || !this.newFlowSlug().trim()) return;
    this.createTheme.emit({ displayName: this.newDisplayName().trim(), flowSlug: this.newFlowSlug().trim() });
    this.newDisplayName.set('');
    this.newFlowSlug.set('');
    this.showModal.set(false);
  }
}
