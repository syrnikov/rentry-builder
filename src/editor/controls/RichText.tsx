import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import { Extension, Mark, mergeAttributes, JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Code, EyeOff, FileCode2, Highlighter, ImagePlus, Italic, Link2, Palette, Strikethrough, Underline, Unlink } from 'lucide-react';
import { InlineImageNode, InlineImagePanel } from './InlineImage';
import type { UnderlineOpts } from '../../rentry/inline';
import { Line, MarkType, parseRich, RMark, serializeRich } from '../../rentry/richText';
import { ColorPanel, NumberUnit, Popover, Row, Segmented, Select, Toggle, ColorField, usePopover } from './index';

// ───────────────────────── custom marks (rentry-specific inline styles)
const RentryColor = Mark.create({
  name: 'rentryColor',
  addAttributes: () => ({ color: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-rc]', getAttrs: (el) => ({ color: (el as HTMLElement).getAttribute('data-rc') }) }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes({ 'data-rc': HTMLAttributes.color, style: `color:${HTMLAttributes.color}` }), 0],
});

const underlineCss = (a: Record<string, string>) => {
  const line = a.type === 'both' ? 'underline overline' : a.type || 'underline';
  return [`text-decoration-line:${line}`, a.color && `text-decoration-color:${a.color}`, a.style && `text-decoration-style:${a.style}`, a.thickness && `text-decoration-thickness:${a.thickness}px`].filter(Boolean).join(';');
};
const RentryUnderline = Mark.create({
  name: 'rentryUnderline',
  addAttributes: () => ({ color: { default: '' }, style: { default: '' }, type: { default: '' }, thickness: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-ru]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { 'data-ru': '', style: underlineCss(HTMLAttributes as Record<string, string>) }, 0],
});
const RentryMark = Mark.create({ name: 'rentryMark', parseHTML: () => [{ tag: 'mark' }], renderHTML: () => ['mark', 0] });
const RentrySpoiler = Mark.create({ name: 'rentrySpoiler', parseHTML: () => [{ tag: 'span[data-spoiler]' }], renderHTML: () => ['span', { 'data-spoiler': '', class: 'rt-spoiler' }, 0] });

const SingleLine = Extension.create({
  name: 'singleLine',
  addKeyboardShortcuts: () => ({ Enter: () => true, 'Shift-Enter': () => true }),
});

// ───────────────────────── model <-> ProseMirror JSON
const TO_PM: Record<MarkType, string> = { bold: 'bold', italic: 'italic', strike: 'strike', code: 'code', link: 'link', color: 'rentryColor', underline: 'rentryUnderline', mark: 'rentryMark', spoiler: 'rentrySpoiler' };
const FROM_PM: Record<string, MarkType> = Object.fromEntries(Object.entries(TO_PM).map(([k, v]) => [v, k as MarkType]));

function toPM(lines: Line[]): JSONContent {
  return {
    type: 'doc',
    content: lines.map((l) => ({
      type: 'paragraph',
      attrs: { textAlign: l.align === 'left' ? null : l.align },
      content: l.runs.filter((r) => r.text || r.image).map((r) => {
        const marks = r.marks.map((m) => {
          if (m.type === 'link') return { type: 'link', attrs: { href: m.attrs?.href } };
          return { type: TO_PM[m.type], attrs: m.attrs };
        });
        if (r.image) return { type: 'rentryImage', attrs: { ...r.image }, marks };
        return { type: 'text', text: r.text, marks };
      }),
    })),
  };
}

function fromPM(doc: JSONContent): Line[] {
  return (doc.content ?? []).map((p) => ({
    align: (p.attrs?.textAlign as Line['align']) || 'left',
    runs: (p.content ?? []).filter((n) => n.type === 'text' || n.type === 'rentryImage').map((n) => ({
      text: n.text ?? '',
      image: n.type === 'rentryImage'
        ? { src: String(n.attrs?.src ?? ''), alt: String(n.attrs?.alt ?? ''), width: String(n.attrs?.width ?? ''), height: String(n.attrs?.height ?? ''), title: String(n.attrs?.title ?? '') }
        : undefined,
      marks: (n.marks ?? []).flatMap((m): RMark[] => {
        const type = FROM_PM[m.type];
        if (!type) return [];
        if (type === 'link') return [{ type, attrs: { href: String(m.attrs?.href ?? '') } }];
        if (type === 'color') return [{ type, attrs: { color: String(m.attrs?.color ?? '') } }];
        if (type === 'underline') {
          const a = m.attrs ?? {};
          return [{ type, attrs: { color: a.color || '', style: a.style || '', type: a.type || '', thickness: a.thickness ? String(a.thickness) : '' } }];
        }
        return [{ type }];
      }),
    })),
  }));
}

// ───────────────────────── component

/**
 * Visual (WYSIWYG) editor for rentry inline text. The value in and out is rentry markdown;
 * the person editing only ever sees formatted text.
 */
export function RichTextArea({ value, onChange, rows = 4, autoFocus, placeholder, singleLine }: {
  value: string; onChange: (v: string) => void; rows?: number; autoFocus?: boolean; placeholder?: string; mono?: boolean; singleLine?: boolean;
}) {
  const [raw, setRaw] = useState(false);
  const last = useRef(value);
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: false, blockquote: false, bulletList: false, orderedList: false, listItem: false, codeBlock: false, horizontalRule: false, hardBreak: false }),
    Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true, HTMLAttributes: { rel: null, target: null } }),
    TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right'] }),
    Placeholder.configure({ placeholder: placeholder ?? (singleLine ? 'Type…' : 'Write something…') }),
    RentryColor, RentryUnderline, RentryMark, RentrySpoiler, InlineImageNode,
    ...(singleLine ? [SingleLine] : []),
  ], [placeholder, singleLine]);

  const editor = useEditor({
    extensions,
    content: toPM(parseRich(value)),
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor: e }) => {
      let md = serializeRich(fromPM(e.getJSON()));
      if (singleLine) md = md.replace(/\n+/g, ' ');
      last.current = md;
      onChange(md);
    },
  }, [extensions]);

  // External changes (undo, other editors) flow back in without echoing.
  useEffect(() => {
    if (!editor || raw || value === last.current) return;
    last.current = value;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(toPM(parseRich(value)), false);
    const max = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
  }, [value, editor, raw]);

  return (
    <div className={clsx('rich', singleLine && 'single')}>
      <div className="rich-bar">
        {editor && !raw ? <Toolbar editor={editor} singleLine={singleLine} /> : <span className="rich-raw-label">Rentry markdown</span>}
        <span className="rich-spacer" />
        <button
          type="button"
          className={clsx('icon-btn', raw && 'on')}
          title={raw ? 'Back to visual editing' : 'Edit as rentry markdown'}
          onClick={() => {
            if (raw && editor) { last.current = value; editor.commands.setContent(toPM(parseRich(value)), false); }
            setRaw(!raw);
          }}
        >
          <FileCode2 size={13} />
        </button>
      </div>
      {raw ? (
        <textarea className="rich-raw" rows={rows} value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} autoFocus />
      ) : (
        <EditorContent editor={editor} className="rt-editor" style={{ minHeight: singleLine ? undefined : rows * 19 + 16 }} />
      )}
    </div>
  );
}

