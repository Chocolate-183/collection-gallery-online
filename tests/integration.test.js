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

test('Google Form Feedback and Submission Link - About Page and Exhibition Hall Footer', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');
  const formUrl = 'https://forms.gle/GjK2vAxdUiAoec636';

  // 1. Verify Google Form link exists in About Page (view-about)
  const aboutViewStart = htmlContent.indexOf('id="view-about"');
  const aboutViewEnd = htmlContent.indexOf('id="view-maintenance"');
  assert(aboutViewStart !== -1 && aboutViewEnd !== -1);
  const aboutViewHtml = htmlContent.substring(aboutViewStart, aboutViewEnd);
  assert(aboutViewHtml.includes(formUrl), 'About page must contain Google Form link');
  assert(aboutViewHtml.includes('問題回報與投稿'), 'About page must contain "問題回報與投稿" section');

  // 2. Verify Google Form link exists at the bottom of Exhibition Hall view (view-dictionary)
  const dictViewStart = htmlContent.indexOf('id="view-dictionary"');
  assert(dictViewStart !== -1 && dictViewStart < aboutViewStart);
  const dictViewHtml = htmlContent.substring(dictViewStart, aboutViewStart);
  assert(dictViewHtml.includes('id="collection-feedback-container"'), 'Exhibition hall view must contain feedback container');
  assert(dictViewHtml.includes(formUrl), 'Exhibition hall footer must contain Google Form link');
  assert(dictViewHtml.includes('填寫問題回報 / 投稿表單'), 'Exhibition hall footer must contain "填寫問題回報 / 投稿表單" link');
});

test('Service Desk Operating Team, Gallery Curators, and Trial Beta Badge', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');

  // 1. Verify Service Desk (view-about) contains "經營團隊" and "平台名稱"
  const aboutViewStart = htmlContent.indexOf('id="view-about"');
  const aboutViewEnd = htmlContent.indexOf('id="view-maintenance"');
  assert(aboutViewStart !== -1 && aboutViewEnd !== -1);
  const aboutViewHtml = htmlContent.substring(aboutViewStart, aboutViewEnd);
  assert(aboutViewHtml.includes('<span>經營團隊</span>'), 'Service Desk header must show "經營團隊"');
  assert(aboutViewHtml.includes('經營團隊 / Operating Team'), 'Profile subtitle must show Operating Team');
  assert(aboutViewHtml.includes('平台名稱'), 'Service Desk info list must describe platform name');
  assert(aboutViewHtml.includes('展廳策劃與負責人'), 'Service Desk must contain gallery curators panel');

  // 2. Verify "試營運" trial tags exist across key entry points
  assert(htmlContent.includes('awsui-badge-trial'), 'Trial badge class must exist');
  assert(htmlContent.includes('試營運'), 'Trial badge text "試營運" must be present');

  // 3. Verify Dictionary view header contains gallery curator & responsible person KPI box
  const dictViewStart = htmlContent.indexOf('id="view-dictionary"');
  const dictViewHtml = htmlContent.substring(dictViewStart, aboutViewStart);
  assert(dictViewHtml.includes('collection-header-author'), 'Dictionary view must contain curator/responsible person KPI box');
  assert(dictViewHtml.includes('策劃與負責人'), 'Dictionary view KPI label must show "策劃與負責人"');
});



