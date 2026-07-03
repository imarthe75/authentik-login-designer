import { Extension } from '@tiptap/core';

export interface EmailVariable {
  var: string;
  desc: string;
}

// Extensiones custom de fuente/tamaño/resaltado/super-subíndice — puro
// TipTap (Extension.create), sin nada específico de framework. Portadas
// desde authentik-login-manager/frontend/src/components/RichTextEditor.tsx
// (React) para mantener el mismo comportamiento en ambos editores.

export const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontFamily || null,
            renderHTML: (attributes: any) => {
              if (!attributes.fontFamily) return {};
              return { style: `font-family: ${attributes.fontFamily}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontFamily: (fontFamily: string) => ({ commands }: any) => {
        return commands.setMark('textStyle', { fontFamily });
      },
      unsetFontFamily: () => ({ commands }: any) => {
        return commands.resetAttributes('textStyle', 'fontFamily');
      },
    } as any;
  },
});

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: any) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ commands }: any) => {
        return commands.setMark('textStyle', { fontSize });
      },
      unsetFontSize: () => ({ commands }: any) => {
        return commands.resetAttributes('textStyle', 'fontSize');
      },
    } as any;
  },
});

export const Highlight = Extension.create({
  name: 'highlight',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          highlight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
            renderHTML: (attributes: any) => {
              if (!attributes.highlight) return {};
              return { style: `background-color: ${attributes.highlight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setHighlight: (color: string) => ({ commands }: any) => {
        return commands.setMark('textStyle', { highlight: color });
      },
      unsetHighlight: () => ({ commands }: any) => {
        return commands.resetAttributes('textStyle', 'highlight');
      },
    } as any;
  },
});

export const SuperscriptExtension = Extension.create({
  name: 'superscript',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          superscript: {
            default: false,
            parseHTML: (element: HTMLElement) => element.style.verticalAlign === 'super',
            renderHTML: (attributes: any) => {
              if (!attributes.superscript) return {};
              return { style: 'vertical-align: super; font-size: 0.8em' };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      toggleSuperscript: () => ({ commands }: any) => {
        return commands.toggleMark('textStyle', { superscript: true });
      },
    } as any;
  },
});

export const SubscriptExtension = Extension.create({
  name: 'subscript',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          subscript: {
            default: false,
            parseHTML: (element: HTMLElement) => element.style.verticalAlign === 'sub',
            renderHTML: (attributes: any) => {
              if (!attributes.subscript) return {};
              return { style: 'vertical-align: sub; font-size: 0.8em' };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      toggleSubscript: () => ({ commands }: any) => {
        return commands.toggleMark('textStyle', { subscript: true });
      },
    } as any;
  },
});

// Los correos de producción son HTML con estilos inline (tablas de detalle,
// párrafos con color/tamaño puntual) — TipTap por defecto NO conserva
// atributos que no estén declarados explícitamente en el esquema de cada
// nodo, así que sin esto, abrir un correo por defecto en modo Diseño y
// guardar sin tocar nada perdería silenciosamente el `style`/`width`/etc.
// original de las tablas y bloques.
export const PreserveEmailAttrs = Extension.create({
  name: 'preserveEmailAttrs',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'table', 'tableRow', 'tableCell', 'tableHeader', 'image', 'bulletList', 'orderedList', 'listItem', 'blockquote'],
        attributes: {
          style: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('style') || null,
            renderHTML: (attributes: any) => (attributes.style ? { style: attributes.style } : {}),
          },
        },
      },
      {
        types: ['table'],
        attributes: {
          role: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('role') || null,
            renderHTML: (attributes: any) => (attributes.role ? { role: attributes.role } : {}),
          },
          width: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('width') || null,
            renderHTML: (attributes: any) => (attributes.width ? { width: attributes.width } : {}),
          },
          cellpadding: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('cellpadding') || null,
            renderHTML: (attributes: any) => (attributes.cellpadding ? { cellpadding: attributes.cellpadding } : {}),
          },
          cellspacing: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('cellspacing') || null,
            renderHTML: (attributes: any) => (attributes.cellspacing ? { cellspacing: attributes.cellspacing } : {}),
          },
        },
      },
    ];
  },
});

// Autocompletado de variables: al teclear "{{" se abre una lista filtrable
// de las variables reales del catálogo (evita el typo silencioso de
// escribir {{contaco_soporte}} a mano, que se enviaría literal sin ningún
// aviso). DOM manual (sin dependencias de popup nuevas) — misma técnica que
// la versión React, adaptada para recibir un array plano en vez de un ref
// (Angular no tiene el problema de stale-closure de los hooks de React).
export function createVariableSuggestion(getVariables: () => EmailVariable[]) {
  return {
    char: '{{',
    allowSpaces: false,
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return getVariables()
        .filter((v) => v.var.toLowerCase().includes(q))
        .slice(0, 8);
    },
    command: ({ editor, range, props }: any) => {
      const id = String(props.var).replace(/[{}]/g, '');
      editor.chain().focus().insertContentAt(range, [
        { type: 'mention', attrs: { id } },
        { type: 'text', text: ' ' },
      ]).run();
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let selectedIndex = 0;
      let currentItems: EmailVariable[] = [];
      let currentCommand: ((item: EmailVariable) => void) | null = null;

      const renderList = () => {
        if (!popup) return;
        popup.innerHTML = '';
        if (currentItems.length === 0) {
          const empty = document.createElement('div');
          empty.textContent = 'Sin variables que coincidan';
          empty.style.cssText = 'padding:8px 10px;font-size:12px;color:#9ca3af;';
          popup.appendChild(empty);
          return;
        }
        currentItems.forEach((item, i) => {
          const row = document.createElement('div');
          row.title = item.desc;
          row.style.cssText = `padding:6px 10px;cursor:pointer;${i === selectedIndex ? 'background:#e8f0fb;' : ''}`;
          const varEl = document.createElement('div');
          varEl.textContent = item.var;
          varEl.style.cssText = 'font-family:monospace;font-size:12px;font-weight:600;color:#1d4ed8;';
          const descEl = document.createElement('div');
          descEl.textContent = item.desc;
          descEl.style.cssText = 'font-size:10px;color:#6b7280;margin-top:1px;';
          row.appendChild(varEl);
          row.appendChild(descEl);
          row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            currentCommand?.(item);
          });
          popup!.appendChild(row);
        });
      };

      const position = (clientRect?: (() => DOMRect | null) | null) => {
        const rect = clientRect?.();
        if (rect && popup) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 4}px`;
        }
      };

      return {
        onStart: (props: any) => {
          currentItems = props.items;
          currentCommand = props.command;
          selectedIndex = 0;
          popup = document.createElement('div');
          popup.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);max-height:240px;overflow-y:auto;min-width:220px;';
          document.body.appendChild(popup);
          renderList();
          position(props.clientRect);
        },
        onUpdate: (props: any) => {
          currentItems = props.items;
          currentCommand = props.command;
          selectedIndex = 0;
          renderList();
          position(props.clientRect);
        },
        onKeyDown: (props: any) => {
          if (!currentItems.length) return props.event.key === 'Escape';
          if (props.event.key === 'ArrowDown') {
            selectedIndex = (selectedIndex + 1) % currentItems.length;
            renderList();
            return true;
          }
          if (props.event.key === 'ArrowUp') {
            selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
            renderList();
            return true;
          }
          if (props.event.key === 'Enter' || props.event.key === 'Tab') {
            currentCommand?.(currentItems[selectedIndex]);
            return true;
          }
          if (props.event.key === 'Escape') {
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
        },
      };
    },
  };
}
