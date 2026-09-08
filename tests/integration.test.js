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

test('Service Desk Operating Team and Platform Setup', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');

  // 1. Verify Service Desk (view-about) contains "經營團隊" and "平台名稱"
  const aboutViewStart = htmlContent.indexOf('id="view-about"');
  const aboutViewEnd = htmlContent.indexOf('id="view-stats"');
  assert(aboutViewStart !== -1 && aboutViewEnd !== -1);
  const aboutViewHtml = htmlContent.substring(aboutViewStart, aboutViewEnd);
  assert(aboutViewHtml.includes('<span>經營團隊</span>'), 'Service Desk header must show "經營團隊"');
  assert(aboutViewHtml.includes('經營團隊 / Operating Team'), 'Profile subtitle must show Operating Team');
  assert(aboutViewHtml.includes('平台名稱'), 'Service Desk info list must describe platform name');
});

test('Statistics Page under INFO Section - Nav Link and View Content', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');

  // 1. Verify INFO section contains nav-stats button
  const infoSectionStart = htmlContent.indexOf('class="awsui-side-nav-header">INFO');
  assert(infoSectionStart !== -1, 'HTML must contain INFO sidebar section header');

  const navStatsStart = htmlContent.indexOf('id="nav-stats"');
  assert(navStatsStart !== -1, 'Sidebar must contain nav-stats button');
  assert(navStatsStart > infoSectionStart, 'nav-stats must be inside INFO section');

  const statsNavSub = htmlContent.substring(navStatsStart, navStatsStart + 500);
  assert(statsNavSub.includes('統計資料'), 'nav-stats must contain "統計資料" text');
  assert(statsNavSub.includes("switchView('stats', event)"), 'nav-stats must call switchView for stats');

  // 2. Verify Statistics Page (view-stats) content layout
  const statsViewStart = htmlContent.indexOf('id="view-stats"');
  assert(statsViewStart !== -1, 'HTML must contain view-stats container');

  const statsViewEnd = htmlContent.indexOf('id="view-maintenance"');
  assert(statsViewEnd !== -1 && statsViewStart < statsViewEnd);
  const statsViewHtml = htmlContent.substring(statsViewStart, statsViewEnd);

  assert(statsViewHtml.includes('統計資料'), 'Statistics view must have "統計資料" header');
  assert(statsViewHtml.includes('總展廳數'), 'Statistics view must display "總展廳數" KPI title');
  assert(statsViewHtml.includes('總展品數'), 'Statistics view must display "總展品數" KPI title');
  assert(statsViewHtml.includes('id="stats-total-halls"'), 'Statistics view must contain stats-total-halls element');
  assert(statsViewHtml.includes('id="stats-total-items"'), 'Statistics view must contain stats-total-items element');
});

test('Modal Recommendation Elements in HTML', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');
  const cssContent = readFileSync(resolve('styles.css'), 'utf-8');

  assert(htmlContent.includes('id="detail-modal"'), 'HTML must contain detail-modal container');
  assert(!htmlContent.includes('class="awsui-modal-header"'), 'Modal header container must be removed');
  assert(htmlContent.includes('class="awsui-modal-title-row"'), 'Modal must contain modal title row');
  assert(cssContent.includes('#modal-term-title'), 'CSS must style modal-term-title');
  assert(cssContent.includes('font-size: 26px;'), 'Modal term title font size must be 26px');
  assert(htmlContent.includes('id="modal-recommendations-section"'), 'Modal must contain recommendations section container');
  assert(htmlContent.includes('id="modal-recommendations-list"'), 'Modal must contain recommendations list container');
  assert(htmlContent.includes('推薦展品'), 'Modal must render "推薦展品" title label');
});

test('Lobby Page Featured Cards Navigation and Structure', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');

  const welcomeViewStart = htmlContent.indexOf('id="view-welcome"');
  const welcomeViewEnd = htmlContent.indexOf('id="view-dictionary"');
  assert(welcomeViewStart !== -1 && welcomeViewEnd !== -1);
  const welcomeHtml = htmlContent.substring(welcomeViewStart, welcomeViewEnd);

  // 1. Verify "韓文單字加漢字 記憶更輕鬆" card is removed from lobby page view-welcome
  assert(!welcomeHtml.includes('id="welcome-card-korean-terms"'), 'Lobby page must not contain welcome-card-korean-terms');

  // 2. Verify cards do not have onclick on card container, and "進入展廳" button has onclick
  assert(!welcomeHtml.includes('<div class="awsui-welcome-card" id="welcome-card-japanese-terms" onclick='), 'Card container must not have onclick');
  assert(welcomeHtml.includes('onclick="switchCollection(\'japanese-terms\')"'), 'Enter hall button must have switchCollection click handler');
  assert(!welcomeHtml.includes('<div class="awsui-welcome-card" id="welcome-card-china-terms" onclick='), 'Card container must not have onclick');
  assert(welcomeHtml.includes('onclick="switchCollection(\'china-terms\')"'), 'Enter hall button must have switchCollection click handler');
});




