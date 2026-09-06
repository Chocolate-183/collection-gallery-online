import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load local snapshot files
const dataJson = JSON.parse(readFileSync(resolve('data.json'), 'utf-8'));
const chinaDataJson = JSON.parse(readFileSync(resolve('china-data.json'), 'utf-8'));

test('Local Fallback Snapshot Integrity - Japanese Terms', () => {
  assert(Array.isArray(dataJson));
  assert(dataJson.length > 0);
  const sample = dataJson[0];
  assert('ja_term' in sample);
  assert('tw_translation' in sample);
  assert('reading' in sample);
});

test('Opening Hours Information in HTML - Lobby and Service Desk', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');
  
  // Verify Lobby Page (view-welcome) layout: Title comes before opening hours badge
  const titlePos = htmlContent.indexOf('Welcome to Collection Gallery Online !');
  const badgePos = htmlContent.indexOf('awsui-hero-hours-badge');
  assert(titlePos !== -1 && badgePos !== -1);
  assert(titlePos < badgePos, 'Hero title must be placed at the top before opening hours badge');

  // Verify Service Desk Page (view-about) contains weekly opening hours schedule
  assert(htmlContent.includes('id="view-about"'));
  assert(htmlContent.includes('參觀時間'));
  assert(htmlContent.includes('01:00 - 23:55'));
  assert(htmlContent.includes('06:00 - 23:55'));
  assert(htmlContent.includes('週一'));
  assert(htmlContent.includes('週日'));
});

