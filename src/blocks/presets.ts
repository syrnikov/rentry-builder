import type { LucideIcon } from 'lucide-react';
import { Heart, Images } from 'lucide-react';
import type { Block, Props } from '../model/types';
import { newId } from '../model/tree';
import { BLOCK_DEFS, getDef } from './registry';
import type { Category } from './types';

export function createBlock(type: string, props: Props = {}, children?: Block[][]): Block {
  const def = getDef(type);
  if (!def) throw new Error(`Unknown block type ${type}`);
  const b: Block = { id: newId(), type, props: { ...def.defaults(), ...props } };
  if (def.container) {
    const n = def.container.slotCount(b);
    b.children = children ?? Array.from({ length: n }, () => []);
  }
  return b;
}

export interface Preset {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: Category;
  make: () => Block;
}

const extra: Preset[] = [
  {
    id: 'favorites', type: 'gallery', label: 'Favorites', description: 'Grid of favorite things with captions', icon: Heart, category: 'profile',
    make: () => createBlock('gallery', {
      title: 'favorites', columns: 3, width: '120px', height: '160px',
      items: [['film', 'spirited away'], ['book', 'piranesi'], ['game', 'outer wilds']].map(([s, caption]) => ({ url: `https://picsum.photos/seed/fav-${s}/240/320`, caption, link: '' })),
    }),
  },
  {
    id: 'likes-dislikes', type: 'columns', label: 'Likes / dislikes', description: 'Two columns with lists', icon: Images, category: 'layout',
    make: () => createBlock('columns', { count: 2, title0: 'likes ♡', title1: 'dislikes ✗' }, [
      [createBlock('list', { items: [{ text: 'rainy days', indent: 0 }, { text: 'museums', indent: 0 }, { text: 'soup', indent: 0 }] })],
      [createBlock('list', { items: [{ text: 'loud chewing', indent: 0 }, { text: 'spoilers', indent: 0 }, { text: 'mornings', indent: 0 }] })],
    ]),
  },
];

export const PRESETS: Preset[] = [
  ...BLOCK_DEFS.map((d) => ({ id: d.type, type: d.type, label: d.label, description: d.description, icon: d.icon, category: d.category, make: () => createBlock(d.type) })),
  ...extra,
];

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);
