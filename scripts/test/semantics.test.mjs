import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = resolve(repo, 'plugins/tripo-3d');
const read = p => readFileSync(resolve(root, p), 'utf8');
const skill = read('skills/tripo-3d/SKILL.md');
const game = read('skills/tripo-game-asset/SKILL.md');
const hybrid = !root.endsWith('/connector');
const ref = hybrid ? read('skills/tripo-3d/references/capability.md') : skill;
const texts = [skill, game, ref];
test('explicit game routing preserves P2 and P1 choice', () => {
  for (const text of texts) {
    assert.match(text, /P2/);
    assert.doesNotMatch(text, /\bPreview\b/);
    assert.match(text, /P1/);
    assert.match(text, /(?:explicit|Explicit)/);
    assert.doesNotMatch(text, /~5×|auto-selects the low-poly|any `face_limit` ≤ 20000 auto-selects|Let the CLI choose the model version/);
  }
  assert.match(game, /(?:model: "P2"|--model tripo-p2)/);
  assert.match(ref, /cost|price/);
});

test('rig defaults and presets follow the upstream rig model', () => {
  for (const text of texts) {
    assert.match(text, /v3\.0/);
    assert.match(text, /v1\.0/);
    assert.doesNotMatch(text, /biped` (?:→|rig is) v1\.0|picks the humanoid v1\.0|gets the humanoid v1\.0|CLI default is still v2\.0/);
  }
  assert.match(ref, /v3\.0-20260909/);
  assert.match(ref, /preset:walk/);
  assert.match(ref, /preset:biped:/);
});

test('retopology v3 and standalone UV are distinct billed workflows', () => {
  for (const text of [skill, ref, game]) {
    assert.match(text, /tripo_smart_uv/);
    assert.match(text, /smart_uv/);
    assert.match(text, /v3\.0/);
  }
  assert.match(ref, /80[ ,]?000/);
  assert.match(ref, /uv_render_url/);
  assert.match(ref, /35.*40/);
});
test('image and texture contracts reject stale advice', () => {
  assert.match(ref, /chat_image_1` (?:is retired|retired)/);
  assert.doesNotMatch(ref, /chat_image_1\)|takes either|CLI.*(?:rejects|reject).*fast/);
  assert.match(ref, /banana2/);
  assert.match(ref, /fast/);
  assert.match(ref, /v3\.5-20260815/);
});

// Offline checks: no network calls, installations or paid generations.
test('release version and billing uncertainty are explicit', () => {
  assert.match(skill, /cost.*not estimated|not estimated.*cost/i);
  if (hybrid) {
    const manifest = read('.zcode-plugin/plugin.json');
    assert.equal(JSON.parse(manifest).version, '0.1.5');
    assert.equal(read('.claude-plugin/plugin.json'), manifest);
    assert.match(skill, /0\.8\.0/);
    assert.match(skill, /npx tripo-cli@0\.8\b/);
    assert.doesNotMatch(skill, /npx tripo-cli@latest/);
    const hook = read('hooks/session-start.mjs');
    assert.match(hook, /0\.8\.0/);
    assert.match(hook, /npx tripo-cli@0\.8\b/);
    assert.match(hook, /P2/);
    assert.match(hook, /P1/);
    assert.match(hook, /not estimated/i);
    for (const doc of ['README.md', 'README_CN.md']) {
      assert.match(read(doc), /0\.1\.5/);
      assert.match(read(doc), /0\.8\.0/);
    }
    for (const [name, text] of [['SKILL.md', skill], ['tripo-game-asset', game], ['capability.md', ref], ['session-start.mjs', hook], ['README.md', read('README.md')], ['README_CN.md', read('README_CN.md')]]) {
      assert.doesNotMatch(text, /\bcandidate\b|unreleased|unpublished|not yet published|未发布|候选/i, name);
      assert.doesNotMatch(text, /\bPreview\b/, name);
    }
    const market = JSON.parse(readFileSync(resolve(repo, 'marketplace.json'), 'utf8'));
    const entries = market.plugins.filter(p => p.name === 'tripo-3d');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].version, '0.1.5');
    assert.equal(entries[0].source, './plugins/tripo-3d');
    assert.deepEqual(entries[0].description_i18n, JSON.parse(manifest).description_i18n);
  } else {
    assert.equal(JSON.parse(read('connector-meta.json')).version, '0.1.4');
    for (const text of [skill, game]) {
      assert.match(text, /version: 0\.1\.4/);
      assert.doesNotMatch(text, /tripo-cli|npx tripo|tripo make/);
    }
  }
});

