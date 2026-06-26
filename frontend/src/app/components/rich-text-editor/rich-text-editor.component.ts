import {
  Component, Input, Output, EventEmitter,
  ViewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges,
  SimpleChanges, ChangeDetectorRef, signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rich-text-editor.component.html',
  styleUrls: ['./rich-text-editor.component.css'],
})
export class RichTextEditorComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() value = '';
  @Input() placeholder = 'Escribe el contenido del correo...';
  @Input() minHeight = '180px';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

  private cdr = inject(ChangeDetectorRef);

  mode = signal<'visual' | 'html'>('visual');
  htmlDraft = signal('');

  // Toolbar active-state signals (updated on every transaction)
  isBold        = signal(false);
  isItalic      = signal(false);
  isUnderline   = signal(false);
  isStrike      = signal(false);
  isH1          = signal(false);
  isH2          = signal(false);
  isParagraph   = signal(false);
  isBulletList  = signal(false);
  isOrderedList = signal(false);
  isLink        = signal(false);
  isAlignLeft   = signal(false);
  isAlignCenter = signal(false);
  isAlignRight  = signal(false);

  get htmlLineCount(): number {
    const lines = this.htmlDraft().split('\n').length;
    return lines;
  }

  private editor?: Editor;
  private lastValue = '';

  ngAfterViewInit(): void {
    this.lastValue = this.value;
    this.htmlDraft.set(this.value);

    this.editor = new Editor({
      element: this.editorContainer.nativeElement,
      extensions: [
        StarterKit,
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        TextStyle,
        Color,
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: this.placeholder }),
      ],
      content: this.value,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        this.lastValue = html;
        this.valueChange.emit(html);
        this._syncToolbar();
        this.cdr.detectChanges();
      },
      onTransaction: () => {
        this._syncToolbar();
        this.cdr.detectChanges();
      },
    });

    this._syncToolbar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.editor && this.value !== this.lastValue) {
      this.lastValue = this.value;
      this.htmlDraft.set(this.value);
      if (this.mode() === 'visual') {
        this.editor.commands.setContent(this.value, { emitUpdate: false });
      }
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  private _syncToolbar(): void {
    if (!this.editor) return;
    this.isBold.set(this.editor.isActive('bold'));
    this.isItalic.set(this.editor.isActive('italic'));
    this.isUnderline.set(this.editor.isActive('underline'));
    this.isStrike.set(this.editor.isActive('strike'));
    this.isH1.set(this.editor.isActive('heading', { level: 1 }));
    this.isH2.set(this.editor.isActive('heading', { level: 2 }));
    this.isParagraph.set(this.editor.isActive('paragraph'));
    this.isBulletList.set(this.editor.isActive('bulletList'));
    this.isOrderedList.set(this.editor.isActive('orderedList'));
    this.isLink.set(this.editor.isActive('link'));
    this.isAlignLeft.set(this.editor.isActive({ textAlign: 'left' }));
    this.isAlignCenter.set(this.editor.isActive({ textAlign: 'center' }));
    this.isAlignRight.set(this.editor.isActive({ textAlign: 'right' }));
  }

  // ── Mode switching ─────────────────────────────────────────────────────────
  switchToHtml(): void {
    if (this.editor) this.htmlDraft.set(this.editor.getHTML());
    this.mode.set('html');
  }

  switchToVisual(): void {
    if (this.editor) {
      this.editor.commands.setContent(this.htmlDraft(), { emitUpdate: false });
      this.lastValue = this.htmlDraft();
    }
    this.valueChange.emit(this.htmlDraft());
    this.mode.set('visual');
  }

  onHtmlInput(event: Event): void {
    const v = (event.target as HTMLTextAreaElement).value;
    this.htmlDraft.set(v);
    this.lastValue = v;
    this.valueChange.emit(v);
  }

  // ── Toolbar commands ───────────────────────────────────────────────────────
  toggleBold()        { this.editor?.chain().focus().toggleBold().run(); }
  toggleItalic()      { this.editor?.chain().focus().toggleItalic().run(); }
  toggleUnderline()   { this.editor?.chain().focus().toggleUnderline().run(); }
  toggleStrike()      { this.editor?.chain().focus().toggleStrike().run(); }
  toggleH1()          { this.editor?.chain().focus().toggleHeading({ level: 1 }).run(); }
  toggleH2()          { this.editor?.chain().focus().toggleHeading({ level: 2 }).run(); }
  setParagraph()      { this.editor?.chain().focus().setParagraph().run(); }
  toggleBulletList()  { this.editor?.chain().focus().toggleBulletList().run(); }
  toggleOrderedList() { this.editor?.chain().focus().toggleOrderedList().run(); }
  setAlignLeft()      { this.editor?.chain().focus().setTextAlign('left').run(); }
  setAlignCenter()    { this.editor?.chain().focus().setTextAlign('center').run(); }
  setAlignRight()     { this.editor?.chain().focus().setTextAlign('right').run(); }
  setHR()             { this.editor?.chain().focus().setHorizontalRule().run(); }
  unsetLink()         { this.editor?.chain().focus().extendMarkRange('link').unsetLink().run(); }
  focusEditor()       { this.editor?.commands.focus(); }

  setLink(): void {
    if (!this.editor) return;
    const prev = this.editor.getAttributes('link')['href'] ?? '';
    const url = window.prompt('URL del enlace', prev);
    if (url === null) return;
    if (url === '') {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }

  setColor(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editor?.chain().focus().setColor(value).run();
  }
}
