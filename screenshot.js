const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.goto('http://localhost:5000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'test_render.png' });
  await browser.close();
  console.log('Screenshot saved as test_render.png');
})();
