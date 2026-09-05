import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVData, parseMetaCSVData } from '../js/parser.js';
import { matchesKanaGroup } from '../js/filter.js';

test('CSV Parser - Multiline and Escaped Quotes', () => {
  const sampleCSV = `ID,日語用詞,台灣意思,假名標音,建立日期
1,"お疲れ様","辛苦了
多行測試","おつかれさま","2024-01-01"
2,"""Quotes"" Term","包含""雙引號""","クォート","2024-01-02"`;

  const parsed = parseCSVData(sampleCSV);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].ja_term, 'お疲れ様');
  assert.equal(parsed[0].tw_translation, '辛苦了\n多行測試');
  assert.equal(parsed[1].ja_term, '"Quotes" Term');
  assert.equal(parsed[1].tw_translation, '包含"雙引號"');
});

test('Kana Group Matching', () => {
  assert.equal(matchesKanaGroup('ありがとう', 'あ'), true);
  assert.equal(matchesKanaGroup('いぬ', 'あ'), true);
  assert.equal(matchesKanaGroup('かさ', 'か'), true);
  assert.equal(matchesKanaGroup('がっこう', 'か'), true);
  assert.equal(matchesKanaGroup('さくら', 'あ'), false);
});

test('Unicode Character Length Calculation', () => {
  const countLen = str => [...str].length;
  assert.equal(countLen('あい'), 2);
  assert.equal(countLen('🌸日本'), 3);
  assert.equal(countLen('お疲れ様'), 4);
});

test('Default Welcome Route Resolution', () => {
  const resolveRoute = (hash) => {
    const decoded = decodeURIComponent(hash || '');
    if (!decoded || decoded === '#' || decoded === '#/') return 'welcome';
    const path = decoded.replace(/^#\/?/, '');
    if (!path || path === 'welcome' || path === 'home') return 'welcome';
    if (path === 'about') return 'about';
    return 'dictionary';
  };

  assert.equal(resolveRoute(''), 'welcome');
  assert.equal(resolveRoute('#'), 'welcome');
  assert.equal(resolveRoute('#/'), 'welcome');
  assert.equal(resolveRoute('#/welcome'), 'welcome');
  assert.equal(resolveRoute('#/about'), 'about');
  assert.equal(resolveRoute('#/日本特色詞彙'), 'dictionary');
});

test('Meta Sheet CSV Parser', () => {
  const sampleMetaCSV = `項目,內容
標題,日本特色詞彙
標籤,"日本文化
流行新詞
次文化用語"
副標,探索日本流行與次文化用語的專屬辭典
說明,本表收錄了豐富的日本文化特色詞彙。
注意事項,1. 測試注意事項
作者,巧克力`;

  const meta = parseMetaCSVData(sampleMetaCSV);
  assert.equal(meta.title, '日本特色詞彙');
  assert.equal(meta.subtitle, '探索日本流行與次文化用語的專屬辭典');
  assert.equal(meta.tags.length, 3);
  assert.equal(meta.tags[0], '日本文化');
  assert.equal(meta.author, '巧克力');
});

test('ID and Date Monospace Font Styling Configuration', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const css = readFileSync(resolve('styles.css'), 'utf-8');

  assert(html.includes('id="modal-created-at"'));
  assert(html.includes('id="modal-id"'));
  assert(css.includes('--awsui-font-mono'));
  assert(css.includes('#modal-created-at'));
  assert(css.includes('#modal-id'));
  assert(css.includes('[data-collection="japanese-terms"]'));
  assert(css.includes("'Noto Sans JP'"));
});
