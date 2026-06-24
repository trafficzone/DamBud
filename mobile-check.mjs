import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const MOBILE = { width: 375, height: 812 };
const BASE   = 'http://localhost:4321';
const OUT    = 'C:/Users/Bartek/AppData/Local/Temp/claude/c--Users-Bartek-projekty-DamBud/e514f6aa-86e5-42be-8adf-1ddacff5e98e/scratchpad';

const browser = await chromium.launch();
const ctx     = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2 });
const page    = await ctx.newPage();

const issues = [];

const check = async (label, fn) => {
  try { await fn(); }
  catch (e) { issues.push(`[${label}] ERROR: ${e.message}`); }
};

// ── HOME PAGE ──────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Overflow check
await check('overflow', async () => {
  const bodyW   = await page.evaluate(() => document.body.scrollWidth);
  const windowW = await page.evaluate(() => window.innerWidth);
  if (bodyW > windowW + 2) issues.push(`OVERFLOW: body scrollWidth ${bodyW}px > viewport ${windowW}px`);
});

// 2. Nav / hamburger
await page.screenshot({ path: `${OUT}/01-nav-mobile.png`, fullPage: false });
const hamburger = await page.$('.nav__hamburger');
if (!hamburger) { issues.push('Brak hamburgera w nawigacji'); }
else {
  const box = await hamburger.boundingBox();
  if (box.width < 36 || box.height < 36) issues.push(`Hamburger za mały: ${box.width}x${box.height}px`);
  await hamburger.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/02-menu-open.png`, fullPage: false });
  const mobileMenu = await page.$('.nav__mobile.open');
  if (!mobileMenu) issues.push('Menu mobilne nie otwiera się po kliknięciu hamburger');
  await hamburger.click();
  await page.waitForTimeout(300);
}

// 3. Hero
await page.screenshot({ path: `${OUT}/03-hero.png`, fullPage: false });
const heroH = await page.evaluate(() => document.querySelector('.hero')?.offsetHeight || 0);
if (heroH < 500) issues.push(`Hero za niski: ${heroH}px`);

// 4. Scroll through all sections
const sections = ['#o-firmie','#uslugi','#dlaczego-my','#realizacje','#opinie','#jak-dzialamy','#kontakt'];
for (const [i, sel] of sections.entries()) {
  await page.evaluate(s => document.querySelector(s)?.scrollIntoView(), sel);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/0${i+4}-section${sel.replace('#','')}.png`, fullPage: false });

  // Check overflow after scroll
  const bw = await page.evaluate(() => document.body.scrollWidth);
  const ww = await page.evaluate(() => window.innerWidth);
  if (bw > ww + 2) issues.push(`OVERFLOW w ${sel}: scrollWidth ${bw}px`);
}

// 5. Buttons min touch target
const btns = await page.$$('a.btn, button:not(.nav__hamburger):not(.portfolio__filter):not(.testimonials__arrow):not(.testimonials__dot)');
for (const btn of btns) {
  const box = await btn.boundingBox().catch(() => null);
  if (box && box.height > 0 && box.height < 40) {
    const txt = await btn.textContent();
    issues.push(`Mały przycisk (${Math.round(box.height)}px): "${txt?.trim().slice(0,30)}"`);
  }
}

// 6. Font size – check for < 12px text (skip truly invisible elements)
const smallText = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('p,span,a,li,label,h1,h2,h3').forEach(el => {
    // offsetWidth/Height is 0 for elements inside display:none ancestors
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden') return;
    const fs = parseFloat(style.fontSize);
    if (fs < 11 && el.textContent.trim().length > 2) {
      results.push(`${el.tagName} "${el.textContent.trim().slice(0,30)}" = ${fs}px`);
    }
  });
  return results.slice(0,5);
});
if (smallText.length) issues.push('Małe czcionki (<11px): ' + smallText.join(' | '));

// ── /OFERTA PAGE ────────────────────────────────────────────────
await page.goto(`${BASE}/oferta`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/10-oferta-hero.png`, fullPage: false });

const ofertaOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 2);
if (ofertaOverflow) issues.push('OVERFLOW na /oferta');

// Scroll through a few service sections
await page.evaluate(() => window.scrollBy(0, 1200));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/11-oferta-services.png`, fullPage: false });

await page.evaluate(() => window.scrollBy(0, 1200));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/12-oferta-services2.png`, fullPage: false });

await browser.close();

// Summary
console.log('\n=== MOBILE CHECK RESULTS ===');
if (issues.length === 0) {
  console.log('✅ Brak wykrytych problemów mobilnych');
} else {
  console.log(`⚠️  Znaleziono ${issues.length} problemów:\n`);
  issues.forEach((p, i) => console.log(`  ${i+1}. ${p}`));
}
console.log('\nScreenshoty zapisane w:', OUT);
