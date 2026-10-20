import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(readFileSync(new URL('../src/ass.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/llm.js', import.meta.url), 'utf8'), context);
const LLM = context.CrunchyrollLLM;
const ASS = context.CrunchyrollASS;
const settings = {engine: 'OpenAI兼容', llm_base_url: 'https://models.example.test/v1', llm_model: 'test-model', llm_api_key: 'unit-test-key-not-real'};
const sample = '[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\nDialogue: 0,0:00:01.00,0:00:02.00,Default,A,0,0,0,,Hello.\nDialogue: 0,0:00:03.00,0:00:04.00,Default,B,0,0,0,,Hello.';

test('model configuration normalizes a Base URL or accepts the full endpoint', () => {
  const base = LLM.config(settings);
  assert.equal(base.endpoint, 'https://models.example.test/v1/chat/completions');
  assert.equal(LLM.config({...settings, llm_base_url: base.endpoint + '/'}).endpoint, base.endpoint);
  assert.equal(base.model, 'test-model');
  assert.equal(LLM.config({...settings, llm_budget_seconds: 500}).budget, 40000);
});

test('missing credentials and unsafe endpoint forms do not enable model requests', () => {
  for (const override of [{engine: 'Google'}, {llm_model: ''}, {llm_api_key: ''},
    {llm_base_url: 'http://models.example.test/v1'},
    {llm_base_url: 'https://user:password@models.example.test/v1'},
    {llm_base_url: 'https://models.example.test/v1?key=secret'},
    {llm_base_url: 'https://models.example.test/v1/responses'},
    {llm_api_key: 'invalid\r\nHeader: value'}]) {
    assert.equal(LLM.config({...settings, ...override}), null);
  }
});

test('uses speaker-aware cue IDs so identical English can have different translations', () => {
  const doc = ASS.parse(sample);
  assert.deepEqual(Array.from(doc.events, row => row.speaker), ['A', 'B']);
  const translated = Object.fromEntries(doc.events.map((row, i) => [row.id, i ? '您好。' : '你好。']));
  const output = ASS.renderById(doc, translated, false).body;
  assert.ok(output.includes('Default,A,0,0,0,,你好。'));
  assert.ok(output.includes('Default,B,0,0,0,,您好。'));
});

test('request authentication stays out of prompts and cache fingerprints', () => {
  const config = LLM.config(settings);
  const job = LLM.jobs(ASS.parse(sample))[0];
  const request = LLM.request(job, config, 4000);
  const body = JSON.parse(request.body);
  assert.equal(request.headers.Authorization, 'Bearer ' + settings.llm_api_key);
  assert.equal(request['auto-cookie'], false);
  assert.equal(request['auto-redirect'], false);
  assert.equal(body.model, 'test-model');
  assert.equal(body.stream, false);
  assert.deepEqual(body.response_format, {type: 'json_object'});
  assert.ok(!request.body.includes(settings.llm_api_key));
  assert.ok(!LLM.fingerprint(job, config).includes(settings.llm_api_key));
  assert.notEqual(LLM.fingerprint(job, config), LLM.fingerprint(job, {...config, model: 'another-model'}));
  assert.notEqual(LLM.fingerprint(job, config), LLM.fingerprint({...job, payload: {...job.payload, before: [{text: 'Different context'}]}}, config));
  const noJson = LLM.request(job, {...config, jsonMode: false}, 4000);
  assert.equal(JSON.parse(noJson.body).response_format, undefined);
});

test('rejects missing, extra, empty, truncated, or refused model translations', () => {
  const job = LLM.jobs(ASS.parse(sample))[0];
  const valid = Object.fromEntries(job.entries.map(row => [row.id, '你好。']));
  const response = (translations, finish = 'stop', refusal = null) => JSON.stringify({choices: [{finish_reason: finish, message: {content: JSON.stringify({translations}), refusal}}]});
  assert.equal(Object.keys(LLM.decode(response(valid), job.entries)).length, 2);
  for (const raw of [response({}), response({...valid, extra: 'extra'}),
    response({...valid, [job.entries[0].id]: ''}), response(valid, 'length'), response(valid, 'stop', 'refused')]) {
    assert.throws(() => LLM.decode(raw, job.entries));
  }
});
