// Full rentry metadata schema, transcribed from GUIDE/METADATA HOW.txt.
// Drives the Page inspector, the validator and the serializer.

export type MetaGroup =
  | 'PAGE' | 'SHARE' | 'OPTION' | 'ACCESS' | 'SECRET' | 'SAFETY' | 'CONTAINER' | 'CONTENT';

export const META_GROUP_ORDER: MetaGroup[] = [
  'PAGE', 'SHARE', 'OPTION', 'ACCESS', 'SECRET', 'SAFETY', 'CONTAINER', 'CONTENT',
];

export type Unit = 'px' | '%' | 'vh' | 'hw' | 'rem' | 'vw' | 'no-unit';
export interface UnitRange { unit: Unit; min: number; max: number; decimals: number }

export type Validator =
  | 'text' | 'url' | 'image_data_uri' | 'bool' | 'whitelist' | 'color' | 'css_size'
  | 'font_name' | 'email' | 'rentry_url' | 'raw_access_code';

/** How multiple values map to meaning (drives the control UI). */
export type Mapping =
  | 'sides'        // 1–4 values: all / vertical horizontal / t lr b / t r b l
  | 'lightdark'    // 1–2 values: all modes / light dark
  | 'xy'           // 1–2 values: x+y / x y
  | 'fonts'        // 1–2 values: all / paragraphs headings
  | 'repeat2'      // 1–2 values: all / top-middle-bottom left-right
  | 'links'        // 1–2 values: all / internal external
  | 'textsizes'    // positional list of 12
  | 'multi';       // unordered multi select

export type Control =
  | 'text' | 'textarea' | 'image' | 'toggle' | 'select' | 'chips' | 'color' | 'size'
  | 'sizeOrKeyword' | 'sides' | 'pair' | 'textSizes' | 'font' | 'raw';

export interface MetaOption {
  key: string;
  group: MetaGroup;
  label: string;
  help: string;
  maxLength: number;
  maxValues: number;
  validate: Validator[];
  units?: UnitRange[];
  whitelist?: string[];
  requires?: string[];
  requiresOne?: string[];
  mapping?: Mapping;
  /** Single value that may contain spaces (titles, descriptions). */
  freeText?: boolean;
  control: Control;
  /** For sides/pair controls: the editor used for each individual value. */
  valueControl?: 'size' | 'color' | 'select' | 'sizeOrKeyword' | 'font';
  defaultHint?: string;
  allowDataUri?: boolean;
}

const r = (unit: Unit, min: number, max: number, decimals: number): UnitRange => ({ unit, min, max, decimals });

const BG_SIZE_UNITS = [r('px', 1, 3000, 0), r('%', 0.1, 150, 3), r('vh', 0.1, 200, 4), r('hw', 0.1, 200, 4), r('rem', 0.1, 50, 4)];
const SHADOW_SIZE_UNITS = [r('px', 0, 30, 0), r('%', 0, 10, 3), r('vh', 0, 5, 4), r('hw', 0, 5, 4), r('rem', 0, 3, 4)];
const REPEAT = ['no-repeat', 'repeat-x', 'repeat-y', 'round', 'space'];
const POSITION = ['bottom', 'center', 'left', 'right', 'top'];
const WARN3 = ['adult', 'epilepsy', 'sensitive'];
const FONT_WEIGHTS = ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

