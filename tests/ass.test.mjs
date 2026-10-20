import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(readFileSync(new URL('../src/ass.js', import.meta.url), 'utf8'), context);
const ASS = context.CrunchyrollASS;
const header = '[Script Info]\nTitle: Synthetic test\n[V4+ Styles]\nStyle: Default,Arial,30\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
const row = 'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,';

test('preserves all headers, timing fields, and commas in the dialogue text', () => {
  const original = header + row + 'Hello, world!';
  const doc = ASS.parse(original);
  assert.equal(doc.events.length, 1);
  assert.equal(doc.events[0].plain, 'Hello, world!');
  assert.equal(ASS.render(doc, {'Hello, world!': '你好，世界！'}, false).body, header + row + '你好，世界！');
});

test('retains BOM, CRLF, and the final newline', () => {
  const original = '\uFEFF' + (header + row + 'Hello.\n').replaceAll('\n', '\r\n');
  const result = ASS.render(ASS.parse(original), {'Hello.': '你好。'}, false);
  assert.equal(result.body, original.replace('Hello.', '你好。'));
});

test('reads the Events format instead of assuming fixed metadata columns', () => {
  const original = '[Events]\nFormat: Style, End, Start, Text\nDialogue: Default,0:00:03.00,0:00:01.00,Hello, world!';
  const result = ASS.render(ASS.parse(original), {'Hello, world!': '你好。'}, false);
  assert.equal(result.body, original.replace('Hello, world!', '你好。'));
});

test('keeps drawings and karaoke unchanged', () => {
  const drawing = row + '{\\p1}m 0 0 l 20 20{\\p0}';
  const karaoke = row + '{\\k20}Hello.';
  const original = header + drawing + '\n' + karaoke + '\n' + row + 'Stay here.';
  const result = ASS.render(ASS.parse(original), {'Stay here.': '留在这里。'}, false);
  assert.equal(result.body, original.replace('Stay here.', '留在这里。'));
});

test('preserves override codes and supports bilingual output', () => {
  const original = header + row + '{\\an8\\i1}Hello.\\NStay here.{\\i0}';
  const doc = ASS.parse(original);
  assert.equal(doc.events[0].plain, 'Hello. Stay here.');
  const translated = {'Hello. Stay here.': '你好。留在这里。'};
  assert.equal(ASS.render(doc, translated, true).body, original + '\\N{\\r}你好。留在这里。');
  const chinese = ASS.render(doc, translated, false).body;
  assert.ok(chinese.includes('{\\an8\\i1}{\\i0}你好。留在这里。'));
});

test('does not insert ASS formatting commands from a translation', () => {
  const doc = ASS.parse(header + row + 'Hello.');
  const rendered = ASS.render(doc, {'Hello.': '{\\p1}test\nnext'}, false).body;
  assert.ok(rendered.endsWith('｛＼p1｝test\\Nnext'));
});

test('rejects batches with an unexpected translation row count', () => {
  const valid = JSON.stringify([[['你好。\r', 'Hello.\r'], ['留在这里。', 'Stay here.']], null, 'en']);
  assert.deepEqual(Array.from(ASS.decodeGoogle(valid, 2)), ['你好。', '留在这里。']);
  assert.throws(() => ASS.decodeGoogle(valid, 3), /row count/);
  assert.throws(() => ASS.decodeGoogle('<html>Error</html>', 1));
});

test('bounds batches by row count and encoded URL length', () => {
  const batches = ASS.batches(['one', 'two', 'three', 'four'], 20, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(batches)), [['one', 'two'], ['three', 'four']]);
  const rows = ['🦊'.repeat(5), 'safe'];
  const bounded = ASS.batches(rows, 20, 50);
  assert.deepEqual(JSON.parse(JSON.stringify(bounded)), [['safe']]);
});
