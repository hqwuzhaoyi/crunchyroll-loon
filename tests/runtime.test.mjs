import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../Crunchyroll.OfficialCN.js', import.meta.url), 'utf8');

function execute(response) {
  const outputs = [];
  const context = { $done(value) { outputs.push(JSON.parse(JSON.stringify(value))); } };
  if (response !== undefined) context.$response = response;
  // No HTTP client, timers, storage, or Node APIs are provided to the runtime.
  vm.runInNewContext(source, context, { timeout: 1000 });
  assert.equal(outputs.length, 1, 'the response must complete exactly once');
  return outputs[0];
}

function playback() {
  return {
    token: 'synthetic-session-token',
    url: 'https://video.example.test/main.m3u8?Signature=SYNTHETIC_VIDEO',
    audioLocale: 'ja-JP',
    drm: { mode: 'synthetic-unchanged-value' },
    subtitles: {
      'en-US': { language: 'en-US', format: 'ass', url: 'https://cdn.example.test/en.ass?Signature=SYNTHETIC_EN' },
      'zh-CN': { language: 'zh-CN', format: 'ass', url: 'https://cdn.example.test/cn.ass?Signature=SYNTHETIC_CN' },
      'zh-HK': { language: 'zh-HK', format: 'ass', url: 'https://cdn.example.test/hk.ass?Signature=SYNTHETIC_HK' },
    },
  };
}

function response(payload) {
  return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
}

test('changes only the English URL and format, retaining the complete signed URL', () => {
  const input = playback();
  const expected = structuredClone(input);
  expected.subtitles['en-US'].url = expected.subtitles['zh-CN'].url;
  expected.subtitles['en-US'].format = expected.subtitles['zh-CN'].format;
  const actual = JSON.parse(execute(response(input)).body);
  assert.deepEqual(actual, expected);
  assert.equal(actual.subtitles['en-US'].language, 'en-US');
});

test('uses Traditional Chinese when Simplified Chinese is absent', () => {
  const input = playback();
  delete input.subtitles['zh-CN'];
  const actual = JSON.parse(execute(response(input)).body);
  assert.equal(actual.subtitles['en-US'].url, input.subtitles['zh-HK'].url);
});

test('keeps the original response when Chinese subtitles are missing', () => {
  const input = playback();
  delete input.subtitles['zh-CN'];
  delete input.subtitles['zh-HK'];
  assert.deepEqual(execute(response(input)), {});
});

test('does not create an English slot when none was returned', () => {
  const input = playback();
  delete input.subtitles['en-US'];
  assert.deepEqual(execute(response(input)), {});
});

test('copies the selected Chinese format along with its URL', () => {
  const input = playback();
  input.subtitles['en-US'].format = 'vtt';
  const actual = JSON.parse(execute(response(input)).body);
  assert.equal(actual.subtitles['en-US'].format, 'ass');
});

test('passes through unsupported or non-HTTPS subtitle targets', () => {
  for (const invalid of [{ url: 'http://cdn.example.test/cn.ass' }, { format: 'unsupported' }]) {
    const input = playback();
    Object.assign(input.subtitles['zh-CN'], invalid);
    assert.deepEqual(execute(response(input)), {});
  }
});

test('passes through malformed JSON, absent data, and unexpected body types', () => {
  for (const input of [undefined, { status: 204 }, { status: 500, body: '{}' },
    { status: 200, body: 'invalid-json' }, { status: 200, body: new Uint8Array([1, 2]) },
    response(null), response({}), response({ subtitles: null })]) {
    assert.deepEqual(execute(input), {});
  }
});
