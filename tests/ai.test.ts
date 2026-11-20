import { afterEach, describe, expect, it, vi } from 'vitest';
import { produce } from 'immer';
import type { Project } from '../src/model/types';
import { createBlock } from '../src/blocks/presets';
import { BLOCK_DEFS } from '../src/blocks/registry';
import { findBlock } from '../src/model/tree';
import { runOps, buildPage, describeReport, OpsReport } from '../src/ai/ops';
import { blockCatalog, pageJSON, projectUrls, UPLOADED } from '../src/ai/context';
import { editMessages, cleanWritingReply, writingMessages } from '../src/ai/prompts';
import { chat, createSSEParser, parseJSONReply, mapError } from '../src/ai/openai';
import { useEditor } from '../src/store/editorStore';
import { useAI } from '../src/ai/settings';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';

function sample(): Project {
  const para = createBlock('paragraph', { text: 'Hi, I’m **Robin**.' });
  para.id = 'p1';
  const img = createBlock('image', { url: DATA_URI });
  img.id = 'img1';
  const pic = createBlock('image', { url: 'https://example.com/cat.png' });
  pic.id = 'img2';
  const cols = createBlock('columns', { count: 2 });
  cols.id = 'c1';
  return {
    version: 1,
    name: 'test',
    meta: { CONTAINER_MAX_WIDTH: ['600px'], SECRET_EMAIL_ADDRESS: ['me@example.com'] },
    palette: [{ value: '#ff99cc', name: 'Pink' }],
    blocks: [para, img, pic, cols],
  };
}

function apply(p: Project, ops: unknown[], allowed: string[] = []) {
  let report!: OpsReport;
  const env = { allowedUrls: new Set([...projectUrls(p), ...allowed]) };
  const next = produce(p, (d) => { report = runOps(d, ops, env); });
  return { next, report };
}

