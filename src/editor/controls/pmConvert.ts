import type { JSONContent } from '@tiptap/core';
import type { Line, MarkType, RMark } from '../../rentry/richText';

// ───────────────────────── model <-> ProseMirror JSON
const TO_PM: Record<MarkType, string> = { bold: 'bold', italic: 'italic', strike: 'strike', code: 'code', link: 'link', color: 'rentryColor', underline: 'rentryUnderline', mark: 'rentryMark', spoiler: 'rentrySpoiler' };
const FROM_PM: Record<string, MarkType> = Object.fromEntries(Object.entries(TO_PM).map(([k, v]) => [v, k as MarkType]));

export function toPM(lines: Line[]): JSONContent {
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

export function fromPM(doc: JSONContent): Line[] {
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