function Toolbar({ editor, singleLine }: { editor: Editor; singleLine?: boolean }) {
  const colorPop = usePopover();
  const ulPop = usePopover();
  const linkPop = usePopover();
  const imgPop = usePopover();
  const [url, setUrl] = useState('');
  const is = (name: string) => editor.isActive(name);
  const cmd = () => editor.chain().focus();
  const currentColor = (editor.getAttributes('rentryColor').color as string) || '';
  const ul = editor.getAttributes('rentryUnderline') as Record<string, string>;
  const align = editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left';

  const toggleSpoiler = () => {
    const { from } = editor.state.selection;
    const end = editor.state.selection.$from.end();
    const chain = editor.chain().focus().setTextSelection({ from, to: end });
    (is('rentrySpoiler') ? chain.unsetMark('rentrySpoiler') : chain.setMark('rentrySpoiler')).setTextSelection(from).run();
  };

  const btn = (title: string, Icon: typeof Bold, active: boolean, onClick: () => void) => (
    <button type="button" className={clsx('icon-btn', active && 'active')} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      <Icon size={13} />
    </button>
  );

  return (
    <>
      {btn('Bold (Ctrl+B)', Bold, is('bold'), () => cmd().toggleBold().run())}
      {btn('Italic (Ctrl+I)', Italic, is('italic'), () => cmd().toggleItalic().run())}
      {btn('Strikethrough', Strikethrough, is('strike'), () => cmd().toggleStrike().run())}
      {btn('Highlight', Highlighter, is('rentryMark'), () => cmd().toggleMark('rentryMark').run())}
      {btn('Inline code', Code, is('code'), () => cmd().toggleCode().run())}
      <span className="sep" />
      <button ref={colorPop.ref} type="button" className={clsx('icon-btn color-btn', currentColor && 'active')} title="Text color" onMouseDown={(e) => e.preventDefault()} onClick={colorPop.toggle}>
        <Palette size={13} />
        <i style={{ background: currentColor || 'currentColor', opacity: currentColor ? 1 : 0.25 }} />
      </button>
      <span className="split-btn">
        {btn('Underline', Underline, is('rentryUnderline'), () => cmd().toggleMark('rentryUnderline').run())}
        <button ref={ulPop.ref} type="button" className="icon-btn caret" title="Underline style" onMouseDown={(e) => e.preventDefault()} onClick={ulPop.toggle}><ChevronDown size={10} /></button>
      </span>
      {btn('Spoiler (hidden until hovered, to the end of the line)', EyeOff, is('rentrySpoiler'), toggleSpoiler)}
      <button ref={linkPop.ref} type="button" className={clsx('icon-btn', is('link') && 'active')} title="Link" onMouseDown={(e) => e.preventDefault()} onClick={() => { setUrl((editor.getAttributes('link').href as string) || 'https://'); linkPop.toggle(); }}>
        <Link2 size={13} />
      </button>
      <button ref={imgPop.ref} type="button" className={clsx('icon-btn', is('rentryImage') && 'active')} title="Inline image: custom emoji, flags…" onMouseDown={(e) => e.preventDefault()} onClick={imgPop.toggle}>
        <ImagePlus size={13} />
      </button>
      {!singleLine && (
        <>
          <span className="sep" />
          {btn(
            `Alignment: ${align} (click to change)`,
            align === 'center' ? AlignCenter : align === 'right' ? AlignRight : AlignLeft,
            align !== 'left',
            () => cmd().setTextAlign(align === 'left' ? 'center' : align === 'center' ? 'right' : 'left').run(),
          )}
        </>
      )}

      <Popover anchor={imgPop.ref} open={imgPop.open} onClose={imgPop.close} width={290}>
        <InlineImagePanel editor={editor} onDone={imgPop.close} />
      </Popover>

      <Popover anchor={colorPop.ref} open={colorPop.open} onClose={colorPop.close} width={252}>
        <div className="pop-stack">
          {/* No focus() here: the picker keeps focus while the selection stays in the editor. */}
          <ColorPanel value={currentColor} onChange={(c) => (c ? editor.chain().setMark('rentryColor', { color: c }).run() : editor.chain().unsetMark('rentryColor').run())} />
          <button type="button" className="btn subtle" disabled={!currentColor} onClick={() => { editor.chain().focus().unsetMark('rentryColor').run(); colorPop.close(); }}>Remove color</button>
        </div>
      </Popover>

      <Popover anchor={ulPop.ref} open={ulPop.open} onClose={ulPop.close} width={264}>
        <div className="pop-stack">
          <UnderlineFields
            hideToggle
            value={{ on: true, color: ul.color ?? '', style: (ul.style || 'default') as never, type: (ul.type || 'default') as never, thickness: ul.thickness ? Number(ul.thickness) : 0 }}
            onChange={(u) => editor.chain().setMark('rentryUnderline', {
              color: u.color || '', style: u.style === 'default' ? '' : u.style, type: u.type === 'default' ? '' : u.type, thickness: u.thickness ? String(u.thickness) : '',
            }).run()}
          />
          <div className="hint">Applies to the selected text.</div>
        </div>
      </Popover>

      <Popover anchor={linkPop.ref} open={linkPop.open} onClose={linkPop.close} width={270}>
        <div className="pop-stack">
          <input
            className="field"
            value={url}
            autoFocus
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { applyLink(editor, url); linkPop.close(); } }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {is('link') && <button type="button" className="btn subtle" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); linkPop.close(); }}><Unlink size={12} /> Remove</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn primary" onClick={() => { applyLink(editor, url); linkPop.close(); }}>Apply</button>
          </div>
        </div>
      </Popover>
    </>
  );
}

