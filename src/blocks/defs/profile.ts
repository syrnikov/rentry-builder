import { AtSign, IdCard, Link2, Music, Newspaper, PanelTop, ShieldAlert, Smile, Sparkles, Table2, Tags } from 'lucide-react';
import type { BlockDef, Field } from '../types';
import { alignField, applyTextStyle, cell, gridTable, heading, HEADER_MODE_OPTIONS, IMAGE_UNITS, join, LEVEL_OPTIONS, lines, renderTitle, tableAlign, TEXT_STYLE_OPTIONS, titleDefaults, titleFields } from '../common';
import { admonition } from './text';
import { alignLine, bold, color, image, italic, link, resolveAlign, table } from '../../rentry/inline';
import type { Props } from '../../model/types';

const sepField: Field = { kind: 'text', key: 'separator', label: 'Separator', showIf: (p) => p.style === 'inline' };

// ───────────────────────── Banner
export const bannerDef: BlockDef = {
  type: 'banner',
  label: 'Banner',
  icon: PanelTop,
  category: 'profile',
  description: 'Header image with your name',
  primaryText: 'name',
  defaults: () => ({ image: 'https://picsum.photos/seed/rentry-banner/1200/300', width: '100%', height: '200px', name: 'your name here', nameLevel: '1', nameColor: '', nameUnderline: { on: false }, tagline: 'collector of small joys ✿', taglineColor: '', taglineStyle: 'italic', align: 'center' }),
  groups: [
    { title: 'Image', fields: [{ kind: 'image', key: 'image', label: 'Source' }, { kind: 'size', key: 'width', label: 'Width', units: IMAGE_UNITS }, { kind: 'size', key: 'height', label: 'Height', units: IMAGE_UNITS }] },
    { title: 'Name', fields: [{ kind: 'text', key: 'name', label: 'Name' }, { kind: 'segmented', key: 'nameLevel', label: 'Level', options: LEVEL_OPTIONS.slice(0, 3) }, { kind: 'color', key: 'nameColor', label: 'Color' }, { kind: 'underline', key: 'nameUnderline', label: 'Underline' }] },
    { title: 'Tagline', fields: [{ kind: 'text', key: 'tagline', label: 'Tagline' }, { kind: 'color', key: 'taglineColor', label: 'Color' }, { kind: 'segmented', key: 'taglineStyle', label: 'Style', options: TEXT_STYLE_OPTIONS.slice(0, 4) }] },
    { title: 'Layout', fields: [alignField()] },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    return join(
      p.image?.trim() && alignLine(image({ url: p.image, alt: 'banner', width: p.width, height: p.height }), a),
      heading(p.name ?? '', p.nameLevel, a, p.nameColor, p.nameUnderline),
      p.tagline?.trim() && alignLine(color(applyTextStyle(p.tagline, p.taglineStyle), p.taglineColor), a),
    );
  },
};

