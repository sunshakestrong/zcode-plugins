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

test('P2 is the P-series default; P1 only when the user names or picks it', () => {
  const flat = text => text.replace(/\s+/g, ' ');
  assert.match(ref, /\| \*\*P2\*\* \|[^\n]*\| default P-series model,/);
  assert.match(ref, /\| \*\*P1\*\* \|[^\n]*\| P series alternative, only when the user names it or picks it/);
  const docs = [skill, ref, game];
  if (hybrid) docs.push(read('hooks/session-start.mjs'), read('README.md'));
  for (const text of docs) assert.match(flat(text), /within the P series the default is P2, and P1 is used only when the user names it or picks it|P-series default; \*\*P1\*\* is used only when the user names it or picks it/);
  if (hybrid) assert.match(read('README_CN.md'), /使用 P 系列时默认 \*\*P2\*\*；\*\*P1\*\*（积分更低、速度更快）仅在用户明确指定或选择时使用/);
  assert.doesNotMatch(flat(docs.join('\n')), /keep P1 available|retain P1 for|optional low-poly for lower cost|P1 remains optional/);
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
  assert.match(ref, /always pass it by body type: `v3\.0`[^\n]*`v2\.5` \(`v2\.5-20260210`, the official animal rig\) for `quadruped`[^\n]*API's own default is `v1\.0-20240301`/);
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
    const hook = read('hooks/session-start.mjs');
    assert.match(hook, /P2/);
    assert.match(hook, /P1/);
    assert.match(hook, /not estimated/i);
    for (const doc of ['README.md', 'README_CN.md']) {
      assert.match(read(doc), /0\.1\.5/);
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
  assert.doesNotMatch(ref, /The CLI also\s+accepts `head_extraction`/);
});

test('prices name their official source, region and date', () => {
  assert.match(ref, /Official list prices from the Tripo pricing pages/);
  assert.match(ref, /Numeric prices and add-ons anywhere in this file/);
  assert.match(ref, /not_estimated/);
  assert.match(ref, /not zero/);
  assert.match(ref, /source.*region.*date/i);
  assert.doesNotMatch(ref, /so the cost can be quoted before a run/);
});

test('MCP is the only execution path', () => {
  const docs = [['SKILL.md', skill], ['tripo-game-asset', game], ['capability.md', ref]];
  if (hybrid) docs.push(['session-start.mjs', read('hooks/session-start.mjs')], ['README.md', read('README.md')], ['README_CN.md', read('README_CN.md')]);
  for (const [name, text] of docs) {
    assert.doesNotMatch(text, /tripo-cli|npx tripo|tripo make|TRIPO_CLIENT_APP|TRIPO_DISTRIBUTION_CHANNEL|--region/, name);
  }
  assert.match(skill, /MCP is the only execution path/);
  assert.match(game, /runs through the Tripo\s+MCP tools only/);
});

test('PBR stays off unless the user explicitly asks for it', () => {
  const flat = text => text.replace(/\s+/g, ' ');
  assert.match(flat(skill), /Send `pbr: false` on every generation and `tripo_texture` call unless the user explicitly asks for PBR/);
  assert.match(flat(game), /`pbr: false` unless the user explicitly asks for PBR/);
  const docs = [skill, game, ref];
  if (hybrid) {
    const hook = read('hooks/session-start.mjs');
    assert.match(hook, /Send pbr: false on every generation and tripo_texture call unless the user explicitly asks for PBR/);
    docs.push(hook);
  }
  for (const text of docs.map(flat)) {
    for (const match of text.matchAll(/pbr: true|"pbr": ?true|pbr=true/g)) {
      const around = text.slice(Math.max(0, match.index - 200), match.index + 200);
      assert.match(around, /explicitly asks? for PBR|asks for it/, around);
    }
  }
});

test('README describes the MCP-only path', () => {
  const en = read('README.md');
  const zh = read('README_CN.md');
  assert.match(en, /there is no CLI path/);
  assert.match(en, /never installs or runs a command-line client/);
  assert.match(en, /PBR stays off unless\s+you explicitly ask for it/);
  assert.match(zh, /没有 CLI 路径/);
  assert.match(zh, /不会安装或调用任何命令行客户端/);
  assert.match(zh, /PBR 默认关闭/);
});
