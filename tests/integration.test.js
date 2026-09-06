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
  
  // Verify Lobby Page (view-welcome) layout: Opening hours inline element is placed next to actions
  const titlePos = htmlContent.indexOf('Welcome to Collection Gallery Online !');
  const aboutBtnPos = htmlContent.indexOf('前往服務台');
  const inlineHoursPos = htmlContent.indexOf('awsui-hero-hours-inline');
  assert(titlePos !== -1 && aboutBtnPos !== -1 && inlineHoursPos !== -1);
  assert(titlePos < inlineHoursPos, 'Hero title must be placed at the top before opening hours');
  assert(aboutBtnPos < inlineHoursPos, 'Opening hours must be placed directly to the right of "前往服務台" button');

  // Verify Service Desk Page (view-about) contains weekly opening hours schedule
  assert(htmlContent.includes('id="view-about"'));
  assert(htmlContent.includes('參觀時間'));
  assert(htmlContent.includes('01:00 - 23:55'));
  assert(htmlContent.includes('06:00 - 23:55'));
  assert(htmlContent.includes('週一'));
  assert(htmlContent.includes('週日'));
});

test('Router Maintenance Redirection - Outside Opening Hours', async () => {
  const { isGalleryOpen } = await import('../js/utils.js');
  
  // Create mock DOM environment
  const mockElements = {
    'nav-welcome': { classList: { add: () => {}, remove: () => {} } },
    'nav-about': { classList: { add: () => {}, remove: () => {} } },
    'view-welcome': { classList: { add: () => {}, remove: () => {} }, style: {} },
    'view-dictionary': { classList: { add: () => {}, remove: () => {} }, style: {} },
    'view-about': { classList: { add: () => {}, remove: () => {} }, style: {} },
    'view-maintenance': { classList: { add: () => {}, remove: () => {} }, style: {} }
  };

  const originalDocument = global.document;
  const originalWindow = global.window;

  global.document = {
    getElementById: (id) => mockElements[id] || null,
    querySelectorAll: () => []
  };
  global.window = {
    location: { hash: '#/welcome' },
    scrollTo: () => {}
  };

  const { switchView } = await import('../js/router.js');

  // Verify that calling switchView('maintenance') activates view-maintenance and hides view-welcome
  switchView('maintenance', null, false);
  assert.equal(mockElements['view-maintenance'].style.display, 'block');
  assert.equal(mockElements['view-welcome'].style.display, 'none');

  if (originalDocument) global.document = originalDocument;
  if (originalWindow) global.window = originalWindow;
});