function applyLink(editor: Editor, url: string) {
  const href = url.trim();
  if (!href || href === 'https://') return;
  const { empty } = editor.state.selection;
  if (empty && !editor.isActive('link')) {
    editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
  } else {
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }
}

const UL_STYLES = ['default', 'solid', 'double', 'dotted', 'dashed', 'wavy'].map((v) => ({ value: v, label: v === 'default' ? 'Default' : v[0].toUpperCase() + v.slice(1) }));

export function UnderlineFields({ value, onChange, hideToggle }: { value: UnderlineOpts | undefined; onChange: (v: UnderlineOpts) => void; hideToggle?: boolean }) {
  const v: UnderlineOpts = { on: false, color: '', style: 'default', type: 'default', thickness: 0, ...value };
  const set = (patch: Partial<UnderlineOpts>) => onChange({ ...v, ...patch });
  return (
    <>
      {!hideToggle && <Row label="Underline"><Toggle checked={v.on} onChange={(on) => set({ on })} /></Row>}
      {(v.on || hideToggle) && (
        <>
          <Row label="Line color"><ColorField value={v.color ?? ''} onChange={(color) => set({ color })} /></Row>
          <Row label="Style"><Select value={v.style ?? 'default'} onChange={(s) => set({ style: s as never })} options={UL_STYLES} /></Row>
          <Row label="Type">
            <Segmented value={v.type ?? 'default'} onChange={(t) => set({ type: t as never })} options={[{ value: 'default', label: 'Auto' }, { value: 'underline', label: 'Under' }, { value: 'line-through', label: 'Strike' }, { value: 'overline', label: 'Over' }, { value: 'both', label: 'Both' }]} />
          </Row>
          <Row label="Thickness">
            <NumberUnit value={v.thickness ? `${v.thickness}px` : ''} placeholder="default" units={[{ unit: 'px', min: 1, max: 10, decimals: 0 }]} onChange={(s) => set({ thickness: s ? parseInt(s, 10) : 0 })} />
          </Row>
        </>
      )}
    </>
  );
}
