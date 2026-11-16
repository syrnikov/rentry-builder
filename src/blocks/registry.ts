import type { BlockDef, Category } from './types';
import { admonitionDef, checklistDef, codeDef, commentDef, dividerDef, headingDef, listDef, paragraphDef, quoteDef, spacerDef, tocDef } from './defs/text';
import { galleryDef, imageDef, youtubeDef } from './defs/media';
import { bannerDef, boundariesDef, currentlyDef, factsDef, interestsDef, linksDef, playlistDef, profileCardDef, socialsDef, statusDef, updatesDef } from './defs/profile';
import { columnsDef, floatClearDef, sectionDef } from './defs/layout';

export const BLOCK_DEFS: BlockDef[] = [
  headingDef, paragraphDef, quoteDef, listDef, checklistDef, admonitionDef, dividerDef, spacerDef, codeDef, tocDef, commentDef,
  imageDef, galleryDef, youtubeDef,
  bannerDef, profileCardDef, factsDef, interestsDef, linksDef, socialsDef, currentlyDef, statusDef, boundariesDef, updatesDef, playlistDef,
  columnsDef, sectionDef, floatClearDef,
];

const MAP: Record<string, BlockDef> = Object.fromEntries(BLOCK_DEFS.map((d) => [d.type, d]));
export const getDef = (type: string): BlockDef | undefined => MAP[type];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'text', label: 'Text' },
  { id: 'media', label: 'Media' },
  { id: 'layout', label: 'Layout' },
];
