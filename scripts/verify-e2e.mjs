import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 25.158, longitude: 93.01 }, // Haflong coordinates
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('--- Step 1: Mobile App Load (Online) ---');
    await page.goto('http://localhost:3001/');
    // Login
    await page.fill('#auth-email', 'citizen@test.com');
    await page.fill('#auth-pass', 'pass1234');
    await page.click('#auth-submit');
    
    // Wait for the map and status board
    await page.waitForSelector('#map-container');
    console.log('✅ Mobile app loaded and logged in.');

    // Give it a second to load the tiles
    await page.waitForTimeout(2000);

    console.log('--- Step 2: Go Offline & Submit Report ---');
    await context.setOffline(true);
    console.log('✅ Browser set to Offline mode.');
    
    // Fill report
    await page.selectOption('#report-type', 'landslide');
    await page.fill('#report-severity', '5');
    await page.fill('#report-desc', 'Automated E2E Offline Test');
    await page.click('#report-submit');

    // Wait for pending badge
    await page.waitForSelector('#pending-badge', { state: 'visible' });
    const badgeText = await page.locator('#pending-badge').textContent();
    console.log(`✅ Report submitted offline. UI Badge: "${badgeText.trim()}"`);

    console.log('--- Step 3: Go Online & Sync ---');
    await context.setOffline(false);
    console.log('✅ Browser set to Online mode.');
    
    // Wait for badge to disappear
    await page.waitForSelector('#pending-badge', { state: 'hidden', timeout: 15000 });
    console.log('✅ Outbox drained successfully.');

    console.log('--- Step 4: Web Dashboard Verification ---');
    const webPage = await context.newPage();
    await webPage.goto('http://localhost:3000/login');
    
    // Login to control room
    await webPage.fill('input[type="email"]', 'control-room@test.com');
    await webPage.fill('input[type="password"]', 'pass1234');
    await webPage.click('button[type="submit"]');

    await webPage.waitForURL('http://localhost:3000/');
    console.log('✅ Web dashboard loaded.');
    
    // Wait for feed to update
    await webPage.waitForTimeout(3000);
    const feedText = await webPage.locator('text=Automated E2E Offline Test').first().textContent();
    console.log(`✅ Report arrived in Web feed: "${feedText.trim()}"`);

    console.log('--- Step 5: Continuity Page Verification ---');
    await webPage.goto('http://localhost:3000/continuity');
    await webPage.waitForSelector('text=Cachar (Silchar)');
    
    const silcharGap = await webPage.locator('text=Cachar (Silchar)').evaluate(node => node.closest('tr').innerText);
    console.log(`✅ Continuity Row: ${silcharGap}`);
    
    console.log('🎉 E2E Verification Complete.');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    await browser.close();
  }
})();
