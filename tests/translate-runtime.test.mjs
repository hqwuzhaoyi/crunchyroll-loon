import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../Crunchyroll.Translate.js', import.meta.url), 'utf8');
const prefix = '[Script Info]\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n';
const row = 'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,';
const ass = lines => prefix + lines.map(line => row + line).join('\n');

function execute(body, options = {}) {
  const state = {outputs: [], pending: [], timers: [], requests: [], writes: [], maxPending: 0};
  const context = {
    $response: {status: 200, body},
    $argument: {display: options.bilingual ? '中英双语' : '仅中文'},
    $done(value) {state.outputs.push(JSON.parse(JSON.stringify(value)));},
    setTimeout(fn) {state.timers.push(fn); return state.timers.length;}, clearTimeout() {},
    $persistentStore: {
      read() {return options.cache || '{}';},
      write(value) {state.writes.push(JSON.parse(value)); return true;},
    },
    $httpClient: {get(request, callback) {
      state.requests.push(request);
      state.pending.push({request, callback});
      state.maxPending = Math.max(state.maxPending, state.pending.length);
    }},
  };
  if (options.noHttp) delete context.$httpClient;
  vm.runInNewContext(source, context, {timeout: 1000});
  state.reply = (status = 200, mismatch = false) => {
    const job = state.pending.shift();
    assert.ok(job);
    const q = new URL(job.request.url).searchParams.get('q').split('\r');
    const translated = mismatch ? '错误条数' : q.map(text => '译文：' + text).join('\r');
    job.callback(null, {status}, JSON.stringify([[[translated, q.join('\r')]], null, 'en']));
  };
  return state;
}

test('deduplicates repeated dialogue and preserves every event timing field', () => {
  const original = ass(['Hello.', 'Stay here.', 'Hello.']);
  const state = execute(original);
  const texts = new URL(state.requests[0].url).searchParams.get('q').split('\r');
  assert.deepEqual(Object.keys(state.requests[0].headers), ['Accept']);
  assert.equal(state.requests[0]['auto-cookie'], false);
  assert.deepEqual(texts, ['Hello.', 'Stay here.']);
  state.reply();
  assert.equal(state.outputs.length, 1);
  assert.equal(state.outputs[0].body, ass(['译文：Hello.', '译文：Stay here.', '译文：Hello.']));
  assert.equal(state.writes.length, 1);
});

test('can produce bilingual subtitles', () => {
  const state = execute(ass(['Hello.']), {bilingual: true}); state.reply();
  assert.equal(state.outputs[0].body, ass(['Hello.\\N{\\r}译文：Hello.']));
});

test('a full local cache hit requires no HTTP client', () => {
  const first = execute(ass(['Hello.'])); first.reply();
  const second = execute(ass(['Hello.']), {cache: JSON.stringify(first.writes[0]), noHttp: true});
  assert.equal(second.outputs[0].body, first.outputs[0].body);
  assert.equal(second.requests.length, 0);
});

test('cache entries must match the original text, not just a hash key', () => {
  const first = execute(ass(['Hello.'])); first.reply();
  const cache = first.writes[0];
  Object.values(cache)[0].source = 'Different source';
  const second = execute(ass(['Hello.']), {cache: JSON.stringify(cache)});
  assert.equal(second.requests.length, 1);
  second.reply();
  assert.equal(second.outputs[0].body, first.outputs[0].body);
});

test('network errors and row-count mismatch return the original response', () => {
  const mismatch = execute(ass(['Hello.', 'Stay here.'])); mismatch.reply(200, true);
  assert.deepEqual(mismatch.outputs, [{}]);
  const failed = execute(ass(['Hello.'])); failed.reply(500);
  assert.deepEqual(failed.outputs, [{}]);
});

test('global deadline keeps completed batches and ignores late callbacks', () => {
  const original = ass(Array.from({length: 120}, (_, i) => 'Line ' + i));
  const state = execute(original);
  state.reply();
  state.timers[0]();
  assert.equal(state.outputs.length, 1);
  assert.ok(state.outputs[0].body.includes(row + '译文：Line 0'));
  assert.ok(state.outputs[0].body.includes(row + 'Line 119'));
  while (state.pending.length) state.reply();
  assert.equal(state.outputs.length, 1);
});

test('caps concurrent requests and persistent cache size', () => {
  const state = execute(ass(Array.from({length: 650}, (_, i) => 'Line ' + i)));
  while (state.pending.length) state.reply();
  assert.equal(state.outputs.length, 1);
  assert.ok(state.maxPending <= 3);
  assert.equal(Object.keys(state.writes[0]).length, 600);
});

test('rate limiting stops queued requests and falls back to English', () => {
  const state = execute(ass(Array.from({length: 400}, (_, i) => 'Line ' + i)));
  assert.equal(state.requests.length, 3);
  while (state.pending.length) state.reply(429);
  assert.equal(state.requests.length, 3);
  assert.deepEqual(state.outputs, [{}]);
});

test('malformed cache and unsupported subtitle payloads cannot break playback', () => {
  const malformed = execute(ass(['Hello.']), {cache: 'invalid-json'}); malformed.reply();
  assert.ok(malformed.outputs[0].body.includes('译文：Hello.'));
  assert.deepEqual(execute('<html>Error</html>').outputs, [{}]);
});
