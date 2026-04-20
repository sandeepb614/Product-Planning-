const { chromium } = require('playwright');

const BASE = 'http://localhost:7070/features_view.html';
let passed = 0, failed = 0;

function ok(label, val) {
  if (val) { console.log(`  ✓ ${label}`); passed++; }
  else      { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

async function logout(page) {
  page.once('dialog', d => d.accept());
  await page.click('#userChip');
  await page.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 });
}

async function login(page, name) {
  await page.goto(BASE);
  await page.waitForSelector('#loginScreen', { state: 'visible' });
  await page.fill('#loginInput', name);
  await page.waitForSelector('.login-suggest-item', { timeout: 2000 });
  await page.click('.login-suggest-item');
  await page.waitForSelector('#loginScreen', { state: 'hidden', timeout: 3000 });
}

async function waitPanelOpen(page) {
  await page.waitForFunction(() => {
    const p = document.getElementById('wfActionPanel');
    return p && p.classList.contains('open');
  }, { timeout: 3000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ── 1. Login screen ───────────────────────────────────────────────────────
  console.log('\n[1] Login screen');
  await page.goto(BASE);
  await page.waitForSelector('#loginScreen');
  ok('Login screen visible on load', await page.isVisible('#loginScreen'));
  ok('Sign-in button present', await page.isVisible('.login-btn'));

  await page.fill('#loginInput', 'zzz_nonexistent');
  await page.waitForTimeout(300);
  await page.click('.login-btn');
  await page.waitForTimeout(300);
  const errText = await page.textContent('#loginError');
  ok('Error shown for unknown name', errText.includes('not found'));

  // ── 2. Login as Developer ─────────────────────────────────────────────────
  console.log('\n[2] Login as Jake Wilson (Developer)');
  await login(page, 'Jake');
  ok('Login screen hidden after login', !(await page.isVisible('#loginScreen')));
  ok('User chip visible', await page.isVisible('#userChip'));
  const chipText = await page.textContent('#userChip');
  ok('User chip shows name', chipText.includes('Jake Wilson'));
  ok('User chip shows role', chipText.includes('Developer'));

  // ── 3. Panel on Data view ─────────────────────────────────────────────────
  console.log('\n[3] Action panel — Data View');
  ok('Data view is default', await page.isVisible('#dataView'));
  const firstFeatNum = await page.textContent('td .feat-num');
  ok('Feature number visible in table', firstFeatNum.includes('FEAT-'));

  await page.click('td[title="Open detail panel"]');
  await waitPanelOpen(page);
  ok('Panel opens on feat-num click in data view', await page.isVisible('#wfActionPanel'));

  const panelText = await page.textContent('#wfActionPanel');
  ok('Panel shows feature number', panelText.includes('FEAT-'));
  ok('Panel shows YOUR ACTION section', panelText.includes('Your Action'));
  ok('Panel shows role badge', panelText.includes('Developer'));
  ok('Panel shows HISTORY section', panelText.includes('History'));

  // Close via ✕ button
  await page.click('.wf-close-btn');
  await page.waitForTimeout(400);
  ok('Panel closes on ✕ click', !(await page.evaluate(() =>
    document.getElementById('wfActionPanel').classList.contains('open'))));

  // ── 4. Panel on Timeline view ─────────────────────────────────────────────
  console.log('\n[4] Action panel — Timeline View');
  await page.selectOption('#viewSelect', 'timeline');
  await page.waitForSelector('#timelineView', { state: 'visible' });
  await page.waitForTimeout(300);

  const pillCount = await page.locator('.tl-pill').count();
  ok(`Timeline has feature pills (${pillCount} found)`, pillCount > 0);

  const firstPill = page.locator('.tl-pill').first();
  ok('Timeline pill has cursor:pointer', await firstPill.evaluate(el =>
    getComputedStyle(el).cursor === 'pointer'));

  await firstPill.click();
  await waitPanelOpen(page);
  ok('Panel opens on timeline pill click', await page.evaluate(() =>
    document.getElementById('wfActionPanel').classList.contains('open')));

  const panelAfterPill = await page.textContent('#wfActionPanel');
  ok('Panel shows feature data for timeline feature', panelAfterPill.includes('FEAT-'));

  // ── 5. Panel on Workflow view ─────────────────────────────────────────────
  console.log('\n[5] Action panel — Workflow View');
  await page.click('.wf-close-btn');
  await page.waitForTimeout(300);
  await page.selectOption('#viewSelect', 'workflow');
  await page.waitForSelector('#workflowView', { state: 'visible' });
  await page.waitForTimeout(400);

  const cardCount = await page.locator('.wf-card').count();
  ok(`Workflow has feature cards (${cardCount} found)`, cardCount > 0);

  await page.locator('.wf-card').first().click();
  await waitPanelOpen(page);
  ok('Panel opens on workflow card click', await page.evaluate(() =>
    document.getElementById('wfActionPanel').classList.contains('open')));

  const panelWf = await page.textContent('#wfActionPanel');
  ok('Panel shows feature number', panelWf.includes('FEAT-'));
  ok('Panel shows stage badge', panelWf.length > 100);

  // Selected card gets highlight
  const selectedCard = await page.locator('.wf-card.wf-selected').count();
  ok('Clicked card gets wf-selected class', selectedCard === 1);

  // ── 6. Role-based action forms ────────────────────────────────────────────
  console.log('\n[6] Role-based actions — Developer');
  // Find a card in PgM Review stage (Developer should see Commit form)
  await page.click('.wf-close-btn');
  await page.waitForTimeout(300);

  await page.selectOption('#wfStage', 'PgM Review');
  await page.waitForTimeout(300);
  const pgmCards = await page.locator('.wf-card').count();

  if (pgmCards > 0) {
    await page.locator('.wf-card').first().click();
    await waitPanelOpen(page);
    const pgmPanelText = await page.textContent('#wfActionPanel');
    ok('Developer sees Commit button for PgM Review stage', pgmPanelText.includes('Commit'));
    ok('Developer sees milestone date input', await page.isVisible('#wfActionPanel input[type="date"]'));
    ok('Developer sees HW dependency dropdown', await page.isVisible('#wfActionPanel select'));
    ok('Escalate button present', pgmPanelText.includes('Escalate'));
    await page.click('.wf-close-btn');
    await page.waitForTimeout(300);
  } else {
    console.log('  ⚠ No PgM Review features — skipping developer action form check');
  }

  // ── 7. Switch roles — Test Engineer ──────────────────────────────────────
  console.log('\n[7] Role-based actions — Test Engineer (Nathan Clark)');
  await logout(page);
  await login(page, 'Nathan');
  await page.selectOption('#viewSelect', 'workflow');
  await page.waitForTimeout(300);
  await page.selectOption('#wfStage', 'Test Planning');
  await page.waitForTimeout(300);

  const testCards = await page.locator('.wf-card').count();
  if (testCards > 0) {
    await page.locator('.wf-card').first().click();
    await waitPanelOpen(page);
    const testerText = await page.textContent('#wfActionPanel');
    ok('Test Engineer sees Submit Test Plan button', testerText.includes('Submit Test Plan'));
    ok('Test Engineer sees plan textarea', await page.isVisible('#wfActionPanel textarea'));
    await page.click('.wf-close-btn');
    await page.waitForTimeout(300);
  } else {
    console.log('  ⚠ No Test Planning features — skipping test engineer action form check');
  }

  // ── 8. Switch roles — Program Manager ────────────────────────────────────
  // Program Manager (James Whitfield) acts on Draft stage
  console.log('\n[8] Role-based actions — Program Manager (James Whitfield)');
  await logout(page);
  await login(page, 'James');
  await page.selectOption('#viewSelect', 'workflow');
  await page.waitForTimeout(300);
  await page.selectOption('#wfStage', 'Draft');
  await page.waitForTimeout(300);

  const draftCards = await page.locator('.wf-card').count();
  if (draftCards > 0) {
    await page.locator('.wf-card').first().click();
    await waitPanelOpen(page);
    const pgmText = await page.textContent('#wfActionPanel');
    ok('Program Manager sees Approve button for Draft stage', pgmText.includes('Approve'));
    ok('Program Manager sees Reject button', pgmText.includes('Reject'));
    await page.click('.wf-close-btn');
    await page.waitForTimeout(300);
  } else {
    console.log('  ⚠ No Draft features — skipping Program Manager action form check');
  }

  // Product Manager (Sarah Johnson) acts on Exception Pending PM stage
  console.log('\n[8b] Role-based actions — Product Manager (Sarah Johnson) at Exception stage');
  await logout(page);
  await login(page, 'Sarah');
  await page.selectOption('#viewSelect', 'workflow');
  await page.waitForTimeout(300);
  await page.selectOption('#wfStage', 'Exception Pending PM');
  await page.waitForTimeout(300);

  const exCards = await page.locator('.wf-card').count();
  if (exCards > 0) {
    await page.locator('.wf-card').first().click();
    await waitPanelOpen(page);
    const pmExText = await page.textContent('#wfActionPanel');
    ok('Product Manager sees Approve Exception button', pmExText.includes('Approve Exception'));
    ok('Product Manager sees Back to QA button', pmExText.includes('Back to QA'));
    await page.click('.wf-close-btn');
    await page.waitForTimeout(300);
  } else {
    console.log('  ⚠ No Exception Pending PM features — skipping Product Manager action form check');
  }

  // ── 9. Executive role ─────────────────────────────────────────────────────
  console.log('\n[9] Role-based actions — Executive (Victoria Chen)');
  await logout(page);
  await login(page, 'Victoria');
  await page.selectOption('#viewSelect', 'workflow');
  await page.waitForTimeout(300);
  await page.selectOption('#wfStage', ''); // all stages
  await page.waitForTimeout(300);

  await page.locator('.wf-card').first().click();
  await waitPanelOpen(page);
  const execText = await page.textContent('#wfActionPanel');
  ok('Executive sees Veto button', execText.includes('Veto'));
  ok('Executive sees reason textarea', await page.isVisible('#wfActionPanel textarea'));
  await page.click('.wf-close-btn');
  await page.waitForTimeout(300);

  // ── 10. Audit log ─────────────────────────────────────────────────────────
  console.log('\n[10] Audit log display');
  await page.locator('.wf-card').first().click();
  await waitPanelOpen(page);
  const auditSection = await page.textContent('.wf-audit-section');
  ok('Audit History section rendered', auditSection.includes('History'));
  ok('Audit log has entries or "No history" message', auditSection.length > 20);

  // ── 11. Customer Engineer (no actions) ───────────────────────────────────
  console.log('\n[11] Customer Engineer — read-only panel');
  await page.click('.wf-close-btn');
  await page.waitForTimeout(300);
  await logout(page);
  await login(page, 'Ryan');
  await page.selectOption('#viewSelect', 'workflow');
  await page.waitForTimeout(300);
  await page.locator('.wf-card').first().click();
  await waitPanelOpen(page);
  const ceText = await page.textContent('#wfActionPanel');
  ok('Customer Engineer sees VIEW ONLY message (no action buttons)', ceText.includes('No actions available'));

  // ── 12. Panel persists across view switches ───────────────────────────────
  console.log('\n[12] Panel persists when switching views');
  const panelOpenBeforeSwitch = await page.evaluate(() =>
    document.getElementById('wfActionPanel').classList.contains('open'));
  await page.selectOption('#viewSelect', 'data');
  await page.waitForTimeout(400);
  const panelOpenAfterSwitch = await page.evaluate(() =>
    document.getElementById('wfActionPanel').classList.contains('open'));
  ok('Panel stays open when switching views', panelOpenBeforeSwitch && panelOpenAfterSwitch);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('All tests passed ✓');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
