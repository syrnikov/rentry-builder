import type { MetaState } from '../rentry/validateMetadata';

export type Props = Record<string, any>;

export interface Block {
  id: string;
  type: string;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  /** Collapsed in the layers tree (containers only). */
  collapsed?: boolean;
  props: Props;
  /** Slots for container blocks (columns: one per column; section: one). */
  children?: Block[][];
}

export interface Project {
  version: 1;
  name: string;
  meta: MetaState;
  blocks: Block[];
  /** Saved swatches shown in every color picker. */
  palette?: { value: string; name: string }[];
}

/** Where a block lives / should be inserted. parentId null = page root. */
export interface DropTarget {
  parentId: string | null;
  slot: number;
  index: number;
}
