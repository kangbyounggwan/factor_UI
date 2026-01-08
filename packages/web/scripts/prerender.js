import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = [
  { path: '/', outputFile: 'index.html' },
  { path: '/subscription', outputFile: 'subscription.html' },
  { path: '/supported-printers', outputFile: 'supported-printers.html' },
  { path: '/ai-chat', outputFile: 'ai-chat.html' },
  { path: '/create', outputFile: 'create.html' },
];

// Read port from command line argument or use default
const port = process.env.PREVIEW_PORT || '4173';
const baseUrl = `http://localhost:${port}`;
const distDir = path.join(__dirname, '../dist');

async function prerender() {
  console.log('Starting prerendering...');

  // Create SPA fallback structure for preview server
  // Copy index.html to route directories so /privacy loads as /privacy/index.html
  const spaRoutes = ['/privacy', '/terms', '/refund', '/subscription', '/supported-printers', '/ai-chat', '/create'];
  const indexPath = path.join(distDir, 'index.html');

  if (fs.existsSync(indexPath)) {
    for (const route of spaRoutes) {
      const routeDir = path.join(distDir, route.substring(1)); // Remove leading /
      if (!fs.existsSync(routeDir)) {
        fs.mkdirSync(routeDir, { recursive: true });
      }
      fs.copyFileSync(indexPath, path.join(routeDir, 'index.html'));
    }
    console.log('Created SPA fallback structure for preview server');
  }

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
        const url = req.url();
        // Block images, fonts, Google Fonts, and analytics to speed up
        if (['image', 'font', 'media'].includes(resourceType) || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // For SPA, first load the base URL then navigate using client-side routing
      await page.goto(baseUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Wait for React to hydrate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // If not root, navigate using client-side routing
      if (route.path !== '/') {
        await page.evaluate((path) => {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, route.path);

        // Wait for route change and content to render
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Wait for main content to render
      try {
        await page.waitForSelector('h1, main, .container, article', { timeout: 10000 });
      } catch (e) {
        console.warn('Main content selector not found, using timeout...');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      const html = await page.content();

      // Get the rendered HTML
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