test('image sizes follow each model rather than a universal default', () => {
  const row = model => {
    const line = ref.split('\n').find(line => line.startsWith(`| \`${model}\` |`));
    assert.ok(line, `missing model-specific size row: ${model}`);
    return line.split('|').slice(2).join('|');
  };
  const tokens = line => [...line.matchAll(/`([^`]+)`/g)].map(match => match[1]);
  assert.deepEqual(tokens(row('banana')), ['1024x1024', '832x1248', '1248x832', '864x1184', '1184x864', '896x1152', '1152x896', '768x1344', '1344x768', '1536x672']);
  assert.deepEqual(tokens(row('banana2')), ['0.5K', '1K', '2K', '4K']);
  assert.deepEqual(tokens(row('banana_pro')), ['1K', '2K', '4K', 'WxH']);
  assert.deepEqual(tokens(row('seedream_v4')), ['2K', '4K', 'WxH']);
  assert.deepEqual(tokens(row('seedream_v5')), ['2K', '3K', 'WxH']);
  assert.deepEqual(tokens(row('chat_image_1.5')), ['1024x1024', '1024x1536', '1536x1024', 'auto']);
  for (const model of ['chat_image_2', 'chat_image_2.5_flare', 'chat_image_2.5_sunburst']) {
    assert.deepEqual(tokens(row(model)), ['auto', 'WxH']);
    for (const rule of ['3840', '16', '3', '655360', '8294400']) assert.ok(row(model).includes(rule));
  }
  assert.match(ref, /Seedream exact pixel-count limits unverified/);
  assert.match(ref, /banana.*omission.*unverified/i);
  assert.doesNotMatch(ref, /- `size` `1K`\/`2K`\/`4K` or `WxH`|default 2048×2048/);
});

test('template pass-through is not a supported shortcut', () => {
  assert.match(ref, /Text-to-image templates: `asset_extraction`, `character_completion`, `t_pose`, `variants`, `figure`/);
  assert.match(ref, /Image-to-image templates: `t_pose`, `character_completion`, `3d_enhance`, `variants`, `figure`/);
  assert.match(ref, /head_extraction.*print_clay.*not in the documented endpoint whitelists/);
  assert.match(ref, /t_pose=true.*sketch_to_render=true.*raw parameters/);
  assert.match(ref, /does not normalize these booleans into `template`/);
  assert.match(ref, /local acceptance is not server support/);
  assert.doesNotMatch(ref, /The CLI also\s+accepts `head_extraction`/);
});

test('historical prices cannot substitute for a current regional estimate', () => {
  assert.match(ref, /Historical examples only, not a current regional estimate/);
  assert.match(ref, /Numeric prices and add-ons anywhere in this file/);
  assert.match(ref, /not_estimated/);
  assert.match(ref, /not zero/);
  assert.match(ref, /source.*region.*date/i);
  assert.doesNotMatch(ref, /so the cost can be quoted before a run/);
});

test('README requires explicit CLI selection pinned to 0.8', () => {
  const en = read('README.md');
  const zh = read('README_CN.md');
  for (const text of [en, zh]) {
    assert.doesNotMatch(text, /npx tripo-cli@latest/);
    assert.match(text, /0\.8\.0/);
    assert.match(text, /npx tripo-cli@0\.8\b/);
  }
  assert.match(en, /explicitly chooses CLI/);
  assert.match(en, /no automatic fallback/);
  assert.match(zh, /明确选择 CLI/);
  assert.match(zh, /不自动.*CLI/);
});
