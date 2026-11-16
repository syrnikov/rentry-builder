import type { Project } from '../model/types';
import type { MetaState } from '../rentry/validateMetadata';
import { createBlock as b } from '../blocks/presets';
import { getPreset } from '../blocks/presets';

export interface Template {
  id: string;
  name: string;
  description: string;
  swatch: [string, string, string];
  make: () => Project;
}

type Swatch = [value: string, name: string];
const project = (name: string, meta: MetaState, blocks: Project['blocks'], palette: Swatch[] = []): Project => ({
  version: 1, name, meta, blocks, palette: palette.map(([value, n]) => ({ value, name: n })),
});
const preset = (id: string) => getPreset(id)!.make();

export const TEMPLATES: Template[] = [
  {
    id: 'cozy',
    name: 'Cozy Cottage',
    description: 'Warm paper tones, rounded card, soft shadow',
    swatch: ['#E9D8C4', '#FFF8EE', '#b5543a'],
    make: () => project('cozy cottage', {
      PAGE_TITLE: ['robin’s little corner ✿'],
      PAGE_DESCRIPTION: ['about me, things I love and where to find me'],
      CONTAINER_MAX_WIDTH: ['720px'],
      CONTAINER_PADDING: ['32px'],
      CONTAINER_BORDER_RADIUS: ['18px'],
      CONTAINER_INNER_BACKGROUND_COLOR: ['#FFF8EE', '#2b2420'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#E9D8C4', '#1a1512'],
      CONTAINER_SHADOW_COLOR: ['RGBA(90,60,30,0.18)'],
      CONTAINER_SHADOW_OFFSET: ['0px', '6px'],
      CONTAINER_SHADOW_BLUR: ['24px'],
      CONTENT_FONT: ['Nunito', 'Fraunces'],
      CONTENT_TEXT_COLOR: ['#4a3b30', '#eadccd'],
      CONTENT_LINK_COLOR: ['#b5543a', '#f0a080'],
      CONTENT_BULLET_COLOR: ['#c98b5a'],
    }, [
      b('banner', { name: 'robin’s little corner', tagline: 'collector of small joys ✿', nameColor: '' }),
      b('profileCard'),
      b('status'),
      b('divider', { style: 'symbols', symbols: '❀ ── ✿ ── ❀', color: '#c98b5a' }),
      preset('likes-dislikes'),
      b('interests', { title: 'interests', tagStyle: 'code' }),
      b('currently'),
      preset('favorites'),
      b('links'),
      b('boundaries'),
      b('updates'),
    ], [['#b5543a', 'Accent'], ['#c98b5a', 'Caramel'], ['#4a3b30', 'Ink'], ['#FFF8EE', 'Paper'], ['#E9D8C4', 'Sand']]),
  },
  {
    id: 'dash',
    name: 'Tumblr Dash',
    description: 'Navy dashboard, white post cards, blue links',
    swatch: ['#001935', '#ffffff', '#00b8ff'],
    make: () => project('dash', {
      PAGE_TITLE: ['@yourname'],
      CONTAINER_MAX_WIDTH: ['640px'],
      CONTAINER_PADDING: ['24px'],
      CONTAINER_BORDER_RADIUS: ['8px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#001935'],
      CONTAINER_INNER_BACKGROUND_COLOR: ['#ffffff', '#1d2f45'],
      CONTENT_FONT: ['Figtree'],
      CONTENT_TEXT_COLOR: ['#1d1d1d', '#e8eef5'],
      CONTENT_LINK_COLOR: ['#0083c2', '#00b8ff'],
      CONTENT_BULLET_COLOR: ['#00b8ff'],
      ACCESS_RECOMMENDED_THEME: ['dark'],
    }, [
      b('profileCard', { side: 'top', name: '@yourname', avatarSize: '120px', details: 'art · games · chaos', bio: 'just a little guy posting about the things I love', clear: false }),
      b('socials'),
      b('divider'),
      b('facts', { title: 'about', titleLevel: '3' }),
      b('interests', { title: 'tags I track', style: 'grid', tagStyle: 'plain', columns: 3, headerMode: 'empty' }),
      b('updates', { title: 'recent posts', style: 'posts' }),
      b('playlist'),
      b('links', { title: '', style: 'inline', bold: false }),
    ], [['#001935', 'Navy'], ['#00b8ff', 'Link blue'], ['#0083c2', 'Deep blue'], ['#1d1d1d', 'Ink'], ['#ffffff', 'Card']]),
  },
  {
    id: 'y2k',
    name: 'Y2K Starlight',
    description: 'Neon on midnight, pixel headings, glow',
    swatch: ['#0b0033', '#ff6ad5', '#7df9ff'],
    make: () => project('y2k starlight', {
      PAGE_TITLE: ['✧ welcome 2 my page ✧'],
      ACCESS_RECOMMENDED_THEME: ['dark'],
      CONTAINER_MAX_WIDTH: ['680px'],
      CONTAINER_PADDING: ['28px'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#0b0033'],
      CONTAINER_INNER_BACKGROUND_COLOR: ['RGBA(25,0,70,0.92)'],
      CONTAINER_BORDER_STYLE: ['double'],
      CONTAINER_BORDER_WIDTH: ['6px'],
      CONTAINER_BORDER_COLOR: ['#ff6ad5'],
      CONTENT_FONT: ['Space_Mono', 'Silkscreen'],
      CONTENT_TEXT_COLOR: ['#f7d6ff'],
      CONTENT_LINK_COLOR: ['#7df9ff'],
      CONTENT_BULLET_COLOR: ['#ff6ad5'],
      CONTENT_TEXT_SHADOW_COLOR: ['#ff00ff'],
      CONTENT_TEXT_SHADOW_OFFSET: ['0px', '0px'],
      CONTENT_TEXT_SHADOW_BLUR: ['6px'],
    }, [
      b('divider', { style: 'symbols', symbols: '✧･ﾟ: *✧･ﾟ:*  welcome  *:･ﾟ✧*:･ﾟ✧', color: '#7df9ff' }),
      b('profileCard', { side: 'top', name: '☆ starlight ☆', nameColor: '#ff6ad5', details: 'online since 2001', detailsColor: '#7df9ff', bio: 'pixel art, eurobeat and ==glitter gel pens==', clear: false }),
      b('status', { emoji: '💿', label: 'now playing', text: 'Daft Punk — Digital Love', style: 'mark' }),
      b('interests', { title: '', tagStyle: 'code', align: 'center', tags: [['tamagotchi', 'hotpink'], ['bubble tea', 'aqua'], ['sailor moon', 'violet'], ['flip phones', 'lime'], ['webrings', 'gold']].map(([text, color]) => ({ text, color })) }),
      b('columns', { count: 2, title0: '✦ likes', title1: '✦ dislikes', align0: 'center', align1: 'center' }, [
        [b('list', { items: [{ text: 'glitter', indent: 0 }, { text: 'midi music', indent: 0 }, { text: 'cyber cafes', indent: 0 }] })],
        [b('list', { items: [{ text: 'dial-up noise', indent: 0 }, { text: 'pop-ups', indent: 0 }, { text: 'no autosave', indent: 0 }] })],
      ]),
      b('links', { title: '⟡ links ⟡', titleColor: '#7df9ff' }),
      b('admonition', { kind: 'note', title: '♡ sign my guestbook', text: 'leave a note on my *ask box* — I read everything!' }),
    ], [['#ff6ad5', 'Bubblegum'], ['#7df9ff', 'Cyber'], ['#f7d6ff', 'Lilac'], ['#0b0033', 'Midnight'], ['#ff00ff', 'Glow']]),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean type, lots of space, no frills',
    swatch: ['#f6f6f4', '#ffffff', '#222222'],
    make: () => project('minimal', {
      CONTAINER_MAX_WIDTH: ['600px'],
      CONTAINER_PADDING: ['36px'],
      CONTAINER_INNER_BACKGROUND_COLOR: ['transparent'],
      CONTAINER_OUTER_BACKGROUND_COLOR: ['#f6f6f4', '#141414'],
      CONTENT_FONT: ['DM_Sans', 'DM_Serif_Display'],
      CONTENT_TEXT_COLOR: ['#2a2a2a', '#e6e6e6'],
      CONTENT_LINK_COLOR: ['#2a2a2a', '#ffffff'],
    }, [
      b('heading', { text: 'Robin Vale', level: '1' }),
      b('paragraph', { text: 'Illustrator and occasional writer. I like quiet mornings, long walks and making small things by hand.', style: 'plain' }),
      b('facts', { title: '', layout: 'list', keyStyle: 'plain', keyColor: 'gray', rows: [{ key: 'based in', value: 'Lisbon' }, { key: 'working on', value: 'a picture book' }, { key: 'reading', value: 'The Overstory' }] }),
      b('links', { title: 'elsewhere', titleLevel: '4', style: 'list', bold: false, align: 'auto', items: [{ label: 'portfolio', url: 'https://example.com', emoji: '' }, { label: 'newsletter', url: 'https://example.com/news', emoji: '' }] }),
    ], [['#2a2a2a', 'Ink'], ['#f6f6f4', 'Paper'], ['gray', 'Muted']]),
  },
];

export const blankProject = (): Project => project('untitled', {}, []);