// ───────────────────────── Profile card
export const profileCardDef: BlockDef = {
  type: 'profileCard',
  label: 'Profile card',
  icon: IdCard,
  category: 'profile',
  description: 'Avatar, name, pronouns and bio',
  primaryText: 'bio',
  defaults: () => ({
    avatar: 'https://picsum.photos/seed/rentry-avatar/300/300', avatarSize: '140px', side: 'left',
    name: 'Hi, I’m Robin!', nameLevel: '2', nameColor: '', pronouns: 'they/them', details: '24 · Earth · INFP ☾', detailsColor: 'gray',
    bio: 'Professional daydreamer, part-time plant parent. I write tiny stories and collect pretty rocks.', clear: true,
  }),
  groups: [
    { title: 'Avatar', fields: [{ kind: 'image', key: 'avatar', label: 'Source' }, { kind: 'size', key: 'avatarSize', label: 'Size', units: IMAGE_UNITS }, { kind: 'segmented', key: 'side', label: 'Side', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'top', label: 'Top' }] }] },
    { title: 'Identity', fields: [{ kind: 'text', key: 'name', label: 'Name' }, { kind: 'segmented', key: 'nameLevel', label: 'Level', options: LEVEL_OPTIONS.slice(0, 4) }, { kind: 'color', key: 'nameColor', label: 'Name color' }, { kind: 'text', key: 'pronouns', label: 'Pronouns' }, { kind: 'text', key: 'details', label: 'Details', placeholder: 'age · place · sign' }, { kind: 'color', key: 'detailsColor', label: 'Details color' }] },
    { title: 'Bio', fields: [{ kind: 'textarea', key: 'bio', label: 'Bio', rich: true, rows: 4 }, { kind: 'toggle', key: 'clear', label: 'Clear float after', hint: 'Stops following blocks from wrapping around the avatar.' }] },
  ],
  toMarkdown: (b) => {
    const p = b.props;
    const top = p.side === 'top';
    const sub = [p.pronouns?.trim() && italic(p.pronouns), p.details?.trim() && color(p.details, p.detailsColor)].filter(Boolean).join(' · ');
    const a = top ? 'center' : 'left';
    return join(
      p.avatar?.trim() && (top
        ? alignLine(image({ url: p.avatar, alt: 'avatar', width: p.avatarSize, height: p.avatarSize }), 'center')
        : image({ url: p.avatar, alt: 'avatar', width: p.avatarSize, height: p.avatarSize, float: p.side })),
      heading(p.name ?? '', p.nameLevel, a, p.nameColor),
      sub && alignLine(sub, a),
      (p.bio ?? '').split('\n').map((l: string) => alignLine(l, a)).join('\n'),
      p.clear && !top && '!;',
    );
  },
  lint: (b) => (b.props.avatar?.trim() ? [] : ['Profile card has no avatar image.']),
};

