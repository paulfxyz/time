const assert = (await import('node:assert/strict')).default;
const { mkdir, writeFile } = await import('node:fs/promises');
const { pathToFileURL } = await import('node:url');

export async function runWebQA(page, base = 'http://127.0.0.1:3000') {
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (condition, name) => { assert.ok(condition, name); checks.push(name); };
  const state = () => page.evaluate(() => window.timescreen.getState());
  const click = id => page.getByTestId(id).click();
  const dialog = async tab => { await click('button-appearance'); if (tab) await click(`tab-${tab}`); };
  const close = () => click('button-close-appearance');
  await page.goto(`${base}/#scene=observatory&city=lisbon&effects=1`);
  await page.waitForFunction(() => window.timescreen?.version === '2.0.0');
  await page.waitForFunction(() => window.timescreen.getState().ready);
  check(await page.locator('.scene-card').count() === 28, '28 scene cards');
  check(await page.locator('.theme-card').count() === 60, '60 palette choices');
  await dialog('styles');
  await page.getByTestId('input-scene-search').fill('apple');
  check(await page.locator('.scene-card:visible').count() === 1, 'Apple inspiration search');
  await click('category-retro');
  check(await page.locator('#scene-empty').isVisible(), 'Combined search/category empty state');
  await click('button-clear-style-filters');
  check(await page.locator('.scene-card:visible').count() === 28, 'Clear filters');
  await click('scene-matrix');
  check((await state()).scene === 'matrix', 'Select Matrix');
  await click('tab-themes');
  await page.getByTestId('input-theme-search').fill('azure');
  check(await page.locator('.theme-card:visible').count() === 1, 'Palette search');
  await click('theme-azure');
  check((await state()).theme === 'azure' && (await state()).scene === 'matrix', 'Scene and palette remain independent');
  await page.getByTestId('input-theme-search').fill('');
  await click('tab-display');
  for (const [id, key] of [['effects','effects'],['labels','labels'],['lights','lights'],['grid','grid'],['seconds','seconds'],['world','world']]) {
    const before = (await state())[key];
    await page.getByTestId(`toggle-${id}`).locator('..').click();
    check((await state())[key] === !before, `${id} toggle`);
    await page.getByTestId(`toggle-${id}`).locator('..').click();
  }
  await page.getByTestId('select-format').selectOption('12');
  check((await state()).format === '12', '12-hour format');
  await page.getByTestId('select-format').selectOption('24');
  await page.getByTestId('select-speed').selectOption('0');
  check((await state()).rotation === 0, 'Still orbit');
  await page.getByTestId('select-speed').selectOption('240');
  for (const id of ['0','1','2','3','4','5']) {
    await page.getByTestId('select-finish').selectOption(id);
    check((await state()).finish === Number(id), `Earth finish ${id}`);
  }
  await page.getByTestId('select-layout').selectOption('vertical');
  check((await state()).layout === 'vertical', 'Forced vertical layout');
  await page.getByTestId('select-layout').selectOption('auto');
  await page.getByTestId('tab-display').focus();
  await page.keyboard.press('Home');
  check(await page.getByTestId('tab-styles').getAttribute('aria-selected') === 'true', 'Keyboard tab navigation');
  await close();
  await click('button-city');
  await page.getByTestId('input-city-search').fill('Tokyo');
  await click('city-tokyo');
  check((await state()).city === 'tokyo', 'City search and selection');
  check((await page.getByTestId('text-offset').textContent()).includes('9'), 'Selected city UTC offset');
  await click('button-city');
  await page.getByTestId('input-city-search').fill('nonexistent city');
  check(await page.locator('.city-option:visible').count() === 0, 'City no-results state');
  await click('button-close-city');
  const rotation = (await state()).rotation;
  await click('button-rotation');
  check((await state()).rotation !== rotation, 'Orbit pause button');
  await click('button-rotation');
  await click('button-recenter');
  await page.getByTestId('canvas-earth').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('+');
  await page.keyboard.press('0');
  check((await state()).ready, 'Globe keyboard navigation');
  await click('button-light');
  for (const [preset, brightness] of [['night',35],['vivid',115],['cinema',80],['standard',100]]) {
    await click(`picture-${preset}`);
    check((await state()).brightness === brightness, `Picture preset ${preset}`);
  }
  await page.getByTestId('range-brightness').focus();
  await page.keyboard.press('Home');
  check((await state()).brightness === 15, 'Minimum brightness via keyboard slider');
  check(await page.getByTestId('button-reset-picture').isVisible(), 'Recovery control stays visible at minimum brightness');
  await click('button-reset-picture');
  await click('light-mode-light');
  check((await state()).mode === 'light', 'Light mode');
  await click('light-mode-dark');
  await click('button-light-done');
  await click('button-focus');
  check((await state()).quiet === true, 'Quiet mode');
  await page.keyboard.press('Escape');
  check((await state()).quiet === false, 'Escape restores controls');
  await page.locator('body').click({position:{x:20,y:150}});
  const beforeNext = (await state()).scene;
  await page.keyboard.press(']');
  check((await state()).scene !== beforeNext, 'Next style shortcut');
  await page.keyboard.press('[');
  check((await state()).scene === beforeNext, 'Previous style shortcut');
  await dialog('styles');
  await click('button-shuffle');
  check((await state()).scene !== beforeNext && !await page.locator('#appearance-dialog').isVisible(), 'Shuffle selects a different style and closes gallery');
  await dialog('styles');
  await click('button-restore-setup');
  await page.getByTestId('input-setup-code').fill('time:v2:scene=blueprint&theme=blueprint&mode=dark&city=lisbon&effects=0&brightness=87');
  await click('button-apply-setup');
  check((await state()).scene === 'blueprint' && (await state()).brightness === 87 && !(await state()).effects, 'Restore portable scene setup');
  if (await page.locator('#appearance-dialog').isVisible()) await close();
  await page.goto(`${base}/`);
  await page.waitForFunction(() => window.timescreen?.getState().scene === 'blueprint');
  check((await state()).brightness === 87, 'Bare URL restores saved setup');
  await dialog('styles');
  await click('button-restore-setup');
  await page.getByTestId('input-setup-code').fill('solstice:v1:theme=amber&mode=light&city=tokyo');
  await click('button-apply-setup');
  check((await state()).theme === 'amber' && (await state()).scene === 'observatory', 'Legacy setup compatibility');
  if (await page.locator('#appearance-dialog').isVisible()) await close();
  await click('button-fullscreen');
  await page.waitForFunction(() => window.timescreen.getState().fullscreen);
  check((await state()).fullscreen, 'Fullscreen entry');
  if (await page.locator('#fullscreen-dialog').isVisible()) await click('button-continue-display');
  await click('button-fullscreen');
  await page.waitForFunction(() => !window.timescreen.getState().fullscreen);
  check(!(await state()).fullscreen, 'Fullscreen exit');
  check(errors.length === 0, `No page errors: ${errors.join('; ')}`);
  return { passed:true, count:checks.length, checks, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}, timezoneId:'Europe/Lisbon'});
    const result = await runWebQA(page, process.env.QA_URL || 'http://127.0.0.1:3000');
    await mkdir('qa', {recursive:true});
    await writeFile('qa/interaction-report.json', JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally { await browser.close(); }
}
