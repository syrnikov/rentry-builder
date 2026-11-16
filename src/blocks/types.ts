import type { LucideIcon } from 'lucide-react';
import type { Block, Props } from '../model/types';
import type { Align } from '../rentry/inline';
import type { UnitRange } from '../rentry/metadataSchema';

export type Category = 'text' | 'media' | 'profile' | 'layout';

export interface Option { value: string; label: string; icon?: LucideIcon }

interface FieldBase {
  key: string;
  label: string;
  hint?: string;
  showIf?: (props: Props) => boolean;
}

export type Field =
  | (FieldBase & { kind: 'text'; placeholder?: string })
  | (FieldBase & { kind: 'textarea'; rows?: number; rich?: boolean; placeholder?: string; mono?: boolean })
  | (FieldBase & { kind: 'number'; min: number; max: number; step?: number; suffix?: string })
  | (FieldBase & { kind: 'select'; options: Option[] })
  | (FieldBase & { kind: 'segmented'; options: Option[] })
  | (FieldBase & { kind: 'toggle' })
  | (FieldBase & { kind: 'color' })
  | (FieldBase & { kind: 'image' })
  | (FieldBase & { kind: 'size'; units: UnitRange[]; placeholder?: string })
  | (FieldBase & { kind: 'underline' })
  | (FieldBase & { kind: 'emoji'; placeholder?: string })
  | (FieldBase & {
      kind: 'list';
      itemLabel: string;
      fields: Field[];
      newItem: () => Props;
      summary: (item: Props, i: number) => string;
      max?: number;
    });

export interface FieldGroup { title: string; fields: Field[]; collapsed?: boolean }

export interface Ctx {
  /** Alignment inherited from a parent Section. */
  align?: Align;
  compileList: (blocks: Block[], ctx: Ctx) => string;
  /** Single-line table-cell form of a block ('' when unsupported). */
  cellOf: (block: Block, ctx: Ctx) => string;
}

export interface BlockDef {
  type: string;
  label: string;
  icon: LucideIcon;
  category: Category;
  description: string;
  defaults: () => Props;
  groups: FieldGroup[];
  toMarkdown: (b: Block, ctx: Ctx) => string;
  /** Single-line form for use inside a Columns table cell. Presence = allowed in columns. */
  toCell?: (b: Block, ctx: Ctx) => string;
  /** Container info. */
  container?: {
    slotCount: (b: Block) => number;
    slotLabel: (b: Block, i: number) => string;
    accepts: (childDef: BlockDef) => boolean;
  };
  /** Prop key edited by double-clicking on the canvas. */
  primaryText?: string;
  lint?: (b: Block) => string[];
  /** Editor-only preview shown on canvas instead of rendered markdown (e.g. hidden comments). */
  editorOnly?: boolean;
}
