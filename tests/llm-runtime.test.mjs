import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../Crunchyroll.Translate.js', import.meta.url), 'utf8');
const prefix = '[Script Info]\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n';
const ass = texts => prefix + texts.map((text, i) => `Dialogue: 0,0:00:01.00,0:00:03.00,Default,Speaker${i},0,0,0,,${text}`).join('\n');
const fakeKey = 'unit-test-key-not-real';
const defaults = {engine: 'OpenAI兼容', llm_base_url: 'https://models.example.test/v1', llm_model: 'test-model', llm_api_key: fakeKey};

function execute(body, options = {}) {
  const state = {outputs: [], posts: [], gets: [], pendingPosts: [], pendingGets: [], timers: [], stores: structuredClone(options.stores || {}), now: 1000000, maxPending: 0};
  const context = {
    $response: {status: 200, body},
    $request: {url: 'https://cdn.example.test/subtitle.ass?Signature=synthetic-private', headers: {Authorization: 'synthetic-playback-auth', Cookie: 'synthetic-cookie'}},
    $argument: {...defaults, ...options.args},
    $done(value) {state.outputs.push(JSON.parse(JSON.stringify(value)));},
    setTimeout(fn, ms) {state.timers.push({fn, ms}); return state.timers.length;}, clearTimeout() {},
    Date: {now: () => state.now},
    $persistentStore: {read: key => JSON.stringify(state.stores[key] || {}), write(value, key) {state.stores[key] = JSON.parse(value); return true;}},
    $httpClient: {
      post(request, callback) {state.posts.push(request); state.pendingPosts.push({request, callback}); track();},
      get(request, callback) {state.gets.push(request); state.pendingGets.push({request, callback}); track();},
    },
  };
  function track() {state.maxPending = Math.max(state.maxPending, state.pendingPosts.length + state.pendingGets.length);}
  vm.runInNewContext(source, context, {timeout: 1000});
  state.replyModel = (options = {}) => {
    const job = state.pendingPosts.shift(); assert.ok(job);
    const payload = JSON.parse(JSON.parse(job.request.body).messages[1].content);
    const translated = options.translations || Object.fromEntries(payload.lines.map(row => [row.id, '模型译文：' + row.speaker + ':' + row.text]));
    job.callback(options.error || null, {status: options.status || 200}, JSON.stringify({choices: [{finish_reason: options.finish || 'stop', message: {content: JSON.stringify({translations: translated})}}]}));
  };
  state.replyGoogle = (status = 200) => {
    const job = state.pendingGets.shift(); assert.ok(job);
    const text = new URL(job.request.url).searchParams.get('q');
    job.callback(null, {status}, JSON.stringify([[[text.split('\r').map(row => 'Google译文：' + row).join('\r'), text]], null, 'en']));
  };
  return state;
}

test('configurable endpoint, model and credentials produce only the intended model request', () => {
  const state = execute(ass(['Hello.']));
  assert.equal(state.posts[0].url, 'https://models.example.test/v1/chat/completions');
  const body = JSON.parse(state.posts[0].body);
  assert.equal(body.model, 'test-model');
  assert.ok(!state.posts[0].body.includes(fakeKey));
  assert.ok(!state.posts[0].body.includes('synthetic-playback-auth'));
  assert.ok(!state.posts[0].body.includes('synthetic-private'));
  state.replyModel();
  assert.equal(state.outputs.length, 1);
  assert.ok(state.outputs[0].body.includes('模型译文：Speaker0:Hello.'));
  assert.ok(!JSON.stringify(state.stores).includes(fakeKey));
});

test('identical English lines retain independent cue translations', () => {
  const state = execute(ass(['Hello.', 'Hello.']));
  state.replyModel();
  assert.ok(state.outputs[0].body.includes('Speaker0,0,0,0,,模型译文：Speaker0:Hello.'));
  assert.ok(state.outputs[0].body.includes('Speaker1,0,0,0,,模型译文：Speaker1:Hello.'));
});

