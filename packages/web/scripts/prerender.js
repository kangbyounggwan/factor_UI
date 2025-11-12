import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = [
  { path: '/privacy', outputFile: 'privacy.html' },
  { path: '/terms', outputFile: 'terms.html' },
  { path: '/refund', outputFile: 'refund.html' },
];

const baseUrl = 'http://localhost:4173'; // Vite preview server
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

      await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for React to render
      await page.waitForTimeout(8000);

      // Wait for specific content
      try {
        await page.waitForSelector('footer', { timeout: 5000 });
      } catch (e) {
        console.warn('Footer not found, continuing anyway...');
      }

      const html = await page.content();
      const outputPath = path.join(distDir, route.outputFile);

      fs.writeFileSync(outputPath, html);
      console.log(`✓ Generated ${route.outputFile}`);

      await page.close();
    } catch (error) {
      console.error(`Error rendering ${route.path}:`, error.message);
    }
  }

  await browser.close();
  console.log('Prerendering complete!');
}

prerender().catch(console.error);
