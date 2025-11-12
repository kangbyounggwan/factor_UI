import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = [
  { path: '/', outputFile: 'index.html' },
  { path: '/privacy', outputFile: 'privacy.html' },
  { path: '/terms', outputFile: 'terms.html' },
  { path: '/refund', outputFile: 'refund.html' },
  { path: '/subscription', outputFile: 'subscription.html' },
  { path: '/supported-printers', outputFile: 'supported-printers.html' },
  { path: '/payment/checkout', outputFile: 'payment-checkout.html' },
  { path: '/payment/success', outputFile: 'payment-success.html' },
  { path: '/payment/fail', outputFile: 'payment-fail.html' },
];

// Read port from command line argument or use default
const port = process.env.PREVIEW_PORT || '4173';
const baseUrl = `http://localhost:${port}`;
const distDir = path.join(__dirname, '../dist');

async function prerender() {
  console.log('Starting prerendering...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const route of routes) {
    try {
      console.log(`Rendering ${route.path}...`);
      const page = await browser.newPage();

      // Block unnecessary requests to speed up rendering
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        // Block images, fonts, and analytics to speed up
        if (['image', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate to page
      await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      // Wait for main content to render
      try {
        // Wait for either h1 (title) or main content area
        await page.waitForSelector('h1, main, .container', { timeout: 10000 });
      } catch (e) {
        console.warn('Main content selector not found, using timeout...');
      }

      // Additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get the rendered HTML
      const html = await page.content();
      const outputPath = path.join(distDir, route.outputFile);

      fs.writeFileSync(outputPath, html);
      console.log(`✓ Generated ${route.outputFile}`);

      await page.close();
    } catch (error) {
      console.error(`✗ Error rendering ${route.path}:`, error.message);
      // Continue with next route even if this one fails
    }
  }

  await browser.close();
  console.log('Prerendering complete!');
}

prerender().catch(console.error);