const text = (key: string, group: MetaGroup, label: string, help: string, maxLength: number, textarea = false): MetaOption => ({
  key, group, label, help, maxLength, maxValues: 1, validate: ['text'], freeText: true, control: textarea ? 'textarea' : 'text',
});
const bool = (key: string, group: MetaGroup, label: string, help: string): MetaOption => ({
  key, group, label, help, maxLength: 5, maxValues: 1, validate: ['bool'], control: 'toggle',
});
const image = (key: string, group: MetaGroup, label: string, help: string, allowDataUri: boolean): MetaOption => ({
  key, group, label, help, maxLength: allowDataUri ? 32768 : 1000, maxValues: 1,
  validate: allowDataUri ? ['url', 'image_data_uri'] : ['url'], control: 'image', allowDataUri,
});
const color = (key: string, label: string, help: string, maxLength = 32, lightDark = true): MetaOption => ({
  key, group: key.startsWith('CONTENT') ? 'CONTENT' : 'CONTAINER', label, help, maxLength,
  maxValues: lightDark ? 2 : 1, validate: ['color'], control: lightDark ? 'pair' : 'color',
  mapping: lightDark ? 'lightdark' : undefined, valueControl: 'color',
});
const select = (key: string, group: MetaGroup, label: string, help: string, whitelist: string[], maxLength: number): MetaOption => ({
  key, group, label, help, maxLength, maxValues: 1, validate: ['whitelist'], whitelist, control: 'select',
});

