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

  // Create SPA fallback structure for preview server
  // Copy index.html to route directories so /privacy loads as /privacy/index.html
  const spaRoutes = ['/privacy', '/terms', '/refund', '/subscription', '/supported-printers'];
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

      // Navigate to page
      const isLegalPage = ['/privacy', '/terms', '/refund'].includes(route.path);
      
      let html;
      if (isLegalPage) {
        // For legal pages, navigate and immediately capture
        await page.goto(`${baseUrl}${route.path}`, {
          waitUntil: 'networkidle0',
          timeout: 30000
        }).catch(async (e) => {
          console.warn(`Navigation slow for ${route.path}, will capture after delay...`);
        });

        // Give React time to hydrate regardless of navigation status
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Wait for main content
        try {
          await page.waitForSelector('main, article, .content, h1', { timeout: 5000 });
        } catch (e) {
          console.warn('Content selector not found, using delay...');
        }

        html = await page.content().catch(() => '<html><body>Failed to capture</body></html>');
        
      } else {
        await page.goto(`${baseUrl}${route.path}`, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        
        // Wait for main content to render
        try {
          await page.waitForSelector('h1, main, .container', { timeout: 10000 });
        } catch (e) {
          console.warn('Main content selector not found, using timeout...');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        html = await page.content();
      }

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
