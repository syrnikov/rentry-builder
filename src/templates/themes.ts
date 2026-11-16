import type { MetaState } from '../rentry/validateMetadata';

export interface ThemePreset { name: string; outer: string; inner: string; accent: string; meta: MetaState }

/** Style-only presets: applied over CONTAINER_* and CONTENT_* keys, leaving page info alone. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Paper', outer: '#ede6da', inner: '#fffdf8', accent: '#9a5b3c',
    meta: {
      CONTAINER_MAX_WIDTH: ['720px'], CONTAINER_PADDING: ['32px'], CONTAINER_BORDER_RADIUS: ['14px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#ede6da', '#1b1714'], CONTAINER_INNER_BACKGROUND_COLOR: ['#fffdf8', '#26201b'],
      CONTAINER_SHADOW_COLOR: ['RGBA(80,50,20,0.15)'], CONTAINER_SHADOW_OFFSET: ['0px', '4px'], CONTAINER_SHADOW_BLUR: ['20px'],
      CONTENT_FONT: ['Lora', 'Playfair_Display'], CONTENT_TEXT_COLOR: ['#3b3029', '#e9dfd3'], CONTENT_LINK_COLOR: ['#9a5b3c', '#e3a37f'],
    },
  },
  {
    name: 'Midnight', outer: '#0d1117', inner: '#161b22', accent: '#58a6ff',
    meta: {
      ACCESS_RECOMMENDED_THEME: ['dark'], CONTAINER_MAX_WIDTH: ['760px'], CONTAINER_PADDING: ['28px'], CONTAINER_BORDER_RADIUS: ['10px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#0d1117'], CONTAINER_INNER_BACKGROUND_COLOR: ['#161b22'],
      CONTAINER_BORDER_STYLE: ['solid'], CONTAINER_BORDER_WIDTH: ['1px'], CONTAINER_BORDER_COLOR: ['#30363d'],
      CONTENT_FONT: ['Inter'], CONTENT_TEXT_COLOR: ['#c9d1d9'], CONTENT_LINK_COLOR: ['#58a6ff'], CONTENT_BULLET_COLOR: ['#58a6ff'],
    },
  },
  {
    name: 'Bubblegum', outer: '#ffd6e8', inner: '#fff5fa', accent: '#ff4fa3',
    meta: {
      CONTAINER_MAX_WIDTH: ['680px'], CONTAINER_PADDING: ['30px'], CONTAINER_BORDER_RADIUS: ['28px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#ffd6e8', '#2a1020'], CONTAINER_INNER_BACKGROUND_COLOR: ['#fff5fa', '#3a1a2c'],
      CONTAINER_BORDER_STYLE: ['dashed'], CONTAINER_BORDER_WIDTH: ['3px'], CONTAINER_BORDER_COLOR: ['#ff8cc6'],
      CONTENT_FONT: ['Quicksand', 'Fredoka'], CONTENT_TEXT_COLOR: ['#6b3355', '#ffd9ec'], CONTENT_LINK_COLOR: ['#ff4fa3'], CONTENT_BULLET_COLOR: ['#ff8cc6'],
    },
  },
  {
    name: 'Terminal', outer: '#000000', inner: '#0a0f0a', accent: '#39ff14',
    meta: {
      ACCESS_RECOMMENDED_THEME: ['dark'], CONTAINER_MAX_WIDTH: ['760px'], CONTAINER_PADDING: ['24px'], CONTAINER_BORDER_RADIUS: ['0px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['black'], CONTAINER_INNER_BACKGROUND_COLOR: ['#0a0f0a'],
      CONTAINER_BORDER_STYLE: ['solid'], CONTAINER_BORDER_WIDTH: ['1px'], CONTAINER_BORDER_COLOR: ['#1f5f1f'],
      CONTENT_FONT: ['VT323'], CONTENT_TEXT_SIZE: ['19px'], CONTENT_TEXT_COLOR: ['#39ff14'], CONTENT_LINK_COLOR: ['#b6ff9e'], CONTENT_BULLET_COLOR: ['#39ff14'],
      CONTENT_TEXT_SHADOW_COLOR: ['RGBA(57,255,20,0.6)'], CONTENT_TEXT_SHADOW_OFFSET: ['0px', '0px'], CONTENT_TEXT_SHADOW_BLUR: ['6px'],
    },
  },
  {
    name: 'Forest', outer: '#2f3e2c', inner: '#f3f1e7', accent: '#4f7a3a',
    meta: {
      CONTAINER_MAX_WIDTH: ['700px'], CONTAINER_PADDING: ['30px'], CONTAINER_BORDER_RADIUS: ['6px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#2f3e2c'], CONTAINER_INNER_BACKGROUND_COLOR: ['#f3f1e7', '#1f2a1d'],
      CONTAINER_BORDER_STYLE: ['double'], CONTAINER_BORDER_WIDTH: ['5px'], CONTAINER_BORDER_COLOR: ['#8aa36b'],
      CONTENT_FONT: ['Cormorant_Garamond', 'Cinzel'], CONTENT_TEXT_SIZE: ['18px'], CONTENT_TEXT_COLOR: ['#2b3326', '#dfe6d3'], CONTENT_LINK_COLOR: ['#4f7a3a', '#a9cf8a'],
    },
  },
];

export const isStyleKey = (k: string) => k.startsWith('CONTAINER_') || k.startsWith('CONTENT_') || k === 'ACCESS_RECOMMENDED_THEME';