// ───────────────────────── Facts table
export const factsDef: BlockDef = {
  type: 'facts',
  label: 'About facts',
  icon: Table2,
  category: 'profile',
  description: 'Key / value facts (name, age, sign…)',
  defaults: () => ({
    ...titleDefaults('about me'),
    layout: 'table', keyStyle: 'bold', keyColor: '', headerKey: 'about', headerValue: '', align: 'auto',
    rows: [{ key: 'name', value: 'Robin' }, { key: 'pronouns', value: 'they/them' }, { key: 'birthday', value: 'May 4th ♉' }, { key: 'timezone', value: 'GMT+2' }],
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    {
      title: 'Layout',
      fields: [
        { kind: 'segmented', key: 'layout', label: 'Layout', options: [{ value: 'table', label: 'Table' }, { value: 'list', label: 'List' }, { value: 'inline', label: 'Inline' }] },
        { kind: 'text', key: 'headerKey', label: 'Header left', showIf: (p) => p.layout === 'table' },
        { kind: 'text', key: 'headerValue', label: 'Header right', showIf: (p) => p.layout === 'table' },
        { kind: 'segmented', key: 'keyStyle', label: 'Key style', options: TEXT_STYLE_OPTIONS },
        { kind: 'color', key: 'keyColor', label: 'Key color' },
        alignField(),
      ],
    },
    {
      title: 'Facts',
      fields: [{
        kind: 'list', key: 'rows', label: 'Rows', itemLabel: 'Fact',
        newItem: () => ({ key: 'key', value: 'value' }),
        summary: (it) => `${it.key}: ${it.value}`,
        fields: [{ kind: 'text', key: 'key', label: 'Key' }, { kind: 'text', key: 'value', label: 'Value' }],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const k = (s: string) => color(applyTextStyle(s, p.keyStyle), p.keyColor);
    const rows = (p.rows ?? []).filter((r: any) => r.key?.trim() || r.value?.trim());
    let body = '';
    if (p.layout === 'list') body = rows.map((r: any) => `- ${k(r.key + ':')} ${r.value}`).join('\n');
    else if (p.layout === 'inline') body = alignLine(rows.map((r: any) => `${k(r.key + ':')} ${r.value}`).join(' · '), a);
    else body = table([cell(p.headerKey || ' '), cell(p.headerValue || ' ')], rows.map((r: any) => [k(cell(r.key)), cell(r.value)]), [tableAlign(a), tableAlign(a)]);
    return join(renderTitle(p, a), body);
  },
};

// ───────────────────────── Interests / tags
export const interestsDef: BlockDef = {
  type: 'interests',
  label: 'Interests',
  icon: Tags,
  category: 'profile',
  description: 'Tags for fandoms, hobbies, likes',
  defaults: () => ({
    ...titleDefaults('interests'),
    style: 'inline', tagStyle: 'code', separator: ' ', columns: 3, align: 'auto', headerMode: 'first', defaultColor: '',
    tags: ['art', 'tea', 'horror films', 'cats', 'jrpgs', 'gardening'].map((text) => ({ text, color: '' })),
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    {
      title: 'Display',
      fields: [
        { kind: 'segmented', key: 'style', label: 'Layout', options: [{ value: 'inline', label: 'Inline' }, { value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }] },
        { kind: 'segmented', key: 'tagStyle', label: 'Tag style', options: TEXT_STYLE_OPTIONS },
        sepField,
        { kind: 'number', key: 'columns', label: 'Columns', min: 1, max: 8, showIf: (p) => p.style === 'grid' },
        { kind: 'segmented', key: 'headerMode', label: 'Header row', options: HEADER_MODE_OPTIONS, showIf: (p) => p.style === 'grid' },
        { kind: 'color', key: 'defaultColor', label: 'Tag color' },
        alignField(),
      ],
    },
    {
      title: 'Tags',
      fields: [{
        kind: 'list', key: 'tags', label: 'Tags', itemLabel: 'Tag',
        newItem: () => ({ text: 'new tag', color: '' }),
        summary: (it) => it.text,
        fields: [{ kind: 'text', key: 'text', label: 'Tag' }, { kind: 'color', key: 'color', label: 'Color' }],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const tags: string[] = (p.tags ?? []).filter((t: any) => t.text?.trim()).map((t: any) => color(applyTextStyle(t.text, p.tagStyle), t.color || p.defaultColor));
    let body = '';
    if (p.style === 'grid') body = gridTable(tags.map(cell), p.columns, p.headerMode, tableAlign(a === 'left' ? 'center' : a));
    else if (p.style === 'list') body = tags.map((t) => `- ${t}`).join('\n');
    else body = alignLine(tags.join(p.separator ?? ' '), a);
    return join(renderTitle(p, a), body);
  },
  toCell: (b) => {
    const p = b.props;
    const tags: string[] = (p.tags ?? []).filter((t: any) => t.text?.trim()).map((t: any) => color(applyTextStyle(cell(t.text), p.tagStyle), t.color || p.defaultColor));
    const head = p.title?.trim() ? bold(cell(p.title)) + ' \\n ' : '';
    return head + (p.style === 'list' ? tags.map((t) => '• ' + t).join(' \\n ') : tags.join(p.separator ?? ' '));
  },
};

// ───────────────────────── Links
const linkLabel = (it: Props) => `${it.emoji ? it.emoji + ' ' : ''}${it.label || it.url || 'link'}`;
export const linksDef: BlockDef = {
  type: 'links',
  label: 'Links',
  icon: Link2,
  category: 'profile',
  description: 'Link list, buttons or grid',
  defaults: () => ({
    ...titleDefaults('links'),
    style: 'buttons', bold: true, separator: ' · ', columns: 2, align: 'center', headerMode: 'first',
    items: [{ label: 'my art blog', url: 'https://example.com', emoji: '🎨' }, { label: 'ko-fi', url: 'https://ko-fi.com', emoji: '☕' }, { label: 'playlist', url: 'https://open.spotify.com', emoji: '🎧' }],
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    {
      title: 'Display',
      fields: [
        { kind: 'segmented', key: 'style', label: 'Layout', options: [{ value: 'buttons', label: 'Stack' }, { value: 'inline', label: 'Inline' }, { value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }] },
        { kind: 'toggle', key: 'bold', label: 'Bold labels' },
        sepField,
        { kind: 'number', key: 'columns', label: 'Columns', min: 1, max: 6, showIf: (p) => p.style === 'grid' },
        { kind: 'segmented', key: 'headerMode', label: 'Header row', options: HEADER_MODE_OPTIONS, showIf: (p) => p.style === 'grid' },
        alignField(),
      ],
    },
    {
      title: 'Links',
      fields: [{
        kind: 'list', key: 'items', label: 'Links', itemLabel: 'Link',
        newItem: () => ({ label: 'new link', url: 'https://', emoji: '🔗' }),
        summary: linkLabel,
        fields: [{ kind: 'emoji', key: 'emoji', label: 'Icon' }, { kind: 'text', key: 'label', label: 'Label' }, { kind: 'text', key: 'url', label: 'URL' }],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const items: string[] = (p.items ?? []).map((it: any) => {
      const l = link(linkLabel(it), it.url);
      return p.bold ? bold(l) : l;
    });
    let body = '';
    if (p.style === 'inline') body = alignLine(items.join(p.separator ?? ' · '), a);
    else if (p.style === 'list') body = items.map((t) => `- ${t}`).join('\n');
    else if (p.style === 'grid') body = gridTable(items, p.columns, p.headerMode, tableAlign(a === 'left' ? 'center' : a));
    else body = items.map((t) => alignLine(t, a)).join('\n\n');
    return join(renderTitle(p, a), body);
  },
  toCell: (b) => {
    const p = b.props;
    const items: string[] = (p.items ?? []).map((it: any) => { const l = link(cell(linkLabel(it)), it.url); return p.bold ? bold(l) : l; });
    return p.style === 'inline' ? items.join(p.separator ?? ' · ') : items.join(' \\n ');
  },
  lint: (b) => (b.props.items ?? []).filter((it: any) => !it.url?.trim() || it.url.trim() === 'https://').map((it: any) => `Link "${it.label}" has no URL.`),
};

// ───────────────────────── Socials
export const PLATFORMS: Record<string, { label: string; emoji: string; prefix: string }> = {
  tumblr: { label: 'Tumblr', emoji: '📓', prefix: 'https://www.tumblr.com/' },
  twitter: { label: 'Twitter / X', emoji: '🐦', prefix: 'https://x.com/' },
  bluesky: { label: 'Bluesky', emoji: '🦋', prefix: 'https://bsky.app/profile/' },
  instagram: { label: 'Instagram', emoji: '📷', prefix: 'https://instagram.com/' },
  tiktok: { label: 'TikTok', emoji: '🎵', prefix: 'https://tiktok.com/@' },
  youtube: { label: 'YouTube', emoji: '▶️', prefix: 'https://youtube.com/@' },
  twitch: { label: 'Twitch', emoji: '🟣', prefix: 'https://twitch.tv/' },
  discord: { label: 'Discord', emoji: '💬', prefix: '' },
  github: { label: 'GitHub', emoji: '🐙', prefix: 'https://github.com/' },
  spotify: { label: 'Spotify', emoji: '🎧', prefix: 'https://open.spotify.com/user/' },
  letterboxd: { label: 'Letterboxd', emoji: '🎬', prefix: 'https://letterboxd.com/' },
  goodreads: { label: 'Goodreads', emoji: '📚', prefix: 'https://www.goodreads.com/' },
  ao3: { label: 'AO3', emoji: '✍️', prefix: 'https://archiveofourown.org/users/' },
  pinterest: { label: 'Pinterest', emoji: '📌', prefix: 'https://pinterest.com/' },
  steam: { label: 'Steam', emoji: '🎮', prefix: 'https://steamcommunity.com/id/' },
  kofi: { label: 'Ko-fi', emoji: '☕', prefix: 'https://ko-fi.com/' },
  website: { label: 'Website', emoji: '🌐', prefix: '' },
};

const socialUrl = (it: Props) => it.url?.trim() || (PLATFORMS[it.platform]?.prefix && it.handle ? PLATFORMS[it.platform].prefix + String(it.handle).replace(/^@/, '') : '');
const socialText = (it: Props, mode: string) => {
  const pf = PLATFORMS[it.platform] ?? PLATFORMS.website;
  const name = mode === 'handle' ? (it.handle || pf.label) : mode === 'platform' ? pf.label : `${pf.label}${it.handle ? ' ' + it.handle : ''}`;
  return `${pf.emoji} ${name}`;
};

export const socialsDef: BlockDef = {
  type: 'socials',
  label: 'Socials',
  icon: AtSign,
  category: 'profile',
  description: 'Social accounts with platform presets',
  defaults: () => ({
    ...titleDefaults(''), style: 'inline', show: 'platform', separator: '  ·  ', align: 'center', columns: 3, headerMode: 'first',
    items: [{ platform: 'tumblr', handle: 'yourname', url: '' }, { platform: 'bluesky', handle: 'you.bsky.social', url: '' }, { platform: 'discord', handle: '@yourname', url: '' }],
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    {
      title: 'Display',
      fields: [
        { kind: 'segmented', key: 'style', label: 'Layout', options: [{ value: 'inline', label: 'Inline' }, { value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }] },
        { kind: 'segmented', key: 'show', label: 'Show', options: [{ value: 'platform', label: 'Platform' }, { value: 'handle', label: 'Handle' }, { value: 'both', label: 'Both' }] },
        sepField,
        { kind: 'number', key: 'columns', label: 'Columns', min: 1, max: 6, showIf: (p) => p.style === 'grid' },
        alignField(),
      ],
    },
    {
      title: 'Accounts',
      fields: [{
        kind: 'list', key: 'items', label: 'Accounts', itemLabel: 'Account',
        newItem: () => ({ platform: 'website', handle: '', url: '' }),
        summary: (it) => `${PLATFORMS[it.platform]?.emoji ?? ''} ${PLATFORMS[it.platform]?.label ?? it.platform} ${it.handle ?? ''}`,
        fields: [
          { kind: 'select', key: 'platform', label: 'Platform', options: Object.entries(PLATFORMS).map(([value, v]) => ({ value, label: `${v.emoji} ${v.label}` })) },
          { kind: 'text', key: 'handle', label: 'Handle' },
          { kind: 'text', key: 'url', label: 'URL', placeholder: 'auto from handle' },
        ],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const items: string[] = (p.items ?? []).map((it: any) => link(socialText(it, p.show), socialUrl(it)));
    let body = '';
    if (p.style === 'list') body = items.map((t) => `- ${t}`).join('\n');
    else if (p.style === 'grid') body = gridTable(items.map(cell), p.columns, p.headerMode, tableAlign(a === 'left' ? 'center' : a));
    else body = alignLine(items.join(p.separator ?? ' · '), a);
    return join(renderTitle(p, a), body);
  },
  toCell: (b) => (b.props.items ?? []).map((it: any) => link(cell(socialText(it, b.props.show)), socialUrl(it))).join(b.props.style === 'inline' ? (b.props.separator ?? ' · ') : ' \\n '),
};

// ───────────────────────── Currently
export const currentlyDef: BlockDef = {
  type: 'currently',
  label: 'Currently',
  icon: Sparkles,
  category: 'profile',
  description: 'Listening / reading / playing now',
  defaults: () => ({
    ...titleDefaults('currently'), style: 'list', labelStyle: 'bold', labelColor: '', align: 'auto',
    items: [
      { emoji: '🎧', label: 'listening', value: 'Mitski — Be the Cowboy', url: '' },
      { emoji: '📖', label: 'reading', value: 'Piranesi', url: '' },
      { emoji: '🎮', label: 'playing', value: 'Stardew Valley', url: '' },
      { emoji: '📺', label: 'watching', value: 'Frieren', url: '' },
    ],
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    { title: 'Display', fields: [{ kind: 'segmented', key: 'style', label: 'Layout', options: [{ value: 'list', label: 'List' }, { value: 'table', label: 'Table' }, { value: 'lines', label: 'Lines' }] }, { kind: 'segmented', key: 'labelStyle', label: 'Label style', options: TEXT_STYLE_OPTIONS.slice(0, 4) }, { kind: 'color', key: 'labelColor', label: 'Label color' }, alignField()] },
    {
      title: 'Items',
      fields: [{
        kind: 'list', key: 'items', label: 'Items', itemLabel: 'Item',
        newItem: () => ({ emoji: '✨', label: 'doing', value: 'something', url: '' }),
        summary: (it) => `${it.emoji} ${it.label}: ${it.value}`,
        fields: [{ kind: 'emoji', key: 'emoji', label: 'Icon' }, { kind: 'text', key: 'label', label: 'Label' }, { kind: 'text', key: 'value', label: 'Value' }, { kind: 'text', key: 'url', label: 'Link' }],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const lab = (it: any) => color(applyTextStyle(`${it.label}:`, p.labelStyle), p.labelColor);
    const val = (it: any) => link(it.value ?? '', it.url);
    const items = p.items ?? [];
    let body = '';
    if (p.style === 'table') body = table([' ', ' '], items.map((it: any) => [`${it.emoji} ${lab(it)}`, cell(val(it))]));
    else if (p.style === 'lines') body = items.map((it: any) => alignLine(`${it.emoji} ${lab(it)} ${val(it)}`, a)).join('\n');
    else body = items.map((it: any) => `- ${it.emoji} ${lab(it)} ${val(it)}`).join('\n');
    return join(renderTitle(p, a), body);
  },
  toCell: (b) => {
    const p = b.props;
    const head = p.title?.trim() ? bold(cell(p.title)) + ' \\n ' : '';
    return head + (p.items ?? []).map((it: any) => `${it.emoji} ${color(applyTextStyle(cell(it.label + ':'), p.labelStyle), p.labelColor)} ${link(cell(it.value ?? ''), it.url)}`).join(' \\n ');
  },
};

// ───────────────────────── Status
export const statusDef: BlockDef = {
  type: 'status',
  label: 'Status',
  icon: Smile,
  category: 'profile',
  description: 'Mood or status line',
  primaryText: 'text',
  defaults: () => ({ emoji: '🌙', label: 'mood', text: 'sleepy but hopeful', style: 'plain', color: '', align: 'center' }),
  groups: [
    {
      title: 'Status',
      fields: [
        { kind: 'emoji', key: 'emoji', label: 'Emoji' },
        { kind: 'text', key: 'label', label: 'Label' },
        { kind: 'text', key: 'text', label: 'Text' },
        { kind: 'segmented', key: 'style', label: 'Style', options: [{ value: 'plain', label: 'Plain' }, { value: 'mark', label: 'Marked' }, { value: 'quote', label: 'Quote' }, { value: 'callout', label: 'Callout' }] },
        { kind: 'color', key: 'color', label: 'Color' },
        alignField(),
      ],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign(p.align, ctx.align);
    const inner = `${p.label?.trim() ? bold(p.label + ':') + ' ' : ''}${p.emoji ? p.emoji + ' ' : ''}${color(p.text ?? '', p.color)}`;
    if (p.style === 'callout') return admonition('note', `${p.emoji ?? ''} ${p.label ?? ''}`.trim(), color(p.text ?? '', p.color));
    if (p.style === 'quote') return '> ' + alignLine(inner, a);
    if (p.style === 'mark') return alignLine(`==${inner}==`, a);
    return alignLine(inner, a);
  },
  toCell: (b) => `${b.props.label?.trim() ? bold(cell(b.props.label) + ':') + ' ' : ''}${b.props.emoji ?? ''} ${color(cell(b.props.text ?? ''), b.props.color)}`,
};

// ───────────────────────── Boundaries
export const boundariesDef: BlockDef = {
  type: 'boundaries',
  label: 'DNI / BYF',
  icon: ShieldAlert,
  category: 'profile',
  description: 'Do-not-interact and before-you-follow',
  defaults: () => ({
    layout: 'callouts',
    dniTitle: 'DNI', dniKind: 'danger', dni: 'basic dni criteria\nspam / bot accounts\nanyone under 13',
    byfTitle: 'BYF', byfKind: 'warning', byf: 'I post a lot of art and shitposts\nI tag spoilers\nI might not follow back, nothing personal!',
  }),
  groups: [
    { title: 'Layout', fields: [{ kind: 'segmented', key: 'layout', label: 'Layout', options: [{ value: 'callouts', label: 'Callouts' }, { value: 'columns', label: 'Columns' }, { value: 'lists', label: 'Lists' }] }] },
    { title: 'Do not interact', fields: [{ kind: 'text', key: 'dniTitle', label: 'Title' }, { kind: 'select', key: 'dniKind', label: 'Callout', options: ['info', 'note', 'warning', 'danger', 'greentext'].map((v) => ({ value: v, label: v })), showIf: (p) => p.layout === 'callouts' }, { kind: 'textarea', key: 'dni', label: 'Items', rows: 4, hint: 'One per line' }] },
    { title: 'Before you follow', fields: [{ kind: 'text', key: 'byfTitle', label: 'Title' }, { kind: 'select', key: 'byfKind', label: 'Callout', options: ['info', 'note', 'warning', 'danger', 'greentext'].map((v) => ({ value: v, label: v })), showIf: (p) => p.layout === 'callouts' }, { kind: 'textarea', key: 'byf', label: 'Items', rows: 4, hint: 'One per line' }] },
  ],
  toMarkdown: (b) => {
    const p = b.props;
    const dni = lines(p.dni);
    const byf = lines(p.byf);
    if (p.layout === 'columns') {
      const n = Math.max(dni.length, byf.length);
      return table([bold(cell(p.dniTitle || 'DNI')), bold(cell(p.byfTitle || 'BYF'))], Array.from({ length: n }, (_, i) => [cell(dni[i] ?? ''), cell(byf[i] ?? '')]));
    }
    if (p.layout === 'lists') {
      return join(dni.length && `**${p.dniTitle}**\n${dni.map((l) => `- ${l}`).join('\n')}`, byf.length && `**${p.byfTitle}**\n${byf.map((l) => `- ${l}`).join('\n')}`);
    }
    return join(
      dni.length && admonition(p.dniKind, p.dniTitle, dni.map((l) => `- ${l}`).join('\n')),
      byf.length && admonition(p.byfKind, p.byfTitle, byf.map((l) => `- ${l}`).join('\n')),
    );
  },
};

// ───────────────────────── Updates log
export const updatesDef: BlockDef = {
  type: 'updates',
  label: 'Updates',
  icon: Newspaper,
  category: 'profile',
  description: 'Dated posts, like a mini blog',
  defaults: () => ({
    ...titleDefaults('updates'), style: 'posts', dateColor: 'gray', separators: true,
    entries: [
      { date: '2026-11-10', title: 'new layout!', text: 'Redid the whole page with a cozier palette. Let me know what you think ♡' },
      { date: '2026-10-31', title: 'spooky season', text: 'Finished my inktober prompts — all 31!' },
    ],
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    { title: 'Display', fields: [{ kind: 'segmented', key: 'style', label: 'Style', options: [{ value: 'posts', label: 'Posts' }, { value: 'compact', label: 'Compact' }, { value: 'quotes', label: 'Quotes' }] }, { kind: 'color', key: 'dateColor', label: 'Date color' }, { kind: 'toggle', key: 'separators', label: 'Separators', showIf: (p) => p.style === 'posts' }] },
    {
      title: 'Entries',
      fields: [{
        kind: 'list', key: 'entries', label: 'Entries', itemLabel: 'Entry',
        newItem: () => ({ date: new Date().toISOString().slice(0, 10), title: 'new post', text: '' }),
        summary: (it) => `${it.date} — ${it.title}`,
        fields: [{ kind: 'text', key: 'date', label: 'Date' }, { kind: 'text', key: 'title', label: 'Title' }, { kind: 'textarea', key: 'text', label: 'Text', rich: true, rows: 3 }],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign('auto', ctx.align);
    const entries = (p.entries ?? []) as any[];
    const date = (d: string) => color(d, p.dateColor);
    let body = '';
    if (p.style === 'compact') body = entries.map((e) => `- ${date(e.date)} — **${e.title}**${e.text ? ' ' + e.text.replace(/\n/g, ' ') : ''}`).join('\n');
    else if (p.style === 'quotes') body = entries.map((e) => [`> ${date(e.date)} · **${e.title}**`, ...(e.text ? (e.text as string).split('\n').map((l) => `> ${l}`) : [])].join('\n')).join('\n\n');
    else body = entries.map((e) => join(`#### ${e.title}`, italic(date(e.date)), e.text)).join(p.separators ? '\n\n***\n\n' : '\n\n');
    return join(renderTitle(p, a), body);
  },
};

// ───────────────────────── Playlist
export const playlistDef: BlockDef = {
  type: 'playlist',
  label: 'Playlist',
  icon: Music,
  category: 'profile',
  description: 'Songs you have on repeat',
  defaults: () => ({
    ...titleDefaults('on repeat ♫'), style: 'list', numbered: true, artistColor: 'gray',
    tracks: [{ title: 'Motion Sickness', artist: 'Phoebe Bridgers', url: '' }, { title: 'Space Song', artist: 'Beach House', url: '' }, { title: 'Pink + White', artist: 'Frank Ocean', url: '' }],
  }),
  groups: [
    { title: 'Title', fields: titleFields() },
    { title: 'Display', fields: [{ kind: 'segmented', key: 'style', label: 'Layout', options: [{ value: 'list', label: 'List' }, { value: 'table', label: 'Table' }] }, { kind: 'toggle', key: 'numbered', label: 'Numbered' }, { kind: 'color', key: 'artistColor', label: 'Artist color' }] },
    {
      title: 'Tracks',
      fields: [{
        kind: 'list', key: 'tracks', label: 'Tracks', itemLabel: 'Track',
        newItem: () => ({ title: 'Song', artist: 'Artist', url: '' }),
        summary: (it) => `${it.title} — ${it.artist}`,
        fields: [{ kind: 'text', key: 'title', label: 'Title' }, { kind: 'text', key: 'artist', label: 'Artist' }, { kind: 'text', key: 'url', label: 'Link' }],
      }],
    },
  ],
  toMarkdown: (b, ctx) => {
    const p = b.props;
    const a = resolveAlign('auto', ctx.align);
    const tracks = (p.tracks ?? []) as any[];
    let body = '';
    if (p.style === 'table') body = table([p.numbered ? '#' : ' ', 'song', 'artist'], tracks.map((t, i) => [p.numbered ? String(i + 1) : '♪', link(cell(t.title), t.url), color(cell(t.artist), p.artistColor)]));
    else body = tracks.map((t) => `${p.numbered ? '1.' : '-'} ${link(t.title, t.url)} — ${color(t.artist, p.artistColor)}`).join('\n');
    return join(renderTitle(p, a), body);
  },
  toCell: (b) => {
    const p = b.props;
    const head = p.title?.trim() ? bold(cell(p.title)) + ' \\n ' : '';
    return head + ((p.tracks ?? []) as any[]).map((t, i) => `${p.numbered ? i + 1 + '.' : '♪'} ${link(cell(t.title), t.url)} — ${color(cell(t.artist), p.artistColor)}`).join(' \\n ');
  },
};

