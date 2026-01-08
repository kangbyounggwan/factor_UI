import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = [
  { path: '/', outputFile: 'index.html' },
  { path: '/subscription', outputFile: 'subscription.html' },
  { path: '/supported-printers', outputFile: 'supported-printers.html' },
  { path: '/ai-chat', outputFile: 'ai-chat.html' },
  { path: '/create', outputFile: 'create.html' },
];

// 설정
const distDir = path.join(__dirname, '../dist');
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// 간단한 정적 파일 서버
function createStaticServer(distPath, port) {
  return new Promise((resolve, reject) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    const server = createServer((req, res) => {
      let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);

      // SPA 라우팅: 파일이 없으면 index.html 반환
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'text/html';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please stop other services or use a different port.`);
      }
      reject(err);
    });

    server.listen(port, () => {
      console.log(`📦 Static server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function prerender() {
  console.log('🚀 Starting prerendering process...\n');

  // dist 폴더 확인
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist folder not found. Run "npm run build" first.');
    process.exit(1);
  }

  // 정적 서버 시작
  let server;
  try {
    server = await createStaticServer(distDir, PORT);
  } catch (err) {
    console.error('❌ Failed to start static server:', err.message);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let successCount = 0;
  let failCount = 0;

  for (const route of routes) {
    try {
      console.log(`  🔄 Rendering: ${route.path}`);
      const page = await browser.newPage();

      // Block unnecessary requests to speed up rendering
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url();
        // Block images, fonts, Google Fonts, and analytics to speed up
        if (['image', 'font', 'media'].includes(resourceType) ||
            url.includes('fonts.googleapis.com') ||
            url.includes('fonts.gstatic.com') ||
            url.includes('clarity.ms')) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // For SPA, first load the base URL then navigate using client-side routing
      await page.goto(BASE_URL, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Wait for React to hydrate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // If not root, navigate using client-side routing
      if (route.path !== '/') {
        await page.evaluate((routePath) => {
          window.history.pushState({}, '', routePath);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, route.path);

        // Wait for route change and content to render
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Wait for main content to render
      try {
        await page.waitForSelector('h1, main, .container, article', { timeout: 10000 });
      } catch (e) {
        console.warn(`     ⚠️ Content selector not found for ${route.path}, using timeout...`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      const html = await page.content();

      // Get the rendered HTML
      const outputPath = path.join(distDir, route.outputFile);
      fs.writeFileSync(outputPath, html);
      console.log(`  ✅ Saved: ${route.outputFile}`);
      successCount++;

      await page.close();
    } catch (error) {
      console.error(`  ❌ Error rendering ${route.path}:`, error.message);
      failCount++;
    }
  }

  await browser.close();
  server.close();

  console.log(`\n✨ Prerendering complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
}

prerender().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
