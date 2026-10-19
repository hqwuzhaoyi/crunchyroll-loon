import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('the Loon plugin uses a fixed release script matching package.json', () => {
  const { version } = JSON.parse(read('package.json'));
  const plugin = read('Crunchyroll.OfficialCN.plugin');
  assert.ok(plugin.includes(`https://raw.githubusercontent.com/hqwuzhaoyi/crunchyroll-loon/v${version}/Crunchyroll.OfficialCN.js`));
  assert.ok(plugin.includes('requires_body=true'));
  assert.ok(plugin.includes('hostname = www.crunchyroll.com'));
  assert.ok(plugin.includes('/ios\\/iphone\\/play'));
  assert.equal(plugin, read('Crunchyroll.Chinese.plugin'));
  assert.ok(plugin.includes(`v${version}/Crunchyroll.Translate.js`));
  assert.ok(plugin.includes('vod-fy-mod.crunchyrollcdn.com'));
});

test('published runtime and plugin exclude LAN addresses and diagnostic receivers', () => {
  const files = ['Crunchyroll.OfficialCN.js', 'Crunchyroll.OfficialCN.plugin', 'Crunchyroll.Translate.js'];
  for (const file of files) {
    const text = read(file);
    assert.doesNotMatch(text, /https?:\/\/(?:localhost|127\.|192\.168\.|10\.\d+\.|172\.(?:1[6-9]|2\d|3[01])\.)/i);
    assert.doesNotMatch(text, /__TOKEN__|__BASE_URL__|X-Probe-Token|\/report/);
  }
});