describe('AI ops: validation', () => {
  it('applies valid prop changes and skips unknown ids, unknown props and bad values', () => {
    const { next, report } = apply(sample(), [
      { op: 'update', id: 'p1', props: { text: 'Hello **there**', style: 'nope', bogus: 1, color: 'rgba(1,2,3,.5)' } },
      { op: 'update', id: 'missing', props: { text: 'x' } },
    ]);
    const p = findBlock(next.blocks, 'p1')!;
    expect(p.props.text).toBe('Hello **there**');
    expect(p.props.style).toBe('plain'); // invalid option ignored
    expect(p.props.color).toBe(''); // rgba isn't valid in rentry inline color syntax
    expect(report.changedIds).toEqual(['p1']);
    expect(report.skipped.length).toBe(4);
  });

  it('accepts palette/hex colors on blocks', () => {
    const { next } = apply(sample(), [{ op: 'update', id: 'p1', props: { color: '#ff99cc' } }]);
    expect(findBlock(next.blocks, 'p1')!.props.color).toBe('#ff99cc');
  });

  it('never invents image links, but keeps uploaded images and allows links from the request', () => {
    const invented = apply(sample(), [{ op: 'update', id: 'img2', props: { url: 'https://made-up.example/x.png' } }]);
    expect(findBlock(invented.next.blocks, 'img2')!.props.url).toBe('https://example.com/cat.png');
    expect(invented.report.skipped[0]).toMatch(/aren’t invented/);

    const kept = apply(sample(), [{ op: 'update', id: 'img1', props: { url: UPLOADED, alt: 'me' } }]);
    expect(findBlock(kept.next.blocks, 'img1')!.props.url).toBe(DATA_URI);

    const fromRequest = apply(sample(), [{ op: 'update', id: 'img2', props: { url: 'https://i.imgur.com/new.png' } }], ['https://i.imgur.com/new.png']);
    expect(findBlock(fromRequest.next.blocks, 'img2')!.props.url).toBe('https://i.imgur.com/new.png');
  });

  it('inserts with refs and positions, and respects column rules', () => {
    const notCell = BLOCK_DEFS.find((d) => !d.toCell && !d.container)!;
    const { next, report } = apply(sample(), [
      { op: 'insert', type: 'heading', props: { text: 'About' }, before: 'p1', ref: 'h' },
      { op: 'insert', type: 'paragraph', props: { text: 'under the heading' }, after: 'h' },
      { op: 'insert', type: 'paragraph', props: { text: 'in a column' }, parent: 'c1', slot: 1 },
      { op: 'insert', type: notCell.type, parent: 'c1', slot: 0 },
      { op: 'insert', type: 'not-a-block' },
    ]);
    expect(next.blocks[0].type).toBe('heading');
    expect(next.blocks[1].props.text).toBe('under the heading');
    expect(findBlock(next.blocks, 'c1')!.children![1][0].props.text).toBe('in a column');
    expect(findBlock(next.blocks, 'c1')!.children![0]).toHaveLength(0);
    expect(report.skipped.some((s) => s.includes('can’t go there'))).toBe(true);
    expect(report.skipped.some((s) => s.includes('not-a-block'))).toBe(true);
  });

  it('moves and removes blocks, but not locked ones', () => {
    const p = sample();
    p.blocks[2].locked = true;
    const { next, report } = apply(p, [
      { op: 'move', id: 'p1', after: 'img1' },
      { op: 'remove', id: 'img2' },
    ]);
    expect(next.blocks.map((b) => b.id)).toEqual(['img1', 'p1', 'img2', 'c1']);
    expect(report.skipped[0]).toMatch(/locked/);
  });

  it('validates metadata with the rentry schema and keeps private settings out of reach', () => {
    const { next, report } = apply(sample(), [
      { op: 'meta', key: 'CONTAINER_MAX_WIDTH', values: ['99999px'] },
      { op: 'meta', key: 'CONTENT_TEXT_COLOR', values: ['#333333'] },
      { op: 'meta', key: 'SECRET_EMAIL_ADDRESS', values: ['evil@example.com'] },
      { op: 'meta', key: 'NOT_AN_OPTION', values: ['1'] },
    ]);
    expect(next.meta.CONTAINER_MAX_WIDTH).toEqual(['600px']);
    expect(next.meta.CONTENT_TEXT_COLOR).toEqual(['#333333']);
    expect(next.meta.SECRET_EMAIL_ADDRESS).toEqual(['me@example.com']);
    expect(report.metaKeys).toEqual(['CONTENT_TEXT_COLOR']);
    expect(report.skipped).toHaveLength(3);
  });

  it('recolors everywhere, including the palette', () => {
    const p = sample();
    p.blocks[0].props.text = '%#ff99cc% pink %% text';
    const { next } = apply(p, [{ op: 'recolor', from: '#ff99cc', to: '#ffb3d9' }]);
    expect(next.blocks[0].props.text).toBe('%#ffb3d9% pink %% text');
    expect(next.palette![0].value).toBe('#ffb3d9');
  });

  it('builds a new page from specs, dropping invalid parts', () => {
    const { blocks, skipped } = buildPage([
      { type: 'heading', props: { text: 'Commissions' } },
      { type: 'columns', props: { count: 2 }, children: [[{ type: 'paragraph', props: { text: 'a' } }], [{ type: 'columns' }]] },
      { type: 'nope' },
    ], { allowedUrls: new Set() });
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'columns']);
    expect(blocks[1].children![0]).toHaveLength(1);
    expect(blocks[1].children![1]).toHaveLength(0);
    expect(skipped).toHaveLength(2);
  });

  it('AI-made blocks never fall back to stock sample images', () => {
    const { blocks } = buildPage([{ type: 'image', props: { url: 'https://invented.example/x.png' } }, { type: 'image' }], { allowedUrls: new Set() });
    expect(blocks.map((b) => b.props.url)).toEqual(['', '']);
    const gallery = buildPage([{ type: 'gallery' }], { allowedUrls: new Set() }).blocks[0];
    const items = Object.values(gallery.props).find(Array.isArray) as Record<string, unknown>[] | undefined;
    if (items?.length) expect(items.every((it) => !Object.values(it).some((v) => typeof v === 'string' && v.includes('picsum')))).toBe(true);
  });

  it('summarises a report', () => {
    expect(describeReport({ changedIds: [], blocks: 2, metaKeys: ['A'], other: 0, skipped: [], notes: [] })).toBe('Changed 2 blocks · 1 page style');
  });
});

