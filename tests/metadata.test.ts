import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { META_OPTIONS, PAGE_SECTIONS } from '../src/rentry/metadataSchema';
import { parseMetadata, serializeMetadata } from '../src/rentry/serializeMetadata';
import { validateMetadata, validateOption } from '../src/rentry/validateMetadata';

const example = readFileSync(new URL('../GUIDE/METADATA EXAMPLE.txt', import.meta.url), 'utf8');

describe('metadata schema', () => {
  it('every option appears in exactly one inspector section', () => {
    const keys = PAGE_SECTIONS.flatMap((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(META_OPTIONS.map((o) => o.key).sort());
  });
});

describe('parse + validate the official example', () => {
  const { meta, errors } = parseMetadata(example);
  it('parses without errors', () => expect(errors).toEqual([]));
  it('has all 63 options', () => expect(Object.keys(meta).length).toBe(META_OPTIONS.length));
  it('validates cleanly', () => {
    const issues = validateMetadata(meta).filter((i) => i.severity === 'error');
    expect(issues).toEqual([]);
  });
  it('round-trips through the serializer', () => {
    const again = parseMetadata(serializeMetadata(meta));
    expect(again.errors).toEqual([]);
    expect(again.meta).toEqual(meta);
  });
});

describe('validator rejects bad values', () => {
  const err = (k: string, v: string[]) => validateOption(k, v).map((i) => i.message);
  it('out of range', () => expect(err('CONTAINER_PADDING', ['41px'])[0]).toMatch(/out of range/));
  it('wrong unit', () => expect(err('CONTAINER_SHADOW_BLUR', ['3em'])[0]).toMatch(/not a size/));
  it('too many decimals', () => expect(err('CONTAINER_PADDING', ['1.12345rem'])[0]).toMatch(/decimals/));
  it('too many values', () => expect(err('CONTENT_TEXT_COLOR', ['red', 'blue', 'green'])[0]).toMatch(/at most 2/));
  it('bad color', () => expect(err('CONTENT_LINK_COLOR', ['notacolor'])[0]).toMatch(/not a color/));
  it('left is not a permitted text-align', () => expect(err('CONTENT_TEXT_ALIGN', ['left'])[0]).toMatch(/not allowed/));
  it('font names need underscores', () => expect(err('CONTENT_FONT', ['Comic Neue'])[0]).toMatch(/not a font name/));
  it('accepts rgba with spaces', () => expect(err('CONTENT_TEXT_COLOR', ['RGBA(255, 0, 120, 0.9)'])).toEqual([]));
  it('requires partners', () => {
    const issues = validateMetadata({ CONTAINER_BORDER_COLOR: ['red'] });
    expect(issues[0].fixAdd).toEqual(['CONTAINER_BORDER_WIDTH', 'CONTAINER_BORDER_STYLE']);
  });
  it('requires one', () => {
    const issues = validateMetadata({ CONTAINER_SHADOW_COLOR: ['red'] });
    expect(issues[0].message).toMatch(/requires one of/);
  });
  it('text sizes: gaps become 0', () => {
    expect(serializeMetadata({ CONTENT_TEXT_SIZE: ['16px', '', '3rem', '', ''] })).toBe('CONTENT_TEXT_SIZE = 16px 0 3rem');
  });
});
