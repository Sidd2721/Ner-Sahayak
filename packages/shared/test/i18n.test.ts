import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n');
const locales = ['en', 'hi', 'as'] as const;
const bundles = Object.fromEntries(
  locales.map((l) => [l, JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8'))]),
) as Record<(typeof locales)[number], Record<string, unknown>>;

/** Recursively collects every key path in a nested dict. */
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? keyPaths(v as Record<string, unknown>, path)
      : [path];
  });
}

/** Placeholder tokens ({{name}}) used by a value, sorted. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

test('all three locales exist (as.json present) with identical key sets', () => {
  const reference = keyPaths(bundles.en).sort();
  assert.ok(reference.length >= 40, `key set unexpectedly small: ${reference.length}`);
  for (const l of ['hi', 'as']) {
    const keys = keyPaths(bundles[l]).sort();
    assert.deepEqual(keys, reference, `${l}.json key set differs from en.json`);
  }
});

test('every leaf value is a non-empty string', () => {
  for (const l of locales) {
    for (const path of keyPaths(bundles[l])) {
      const value = path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)[k], bundles[l]);
      assert.equal(typeof value, 'string', `${l}:${path} is not a string`);
      assert.ok((value as string).trim().length > 0, `${l}:${path} is empty`);
    }
  }
});

test('interpolation placeholders match across locales ({{days}}, {{time}}, {{count}})', () => {
  const ref = keyPaths(bundles.en);
  for (const l of ['hi', 'as']) {
    for (const path of ref) {
      const get = (b: Record<string, unknown>) =>
        path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)[k], b);
      assert.deepEqual(
        placeholders(String(get(bundles[l]))),
        placeholders(String(get(bundles.en))),
        `${l}:${path} placeholder mismatch`,
      );
    }
  }
});

test('language names are self-named in native script', () => {
  assert.equal(bundles.en.language.hi, 'हिन्दी');
  assert.equal(bundles.en.language.as, 'অসমীয়া');
  assert.equal(bundles.as.language.as, 'অসমীয়া');
  assert.equal(bundles.hi.language.hi, 'हिन्दी');
});

test('all four risk categories are translated in every locale', () => {
  for (const l of locales) {
    for (const cat of ['Low', 'Medium', 'High', 'Severe']) {
      assert.ok(bundles[l].risk[cat].trim().length > 0, `${l}: risk.${cat} missing`);
    }
  }
});