describe('AI ops: one undo step', () => {
  it('a whole AI change is a single commit', () => {
    const s = useEditor.getState();
    s.loadProject(sample());
    const depth = useEditor.getState().past.length;
    const env = { allowedUrls: new Set<string>() };
    useEditor.getState().commit((d) => {
      runOps(d, [
        { op: 'update', id: 'p1', props: { text: 'one' } },
        { op: 'insert', type: 'divider' },
        { op: 'meta', key: 'CONTENT_TEXT_COLOR', values: ['navy'] },
      ], env);
    });
    expect(useEditor.getState().past.length).toBe(depth + 1);
    useEditor.getState().undo();
    expect(findBlock(useEditor.getState().project.blocks, 'p1')!.props.text).toBe('Hi, I’m **Robin**.');
    expect(useEditor.getState().project.blocks).toHaveLength(4);
  });
});

describe('AI context', () => {
  it('hides uploaded images, private settings and the API key', () => {
    useAI.setState({ key: 'sk-test-SECRET-123' });
    const json = JSON.stringify(pageJSON(sample()));
    expect(json).not.toContain('data:image');
    expect(json).toContain(UPLOADED);
    expect(json).not.toContain('me@example.com');
    const all = JSON.stringify([...editMessages(sample(), { instruction: 'x', selectedId: null }), ...writingMessages(sample(), { instruction: 'x', text: 'y' })]);
    expect(all).not.toContain('sk-test-SECRET-123');
    expect(all).not.toContain('data:image');
  });

  it('catalog is generated from the block registry', () => {
    const cat = blockCatalog();
    expect(cat).toHaveLength(BLOCK_DEFS.length);
    const para = cat.find((c) => c.type === 'paragraph')!;
    expect(para.fields.map((f) => f.key)).toContain('text');
  });
});

describe('OpenAI client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses JSON replies with or without fences', () => {
    expect(parseJSONReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSONReply('Sure! {"a":2} hope this helps')).toEqual({ a: 2 });
    expect(() => parseJSONReply('nope')).toThrow();
  });

  it('retries without reasoning_effort when a model rejects it', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      if (body.reasoning_effort) return new Response(JSON.stringify({ error: { message: 'Unsupported parameter: reasoning_effort' } }), { status: 400 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    }));
    const out = await chat({ key: 'k', model: 'gpt-5-mini', messages: [{ role: 'user', content: 'hi' }] });
    expect(out).toBe('ok');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].reasoning_effort).toBe('low');
    expect(bodies[1].reasoning_effort).toBeUndefined();
    expect(bodies[0].temperature).toBeUndefined();
  });

  it('maps API errors to plain messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), { status: 401 })));
    await expect(chat({ key: 'bad', model: 'gpt-4.1', messages: [] })).rejects.toMatchObject({ kind: 'key' });
    expect(mapError(429, 'You exceeded your current quota').kind).toBe('quota');
    expect(mapError(429, 'Rate limit reached').kind).toBe('rate');
  });

  it('parses streamed deltas split across chunks', () => {
    let text = '';
    const feed = createSSEParser((p) => { text += p; });
    feed('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choi');
    feed('ces":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n');
    expect(text).toBe('Hello');
  });

  it('cleans writing replies', () => {
    expect(cleanWritingReply('```\nhi there\n```')).toBe('hi there');
    expect(cleanWritingReply('"quoted"')).toBe('quoted');
    expect(cleanWritingReply('a\nb', true)).toBe('a b');
  });
});

// ───────────────────────── v2: style learning, privacy, model
import { styleProfile, dominantProps, inheritedProps, styleGuideText } from '../src/ai/style';
import { briefKey } from '../src/ai/run';
import { DEFAULT_MODEL } from '../src/ai/settings';

