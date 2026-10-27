---
name: playwright-and-qa-automation
description: >-
  End-to-end browser automation, Playwright testing, responsive viewport validation, and QA verification.
  Use this skill when creating automated E2E tests, verifying user flows in real browsers,
  checking console/network errors, testing multi-device layouts (desktop/tablet/mobile), or running regression suites.
---

# Playwright & QA Automation Runbook

This skill provides testing protocols and Playwright automation patterns for verifying web applications in real browser environments.

---

## 1. The 13-Step Production QA Protocol

When testing a feature or application, execute:

1. **Build the Application**: `npm run build` to verify zero build errors.
2. **Start Dev/Staging Server**: Launch backend and frontend instances.
3. **Open Real Browser Session**: Navigate to target page.
4. **Console Error Audit**: Assert zero unhandled exceptions, React warnings, or hydration errors in console.
5. **Network Failure Inspection**: Verify all API requests return `200/201/204` with no unexpected `404/500` calls.
6. **Desktop Viewport Verification**: Test at 1920x1080 and 1440x900.
7. **Tablet Viewport Verification**: Test at 768x1024 (iPad portrait/landscape).
8. **Mobile Viewport Verification**: Test at 375x667 (iPhone SE) and 390x844 (iPhone 14).
9. **Authentication Flow Verification**: Test login, session persistence, role-based route guards, and logout.
10. **Core User Journey Validation**: Test cart checkout, form submission, filter interactions, and dynamic state updates.
11. **Negative / Edge Case Testing**: Test invalid inputs, network disconnects, rate limits, and empty states.
12. **Bug Isolation & Targeted Fix**: Resolve any regressions found during testing.
13. **Final Acceptance Report**: Document test artifacts, screenshots, and pass/fail logs.

---

## 2. Robust Playwright Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('Order Checkout Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser Console Error: ${msg.text()}`);
      }
    });
  });

  test('completes end-to-end product customization and cart flow', async ({ page }) => {
    await page.goto('/shop');
    
    // Select product
    const productCard = page.getByRole('article').filter({ hasText: 'Signature Truffle Cake' });
    await expect(productCard).toBeVisible();
    await productCard.click();

    // Select flavor & delivery date
    await page.getByLabel('Flavors').selectOption('dark-chocolate');
    await page.getByPlaceholder('Special Message on Cake').fill('Happy Birthday Alex!');
    
    // Add to Cart
    await page.getByRole('button', { name: /Add to Cart/i }).click();

    // Verify Cart Drawer / Modal
    const cartDrawer = page.getByRole('dialog', { name: /Shopping Cart/i });
    await expect(cartDrawer).toBeVisible();
    await expect(cartDrawer).toContainText('Signature Truffle Cake');
    await expect(cartDrawer).toContainText('Happy Birthday Alex!');
  });
});
```

---

## 3. Multi-Device Viewport Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Desktop Safari', use: { ...devices['Desktop Safari'] } },
    { name: 'Tablet iPad', use: { ...devices['iPad Pro 11'] } },
    { name: 'Mobile iPhone', use: { ...devices['iPhone 14'] } },
    { name: 'Mobile Android', use: { ...devices['Pixel 7'] } },
  ],
});
```