test('missing model configuration falls back without making a model call', () => {
  const state = execute(ass(['Hello.']), {args: {llm_api_key: ''}});
  assert.equal(state.posts.length, 0); assert.equal(state.gets.length, 1);
  state.replyGoogle(); assert.equal(state.outputs.length, 1);
});

test('Google remains the default even when model fields are populated', () => {
  const state = execute(ass(['Hello.']), {args: {engine: 'Google'}});
  assert.equal(state.posts.length, 0); state.replyGoogle();
  assert.equal(state.outputs.length, 1);
});

test('provider errors fall back to Google without forwarding model authentication', () => {
  const state = execute(ass(['Hello.'])); state.replyModel({status: 401});
  assert.equal(state.gets.length, 1);
  assert.equal(state.gets[0].headers.Authorization, undefined);
  assert.ok(!JSON.stringify(state.gets).includes(fakeKey));
  state.replyGoogle();
  assert.ok(state.outputs[0].body.includes('Google译文：Hello.'));
  assert.equal(state.stores['Crunchyroll.Translate.LLM.zh-CN.v1'], undefined);
});

test('invalid model IDs fall back instead of misaligning cues', () => {
  const state = execute(ass(['Hello.', 'Stay here.'])); state.replyModel({translations: {wrong: '错误 ID'}});
  state.replyGoogle();
  assert.ok(state.outputs[0].body.includes('Google译文：Hello.'));
  assert.ok(state.outputs[0].body.includes('Google译文：Stay here.'));
});

test('model cache is context-specific and isolated from Google and other model names', () => {
  const first = execute(ass(['Hello.'])); first.replyModel();
  const second = execute(ass(['Hello.']), {stores: first.stores});
  assert.equal(second.posts.length, 0); assert.equal(second.gets.length, 0);
  assert.equal(second.outputs[0].body, first.outputs[0].body);
  const changed = execute(ass(['Hello.']), {stores: first.stores, args: {llm_model: 'another-model'}});
  assert.equal(changed.posts.length, 1);
  changed.replyModel();
  const google = execute(ass(['Hello.']), {stores: first.stores, args: {engine: 'Google'}});
  assert.equal(google.gets.length, 1);
});

test('global deadline preserves completed model batches and ignores late results', () => {
  const state = execute(ass(Array.from({length: 45}, (_, i) => 'Line ' + i)));
  state.replyModel(); state.timers[0].fn();
  assert.equal(state.outputs.length, 1);
  assert.ok(state.outputs[0].body.includes('模型译文：Speaker0:Line 0'));
  assert.ok(state.outputs[0].body.includes('Speaker44,0,0,0,,Line 44'));
  while (state.pendingPosts.length) state.replyModel();
  assert.equal(state.outputs.length, 1);
});

test('limits model concurrency and stops further model calls after a failed provider', () => {
  const state = execute(ass(Array.from({length: 100}, (_, i) => 'Line ' + i)));
  assert.equal(state.posts.length, 2);
  state.replyModel({status: 429});
  while (state.pendingPosts.length || state.pendingGets.length) {
    if (state.pendingPosts.length) state.replyModel({status: 429});
    else state.replyGoogle();
  }
  assert.equal(state.posts.length, 2);
  assert.ok(state.maxPending <= 2);
  assert.equal(state.outputs.length, 1);
});

test('bilingual model results retain the English source', () => {
  const state = execute(ass(['Hello.']), {args: {display: '中英双语'}}); state.replyModel();
  assert.ok(state.outputs[0].body.includes('Hello.\\N{\\r}模型译文：Speaker0:Hello.'));
});

test('insufficient time skips Google fallback and returns the original subtitle', () => {
  const state = execute(ass(['Hello.'])); state.now += 14950;
  state.replyModel({status: 500});
  assert.equal(state.gets.length, 0);
  assert.deepEqual(state.outputs, [{}]);
});