/** Mirrors the author's real page: centered, lowercase, symbols, colored phrases, spacers, text titles. */
function styledPage(): Project {
  const t = (id: string, text: string) => { const b = createBlock('paragraph', { text, align: 'center' }); b.id = id; return b; };
  const sp = (id: string) => { const b = createBlock('spacer'); b.id = id; return b; };
  return {
    version: 1, name: 'cozy', meta: {}, palette: [{ value: '#f9d98e', name: '' }, { value: '#f67da4', name: '' }],
    blocks: [
      sp('s0'),
      t('intro', '%#f9d98e% you\'re plastic, %% %#93592a% you\'re tragic %%\n%#f67da4% overly romantic %%'),
      t('who', '%#93592a% sugi %% ૮・ﻌ・ა %#f67da4% 19 %% he/him'),
      sp('s1'),
      t('t1', 'interests & hobbies !'),
      t('list', '⟡ russian history\n⟡ golden kamuy\n⟡ sanrio %#f67da4% ♡ %%'),
      sp('s2'),
      t('t2', 'dni & byi !'),
      t('dni', '⟡ racists\n⟡ proshippers'),
    ],
  };
}

describe('AI style learning', () => {
  it('measures alignment, symbols, casing, colors, spacers and text-built titles', () => {
    const s = styleProfile(styledPage());
    expect(s.align).toEqual({ value: 'center', count: 6, total: 6 });
    expect(s.decor.map((d) => d.token)).toEqual(expect.arrayContaining(['⟡', '૮・ﻌ・ა', '♡']));
    expect(s.linePrefixes).toContain('⟡');
    expect(s.lowercase).toBe(true);
    expect(s.color.colors).toEqual(expect.arrayContaining(['#f67da4', '#93592a']));
    expect(s.spacers.count).toBe(3);
    expect(s.usesHeadings).toBe(false);
    expect(s.titleExamples).toContain('interests & hobbies !');
    expect(s.guide).toMatch(/center/);
    expect(s.guide).toMatch(/lowercase/);
    expect(s.guide).toMatch(/not Heading blocks/);
    expect(styleGuideText(styledPage(), 'brief here')).toContain('brief here');
  });

  it('new blocks inherit the author’s dominant style', () => {
    expect(dominantProps(styledPage(), 'paragraph').align).toBe('center');
    // Page-wide alignment applies to other block types with an align field.
    expect(dominantProps(styledPage(), 'quote').align ?? dominantProps(styledPage(), 'heading').align).toBe('center');
  });

  it('"like" copies the look of an existing block but never its content', () => {
    const p = styledPage();
    findBlock(p.blocks, 't1')!.props.color = '#f67da4';
    findBlock(p.blocks, 't1')!.props.style = 'bold';
    const style = inheritedProps(p, 'paragraph', 't1');
    expect(style).toMatchObject({ align: 'center', color: '#f67da4', style: 'bold' });
    expect(style.text).toBeUndefined();
    // Model props win over the copied look.
    const { next } = apply(p, [{ op: 'insert', type: 'paragraph', like: 't1', props: { text: 'my oc !', style: 'plain' }, after: 'dni' }]);
    const added = next.blocks[next.blocks.length - 1];
    expect(added.props).toMatchObject({ text: 'my oc !', align: 'center', color: '#f67da4', style: 'plain' });
  });

  it('inserted blocks without "like" still come out centered on a centered page', () => {
    const { next } = apply(styledPage(), [{ op: 'insert', type: 'paragraph', props: { text: 'new' } }]);
    expect(next.blocks[next.blocks.length - 1].props.align).toBe('center');
  });

  it('new pages can reference blocks of the current page with "like"', () => {
    const src = styledPage();
    const { blocks } = buildPage([{ type: 'paragraph', like: 'list', props: { text: '⟡ sketches' } }], { allowedUrls: new Set(), source: src });
    expect(blocks[0].props).toMatchObject({ align: 'center', text: '⟡ sketches' });
  });

  it('the style brief is cached per page content, not per selection or layer names', () => {
    const a = styledPage();
    const b = styledPage();
    b.blocks[1].name = 'renamed layer';
    expect(briefKey(a)).toBe(briefKey(b));
    b.blocks[1].props.text = 'different words';
    expect(briefKey(a)).not.toBe(briefKey(b));
  });
});

describe('AI privacy and model', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('every request is sent with store: false', async () => {
    let body: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }); }));
    await chat({ key: 'k', model: DEFAULT_MODEL, messages: [] });
    expect(body.store).toBe(false);
    expect(body.model).toBe('gpt-6.2-sol');
    expect(body.reasoning_effort).toBe('low');
  });
});
