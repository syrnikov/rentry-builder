import { Image as ImageIcon, LayoutGrid, PlaySquare } from 'lucide-react';
import type { BlockDef } from '../types';
import { alignField, cell, gridTable, HEADER_MODE_OPTIONS, IMAGE_UNITS, join, renderTitle, titleDefaults, titleFields, tableAlign } from '../common';
import { alignLine, image, italic, resolveAlign } from '../../rentry/inline';

const sizeLint = (w?: string, h?: string) => ((w && !h) || (!w && h) ? ['Set both width and height — rentry sizes need {width:height}.'] : []);

export const imageDef: BlockDef = {
  type: 'image',
  label: 'Image',
  icon: ImageIcon,
  category: 'media',
  description: 'Picture with size, float and link',
  defaults: () => ({ url: 'https://picsum.photos/seed/rentry-image/600/360', alt: 'image', title: '', width: '300px', height: '180px', float: 'none', align: 'center', link: '', caption: '' }),
  groups: [
    { title: 'Image', fields: [{ kind: 'image', key: 'url', label: 'Source' }, { kind: 'text', key: 'alt', label: 'Alt text' }, { kind: 'text', key: 'title', label: 'Hover text' }] },
    {
      title: 'Layout',
      fields: [
        { kind: 'size', key: 'width', label: 'Width', units: IMAGE_UNITS, placeholder: 'auto' },
        { kind: 'size', key: 'height', label: 'Height', units: IMAGE_UNITS, placeholder: 'auto' },
        { kind: 'segmented', key: 'float', label: 'Float', options: [{ value: 'none', label: 'None' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }], hint: 'Floated images let the next blocks wrap around them. Add a Float clear block to stop wrapping.' },
        { ...alignField(), showIf: (p) => p.float === 'none' },
      ],
    },
    { title: 'Extras', fields: [{ kind: 'text', key: 'link', label: 'Link to', placeholder: 'https://…' }, { kind: 'text', key: 'caption', label: 'Caption', showIf: (p) => p.float === 'none' }] },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const img = image({ url: p.url, alt: p.alt, title: p.title, width: p.width, height: p.height, float: p.float, link: p.link });
    if (p.float !== 'none') return img;
    const a = resolveAlign(p.align, ctx.align);
    return join(alignLine(img, a), p.caption?.trim() && alignLine(italic(p.caption), a));
  },
  toCell: (b) => {
    const p = b.props;
    const img = image({ url: p.url, alt: p.alt, title: p.title, width: p.width, height: p.height, link: p.link });
    return p.caption?.trim() ? `${img} \\n ${italic(cell(p.caption))}` : img;
  },
  lint: (b) => [...(b.props.url?.trim() ? [] : ['Image has no source URL.']), ...sizeLint(b.props.width, b.props.height)],
};

export const galleryDef: BlockDef = {
  type: 'gallery',
  label: 'Gallery',
  icon: LayoutGrid,
  category: 'media',
  description: 'Grid of images with captions',
  defaults: () => ({
    ...titleDefaults('gallery'),
    columns: 3,
    width: '160px',
    height: '160px',
    headerMode: 'first',
    align: 'center',
    items: [1, 2, 3, 4, 5, 6].map((n) => ({ url: `https://picsum.photos/seed/rentry-g${n}/300/300`, caption: '', link: '' })),
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    {
      title: 'Grid',
      fields: [
        { kind: 'number', key: 'columns', label: 'Columns', min: 1, max: 8 },
        { kind: 'size', key: 'width', label: 'Image width', units: IMAGE_UNITS },
        { kind: 'size', key: 'height', label: 'Image height', units: IMAGE_UNITS },
        { kind: 'segmented', key: 'headerMode', label: 'Header row', options: HEADER_MODE_OPTIONS, hint: 'Markdown tables always have a header row. "First row" puts your first images there.' },
        alignField('align', 'Cell align'),
      ],
    },
    {
      title: 'Images',
      fields: [
        {
          kind: 'list', key: 'items', label: 'Images', itemLabel: 'Image',
          newItem: () => ({ url: '', caption: '', link: '' }),
          summary: (it, i) => it.caption || it.url?.split('/').pop() || `Image ${i + 1}`,
          fields: [{ kind: 'image', key: 'url', label: 'Source' }, { kind: 'text', key: 'caption', label: 'Caption' }, { kind: 'text', key: 'link', label: 'Link' }],
        },
      ],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const cells = (p.items ?? []).map((it: any) => {
      const img = image({ url: it.url, alt: it.caption || 'image', width: p.width, height: p.height, link: it.link });
      return it.caption?.trim() ? `${img} \\n ${italic(cell(it.caption))}` : img;
    });
    return join(renderTitle(p, a), gridTable(cells, p.columns, p.headerMode, tableAlign(a === 'left' ? 'left' : a)));
  },
  lint: (b) => sizeLint(b.props.width, b.props.height),
};

export function youtubeId(input: string): string {
  const s = (input ?? '').trim();
  const m = /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/.exec(s);
  return m ? m[1] : s;
}

export const youtubeDef: BlockDef = {
  type: 'youtube',
  label: 'YouTube',
  icon: PlaySquare,
  category: 'media',
  description: 'Video thumbnail that links to YouTube',
  defaults: () => ({ video: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', width: '320px', height: '180px', align: 'center', caption: '' }),
  groups: [
    {
      title: 'Video',
      fields: [
        { kind: 'text', key: 'video', label: 'URL or ID' },
        { kind: 'size', key: 'width', label: 'Width', units: IMAGE_UNITS },
        { kind: 'size', key: 'height', label: 'Height', units: IMAGE_UNITS },
        alignField(),
        { kind: 'text', key: 'caption', label: 'Caption' },
      ],
    },
  ],
  toMarkdown: (b, ctx) => {
    const id = youtubeId(b.props.video);
    if (!id) return '';
    const a = resolveAlign(b.props.align, ctx.align);
    const img = image({ url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, alt: b.props.caption || 'video', width: b.props.width, height: b.props.height, link: `https://youtube.com/watch?v=${id}` });
    return join(alignLine(img, a), b.props.caption?.trim() && alignLine(italic(b.props.caption), a));
  },
  toCell: (b) => {
    const id = youtubeId(b.props.video);
    return id ? image({ url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, alt: 'video', width: b.props.width, height: b.props.height, link: `https://youtube.com/watch?v=${id}` }) : '';
  },
  lint: (b) => sizeLint(b.props.width, b.props.height),
};