export const META_OPTIONS: MetaOption[] = [
  // PAGE
  text('PAGE_TITLE', 'PAGE', 'Page title', "Appears on the browser tab. Defaults to the page content.", 60),
  text('PAGE_DESCRIPTION', 'PAGE', 'Description', 'Used by search engines and content snippets.', 160, true),
  image('PAGE_IMAGE', 'PAGE', 'Page image', 'Used by search engines and content snippets.', false),
  image('PAGE_ICON', 'PAGE', 'Tab icon', 'Icon shown in the browser tab. Link or small base64 image.', true),
  // SHARE
  text('SHARE_TITLE', 'SHARE', 'Share title', 'Title for link previews. Defaults to Page title.', 60),
  text('SHARE_DESCRIPTION', 'SHARE', 'Share description', 'Description for link previews. Defaults to Page description.', 160, true),
  image('SHARE_IMAGE', 'SHARE', 'Share image', 'Image for link previews. Defaults to Page image.', false),
  text('SHARE_TWITTER_TITLE', 'SHARE', 'Twitter title', 'Title used by Twitter-compatible platforms.', 60),
  text('SHARE_TWITTER_DESCRIPTION', 'SHARE', 'Twitter description', 'Description used by Twitter-compatible platforms.', 160, true),
  image('SHARE_TWITTER_IMAGE', 'SHARE', 'Twitter image', 'Preview image used by Twitter-compatible platforms.', false),
  // OPTION
  bool('OPTION_DISABLE_VIEWS', 'OPTION', 'Hide view counter', 'Disables and hides the view counter.'),
  bool('OPTION_DISABLE_SEARCH_ENGINE', 'OPTION', 'Hide from search engines', 'Removes the page from the sitemap and asks crawlers not to index it.'),
  bool('OPTION_USE_ORIGINAL_PUB_DATE', 'OPTION', 'Original publish date', 'Show the date the URL was first published.'),
  // ACCESS
  select('ACCESS_RECOMMENDED_THEME', 'ACCESS', 'Recommended theme', 'Auto-switch viewers to this mode.', ['light', 'dark'], 5),
  { key: 'ACCESS_EASY_READ', group: 'ACCESS', label: 'Easy-read page', help: 'A rentry URL (/shorthand or full) for an easy-read version.', maxLength: 300, maxValues: 1, validate: ['rentry_url'], freeText: true, control: 'text' },
  // SECRET
  text('SECRET_VERIFY', 'SECRET', 'Recovery accounts', 'External accounts you can use to recover the edit code. Hidden after saving.', 3000, true),
  { key: 'SECRET_RAW_ACCESS_CODE', group: 'SECRET', label: 'Raw access code', help: 'Code from rentry support that unlocks /raw access.', maxLength: 100, maxValues: 1, validate: ['raw_access_code'], freeText: true, control: 'text' },
  { key: 'SECRET_EMAIL_ADDRESS', group: 'SECRET', label: 'Recovery email', help: 'Email used to manually reset your edit code.', maxLength: 300, maxValues: 1, validate: ['email'], freeText: true, control: 'text' },
  // SAFETY
  { key: 'SAFETY_PAGE_WARNING', group: 'SAFETY', label: 'Page warning', help: 'Warning popup shown before visitors can view the page.', maxLength: 100, maxValues: 4, validate: ['whitelist'], whitelist: ['adult', 'sensitive', 'epilepsy', 'custom'], control: 'chips', mapping: 'multi' },
  text('SAFETY_PAGE_WARNING_DESCRIPTION', 'SAFETY', 'Warning text', 'Your own text for the page warning popup.', 240, true),
  bool('SAFETY_MEDIA_BLUR', 'SAFETY', 'Blur media', 'Blur all images until clicked.'),
  { key: 'SAFETY_LINK_WARNING', group: 'SAFETY', label: 'Link warning', help: 'Popup when clicking links in your content.', maxLength: 100, maxValues: 3, validate: ['whitelist'], whitelist: WARN3, control: 'chips', mapping: 'multi' },
  text('SAFETY_LINK_WARNING_DESCRIPTION', 'SAFETY', 'Link warning text', 'Your own text for the link warning popup.', 240, true),
  { key: 'SAFETY_PAGE_FLAG', group: 'SAFETY', label: 'Content flags', help: 'Visual icon informing readers of certain material (no popup).', maxLength: 100, maxValues: 3, validate: ['whitelist'], whitelist: WARN3, control: 'chips', mapping: 'multi' },
  // CONTAINER — layout
  { key: 'CONTAINER_PADDING', group: 'CONTAINER', label: 'Padding', help: 'Space between the container edge and the content.', maxLength: 64, maxValues: 4, validate: ['css_size'], units: [r('px', 0, 40, 0), r('%', 0, 25, 3), r('vh', 0, 15, 4), r('hw', 0, 20, 4), r('rem', 0, 7, 4)], mapping: 'sides', control: 'sides', valueControl: 'size', defaultHint: '20px' },
  { key: 'CONTAINER_MAX_WIDTH', group: 'CONTAINER', label: 'Max width', help: 'Limits and centers the content container.', maxLength: 16, maxValues: 1, validate: ['css_size'], units: [r('px', 100, 1600, 0), r('%', 10, 100, 3), r('vh', 10, 100, 4), r('hw', 10, 100, 4), r('rem', 3, 25, 4)], control: 'size' },
  // CONTAINER — inner
  color('CONTAINER_INNER_FOREGROUND_COLOR', 'Inner tint', 'Layer on top of the content. Use ~0.2 transparency for a tint.'),
  color('CONTAINER_INNER_BACKGROUND_COLOR', 'Inner background', 'Background of the content box. Use transparent with a border image.'),
  image('CONTAINER_INNER_BACKGROUND_IMAGE', 'CONTAINER', 'Inner image', 'Background image behind the content.', true),
  select('CONTAINER_INNER_BACKGROUND_IMAGE_REPEAT', 'CONTAINER', 'Inner repeat', 'How the inner background image repeats.', REPEAT, 16),
  select('CONTAINER_INNER_BACKGROUND_IMAGE_POSITION', 'CONTAINER', 'Inner position', 'Position of the inner background image.', POSITION, 6),
  { key: 'CONTAINER_INNER_BACKGROUND_IMAGE_SIZE', group: 'CONTAINER', label: 'Inner size', help: 'cover = stretch, contain = fit without distortion.', maxLength: 16, maxValues: 1, validate: ['whitelist', 'css_size'], whitelist: ['contain', 'cover'], units: BG_SIZE_UNITS, control: 'sizeOrKeyword' },
  // CONTAINER — outer
  color('CONTAINER_OUTER_FOREGROUND_COLOR', 'Outer tint', 'Layer over the page background (not the content box). Needs transparency.'),
  color('CONTAINER_OUTER_BACKGROUND_COLOR', 'Page background', 'The very back of the page.'),
  image('CONTAINER_OUTER_BACKGROUND_IMAGE', 'CONTAINER', 'Page image', 'Page background image, above the page color.', true),
  select('CONTAINER_OUTER_BACKGROUND_IMAGE_REPEAT', 'CONTAINER', 'Page repeat', 'How the page background image repeats.', REPEAT, 16),
  select('CONTAINER_OUTER_BACKGROUND_IMAGE_POSITION', 'CONTAINER', 'Page position', 'Position of the page background image.', POSITION, 16),
  { key: 'CONTAINER_OUTER_BACKGROUND_IMAGE_SIZE', group: 'CONTAINER', label: 'Page size', help: 'cover = stretch, contain = fit without distortion.', maxLength: 16, maxValues: 1, validate: ['whitelist', 'css_size'], whitelist: ['contain', 'cover'], units: BG_SIZE_UNITS, control: 'sizeOrKeyword' },
  // CONTAINER — border image
  image('CONTAINER_BORDER_IMAGE', 'CONTAINER', 'Border image', 'Image the border is drawn with.', true),
  { key: 'CONTAINER_BORDER_IMAGE_SLICE', group: 'CONTAINER', label: 'Slice', help: 'How the border image is cut up, e.g. "30" or "30% fill".', maxLength: 64, maxValues: 4, validate: ['whitelist', 'css_size'], whitelist: ['fill'], units: [r('no-unit', 0, 20, 0), r('%', 0, 100, 3)], requires: ['CONTAINER_BORDER_IMAGE', 'CONTAINER_BORDER_IMAGE_WIDTH'], control: 'raw' },
  { key: 'CONTAINER_BORDER_IMAGE_WIDTH', group: 'CONTAINER', label: 'Image width', help: 'Width of the border image.', maxLength: 64, maxValues: 4, validate: ['whitelist', 'css_size'], whitelist: ['auto'], units: [r('px', 0, 30, 0), r('no-unit', 0, 20, 0), r('%', 0, 100, 3)], requires: ['CONTAINER_BORDER_IMAGE'], mapping: 'sides', control: 'sides', valueControl: 'sizeOrKeyword' },
  { key: 'CONTAINER_BORDER_IMAGE_OUTSET', group: 'CONTAINER', label: 'Outset', help: 'How far the border image sits outside the container.', maxLength: 64, maxValues: 4, validate: ['whitelist', 'css_size'], whitelist: ['auto'], units: [r('px', 0, 30, 0), r('no-unit', 0, 20, 0)], requires: ['CONTAINER_BORDER_IMAGE', 'CONTAINER_BORDER_IMAGE_WIDTH'], mapping: 'sides', control: 'sides', valueControl: 'sizeOrKeyword' },
  { key: 'CONTAINER_BORDER_IMAGE_REPEAT', group: 'CONTAINER', label: 'Image repeat', help: 'How the image repeats along the border.', maxLength: 32, maxValues: 2, validate: ['whitelist'], whitelist: ['stretch', 'repeat', 'round', 'space'], requires: ['CONTAINER_BORDER_IMAGE', 'CONTAINER_BORDER_IMAGE_WIDTH'], mapping: 'repeat2', control: 'pair', valueControl: 'select' },
  // CONTAINER — border
  { key: 'CONTAINER_BORDER_COLOR', group: 'CONTAINER', label: 'Border color', help: 'Color of the border, per side.', maxLength: 120, maxValues: 4, validate: ['color'], requires: ['CONTAINER_BORDER_WIDTH', 'CONTAINER_BORDER_STYLE'], mapping: 'sides', control: 'sides', valueControl: 'color' },
  { key: 'CONTAINER_BORDER_WIDTH', group: 'CONTAINER', label: 'Border width', help: 'Thickness of the border.', maxLength: 64, maxValues: 4, validate: ['css_size'], units: [r('px', 0, 40, 0), r('%', 0, 15, 3), r('vh', 0, 5, 4), r('hw', 0, 5, 4), r('rem', 0, 4, 4)], requires: ['CONTAINER_BORDER_STYLE'], mapping: 'sides', control: 'sides', valueControl: 'size' },
  { key: 'CONTAINER_BORDER_STYLE', group: 'CONTAINER', label: 'Border style', help: 'Appearance of the border.', maxLength: 64, maxValues: 4, validate: ['whitelist'], whitelist: ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'], requires: ['CONTAINER_BORDER_WIDTH'], mapping: 'sides', control: 'sides', valueControl: 'select' },
  { key: 'CONTAINER_BORDER_RADIUS', group: 'CONTAINER', label: 'Corner radius', help: 'Rounds the container corners (works without a border).', maxLength: 64, maxValues: 4, validate: ['css_size'], units: [r('px', 0, 200, 0), r('%', 0, 50, 3), r('vh', 0, 40, 4), r('hw', 0, 40, 4), r('rem', 0, 30, 4)], mapping: 'sides', control: 'sides', valueControl: 'size' },
  // CONTAINER — shadow
  { ...color('CONTAINER_SHADOW_COLOR', 'Shadow color', 'Color of the container shadow.', 32, false), requiresOne: ['CONTAINER_SHADOW_OFFSET', 'CONTAINER_SHADOW_SPREAD', 'CONTAINER_SHADOW_BLUR'] },
  { key: 'CONTAINER_SHADOW_OFFSET', group: 'CONTAINER', label: 'Shadow offset', help: 'Horizontal then vertical offset.', maxLength: 32, maxValues: 2, validate: ['css_size'], units: [r('px', -15, 15, 0), r('%', -5, 5, 3), r('vh', -2, 2, 4), r('hw', -2, 2, 4), r('rem', -4, 2, 4)], requires: ['CONTAINER_SHADOW_COLOR'], mapping: 'xy', control: 'pair', valueControl: 'size' },
  { key: 'CONTAINER_SHADOW_SPREAD', group: 'CONTAINER', label: 'Shadow spread', help: 'Thickness of the shadow.', maxLength: 12, maxValues: 1, validate: ['css_size'], units: SHADOW_SIZE_UNITS, requires: ['CONTAINER_SHADOW_COLOR'], control: 'size' },
  { key: 'CONTAINER_SHADOW_BLUR', group: 'CONTAINER', label: 'Shadow blur', help: 'Blurriness of the shadow.', maxLength: 12, maxValues: 1, validate: ['css_size'], units: SHADOW_SIZE_UNITS, requires: ['CONTAINER_SHADOW_COLOR'], control: 'size' },
  // CONTENT
  { key: 'CONTENT_FONT', group: 'CONTENT', label: 'Font', help: 'Any Google font. Spaces become underscores.', maxLength: 1000, maxValues: 2, validate: ['font_name'], mapping: 'fonts', control: 'pair', valueControl: 'font' },
  { key: 'CONTENT_FONT_WEIGHT', group: 'CONTENT', label: 'Font weight', help: 'Boldness, applied to the fonts in the same order.', maxLength: 24, maxValues: 2, validate: ['whitelist'], whitelist: FONT_WEIGHTS, mapping: 'fonts', control: 'pair', valueControl: 'select' },
  select('CONTENT_TEXT_DIRECTION', 'CONTENT', 'Direction', 'rtl for right-to-left languages.', ['ltr', 'rtl'], 7),
  { key: 'CONTENT_TEXT_SIZE', group: 'CONTENT', label: 'Text sizes', help: 'Base sets the root size; use rem for the rest. 0 = keep default.', maxLength: 128, maxValues: 12, validate: ['css_size'], units: [r('px', 8, 64, 0), r('rem', 0.3, 8, 4), r('%', 10, 500, 3), r('vh', 2, 10, 4), r('hw', 2, 10, 4), r('no-unit', 0, 0, 0)], mapping: 'textsizes', control: 'textSizes', defaultHint: '16px 1rem 2.5rem 2rem 1.75rem 1.5rem 1.25rem 1rem 1rem 1rem 1rem 14px' },
  select('CONTENT_TEXT_ALIGN', 'CONTENT', 'Text align', 'Default is left. Justify makes lines equal width.', ['center', 'right', 'justify'], 7),
  { ...color('CONTENT_TEXT_SHADOW_COLOR', 'Text shadow', 'Color of the text shadow.', 32, false), requires: ['CONTENT_TEXT_SHADOW_OFFSET'] },
  { key: 'CONTENT_TEXT_SHADOW_OFFSET', group: 'CONTENT', label: 'Shadow offset', help: 'Horizontal then vertical offset.', maxLength: 32, maxValues: 2, validate: ['css_size'], units: [r('px', -15, 15, 0), r('%', -5, 5, 3), r('vh', -2, 2, 4), r('hw', -2, 2, 4), r('rem', -2, 2, 4)], requires: ['CONTENT_TEXT_SHADOW_COLOR'], mapping: 'xy', control: 'pair', valueControl: 'size' },
  { key: 'CONTENT_TEXT_SHADOW_BLUR', group: 'CONTENT', label: 'Shadow blur', help: 'Blur of the text shadow.', maxLength: 12, maxValues: 1, validate: ['css_size'], units: SHADOW_SIZE_UNITS, requires: ['CONTENT_TEXT_SHADOW_COLOR', 'CONTENT_TEXT_SHADOW_OFFSET'], control: 'size' },
  color('CONTENT_TEXT_COLOR', 'Text color', 'Base text color. Inline colors override this.', 128),
  color('CONTENT_LINK_COLOR', 'Link color', 'Base link color.', 16),
  color('CONTENT_BULLET_COLOR', 'Bullet color', 'Color of list bullets.', 64),
  { key: 'CONTENT_LINK_BEHAVIOR', group: 'CONTENT', label: 'Open links', help: 'Same tab or new tab. Internal = rentry links.', maxLength: 32, maxValues: 2, validate: ['whitelist'], whitelist: ['same', 'new'], mapping: 'links', control: 'pair', valueControl: 'select', defaultHint: 'same new' },
];

export const META_BY_KEY: Record<string, MetaOption> = Object.fromEntries(META_OPTIONS.map((o) => [o.key, o]));

export const TEXT_SIZE_LABELS = [
  'Base', 'Paragraphs', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6',
  'List items', 'Links', 'Quotes', 'Code',
];

export const MAPPING_LABELS: Record<string, { single: string; pair?: [string, string] }> = {
  lightdark: { single: 'All modes', pair: ['Light', 'Dark'] },
  xy: { single: 'X & Y', pair: ['X', 'Y'] },
  fonts: { single: 'All text', pair: ['Body', 'Headings'] },
  repeat2: { single: 'All edges', pair: ['Top/bottom', 'Sides'] },
  links: { single: 'All links', pair: ['Internal', 'External'] },
};

/** Inspector sections for the Page tab (each lists option keys in display order). */
export const PAGE_SECTIONS: { id: string; title: string; keys: string[]; collapsed?: boolean }[] = [
  { id: 'page', title: 'Page & SEO', keys: ['PAGE_TITLE', 'PAGE_DESCRIPTION', 'PAGE_IMAGE', 'PAGE_ICON'] },
  { id: 'share', title: 'Link previews', collapsed: true, keys: ['SHARE_TITLE', 'SHARE_DESCRIPTION', 'SHARE_IMAGE', 'SHARE_TWITTER_TITLE', 'SHARE_TWITTER_DESCRIPTION', 'SHARE_TWITTER_IMAGE'] },
  { id: 'type', title: 'Typography', keys: ['CONTENT_FONT', 'CONTENT_FONT_WEIGHT', 'CONTENT_TEXT_SIZE', 'CONTENT_TEXT_ALIGN', 'CONTENT_TEXT_DIRECTION'] },
  { id: 'colors', title: 'Text colors', keys: ['CONTENT_TEXT_COLOR', 'CONTENT_LINK_COLOR', 'CONTENT_BULLET_COLOR'] },
  { id: 'tshadow', title: 'Text shadow', collapsed: true, keys: ['CONTENT_TEXT_SHADOW_COLOR', 'CONTENT_TEXT_SHADOW_OFFSET', 'CONTENT_TEXT_SHADOW_BLUR'] },
  { id: 'layout', title: 'Container layout', keys: ['CONTAINER_MAX_WIDTH', 'CONTAINER_PADDING', 'CONTAINER_BORDER_RADIUS'] },
  { id: 'inner', title: 'Content box fill', keys: ['CONTAINER_INNER_BACKGROUND_COLOR', 'CONTAINER_INNER_FOREGROUND_COLOR', 'CONTAINER_INNER_BACKGROUND_IMAGE', 'CONTAINER_INNER_BACKGROUND_IMAGE_REPEAT', 'CONTAINER_INNER_BACKGROUND_IMAGE_POSITION', 'CONTAINER_INNER_BACKGROUND_IMAGE_SIZE'] },
  { id: 'outer', title: 'Page background', keys: ['CONTAINER_OUTER_BACKGROUND_COLOR', 'CONTAINER_OUTER_FOREGROUND_COLOR', 'CONTAINER_OUTER_BACKGROUND_IMAGE', 'CONTAINER_OUTER_BACKGROUND_IMAGE_REPEAT', 'CONTAINER_OUTER_BACKGROUND_IMAGE_POSITION', 'CONTAINER_OUTER_BACKGROUND_IMAGE_SIZE'] },
  { id: 'border', title: 'Border', collapsed: true, keys: ['CONTAINER_BORDER_STYLE', 'CONTAINER_BORDER_WIDTH', 'CONTAINER_BORDER_COLOR'] },
  { id: 'bimage', title: 'Border image', collapsed: true, keys: ['CONTAINER_BORDER_IMAGE', 'CONTAINER_BORDER_IMAGE_WIDTH', 'CONTAINER_BORDER_IMAGE_SLICE', 'CONTAINER_BORDER_IMAGE_OUTSET', 'CONTAINER_BORDER_IMAGE_REPEAT'] },
  { id: 'shadow', title: 'Shadow', collapsed: true, keys: ['CONTAINER_SHADOW_COLOR', 'CONTAINER_SHADOW_OFFSET', 'CONTAINER_SHADOW_BLUR', 'CONTAINER_SHADOW_SPREAD'] },
  { id: 'behavior', title: 'Behavior & access', collapsed: true, keys: ['CONTENT_LINK_BEHAVIOR', 'ACCESS_RECOMMENDED_THEME', 'ACCESS_EASY_READ', 'OPTION_DISABLE_VIEWS', 'OPTION_DISABLE_SEARCH_ENGINE', 'OPTION_USE_ORIGINAL_PUB_DATE'] },
  { id: 'safety', title: 'Safety', collapsed: true, keys: ['SAFETY_PAGE_WARNING', 'SAFETY_PAGE_WARNING_DESCRIPTION', 'SAFETY_MEDIA_BLUR', 'SAFETY_LINK_WARNING', 'SAFETY_LINK_WARNING_DESCRIPTION', 'SAFETY_PAGE_FLAG'] },
  { id: 'secret', title: 'Secret (hidden after save)', collapsed: true, keys: ['SECRET_VERIFY', 'SECRET_RAW_ACCESS_CODE', 'SECRET_EMAIL_ADDRESS'] },
];
