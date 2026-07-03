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
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Mention from '@tiptap/extension-mention';
import {
  EmailVariable, FontFamily, FontSize, Highlight,
  SuperscriptExtension, SubscriptExtension, PreserveEmailAttrs,
  createVariableSuggestion,
} from './tiptap-email-extensions';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rich-text-editor.component.html',
  styleUrls: ['./rich-text-editor.component.css'],
  styles: [':host { display: block; width: 100%; height: 100%; min-height: 0; }'],
})
export class RichTextEditorComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() value = '';
  @Input() placeholder = 'Escribe el contenido del correo...';
  @Input() minHeight = '180px';
  @Input() variables: EmailVariable[] = [];
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
  isTable       = signal(false);
  isBlockquote  = signal(false);
  isCodeBlock   = signal(false);
  isSuperscript = signal(false);
  isSubscript   = signal(false);
  canUndo       = signal(false);
  canRedo       = signal(false);

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
        FontFamily,
        FontSize,
        Highlight,
        SuperscriptExtension,
        SubscriptExtension,
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: this.placeholder }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({ inline: false, allowBase64: true }),
        Mention.configure({
          suggestion: createVariableSuggestion(() => this.variables),
          renderHTML: ({ node }) => ['span', { class: 'email-var-mention' }, `{{${node.attrs['id']}}}`],
          renderText: ({ node }) => `{{${node.attrs['id']}}}`,
        }),
        PreserveEmailAttrs,
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
    this.isTable.set(this.editor.isActive('table'));
    this.isBlockquote.set(this.editor.isActive('blockquote'));
    this.isCodeBlock.set(this.editor.isActive('codeBlock'));
    this.isSuperscript.set(this.editor.isActive('textStyle', { superscript: true }));
    this.isSubscript.set(this.editor.isActive('textStyle', { subscript: true }));
    this.canUndo.set(this.editor.can().undo());
    this.canRedo.set(this.editor.can().redo());
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

  setHighlight(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (this.editor?.chain().focus() as any)?.setHighlight(value).run();
  }

  setFontFamily(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value) {
      (this.editor?.chain().focus() as any)?.setFontFamily(value).run();
    } else {
      (this.editor?.chain().focus() as any)?.unsetFontFamily().run();
    }
    select.value = '';
  }

  setFontSize(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value) {
      (this.editor?.chain().focus() as any)?.setFontSize(value).run();
    } else {
      (this.editor?.chain().focus() as any)?.unsetFontSize().run();
    }
    select.value = '';
  }

  toggleSuperscript() { (this.editor?.chain().focus() as any)?.toggleSuperscript().run(); }
  toggleSubscript()   { (this.editor?.chain().focus() as any)?.toggleSubscript().run(); }
  toggleBlockquote()  { this.editor?.chain().focus().toggleBlockquote().run(); }
  toggleCodeBlock()   { this.editor?.chain().focus().toggleCodeBlock().run(); }
  clearFormat()       { this.editor?.chain().focus().clearNodes().unsetAllMarks().run(); }
  undo()              { this.editor?.chain().focus().undo().run(); }
  redo()              { this.editor?.chain().focus().redo().run(); }

  insertTable(): void {
    this.editor?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: false }).run();
  }
  addRowAfter()    { this.editor?.chain().focus().addRowAfter().run(); }
  addColumnAfter() { this.editor?.chain().focus().addColumnAfter().run(); }
  deleteRow()      { this.editor?.chain().focus().deleteRow().run(); }
  deleteColumn()   { this.editor?.chain().focus().deleteColumn().run(); }
  deleteTable()    { this.editor?.chain().focus().deleteTable().run(); }

  insertImage(): void {
    const url = window.prompt('URL de la imagen (ej. {{logo_url}} o una URL pública)');
    if (!url) return;
    this.editor?.chain().focus().setImage({ src: url }).run();
  }

  // ── Drag-and-drop de variables (ambos modos) ─────────────────────────────
  onEditorDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const variable = event.dataTransfer?.getData('text/plain');
    if (variable && this.editor && this.mode() === 'visual') {
      this.editor.chain().focus().insertContent(variable).run();
    }
  }

  onHtmlDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const variable = event.dataTransfer?.getData('text/plain');
    const textarea = event.currentTarget as HTMLTextAreaElement;
    if (!variable || !textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = this.htmlDraft();
    const newHtml = current.substring(0, start) + variable + current.substring(end);
    this.htmlDraft.set(newHtml);
    this.lastValue = newHtml;
    this.valueChange.emit(newHtml);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }
}
