#!/usr/bin/env node
/**
 * Record the demo player.html as an animated WebP using Puppeteer + img2webp.
 *
 * Usage:
 *   node scripts/record_demo.js              # default: docs/demo.webp
 *   node scripts/record_demo.js out.webp     # custom output path
 *
 * Requirements:
 *   npm install --save-dev puppeteer
 *   img2webp on PATH (brew install webp)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execFileSync, execSync } = require('child_process');
const os = require('os');

const VIEWPORT = { width: 1440, height: 720 };
const FPS = 10;
const FRAME_INTERVAL = 1000 / FPS;
const DURATION_MS = 24000;

(async () => {
    const outFile = path.resolve(
        process.argv[2] || path.join(__dirname, '..', 'docs', 'demo.webp')
    );

    // Verify img2webp is available
    try {
        execSync('which img2webp', { stdio: 'ignore' });
    } catch {
        console.error('img2webp not found. Install with: brew install webp');
        process.exit(1);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-demo-'));

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    const htmlPath = path.resolve(__dirname, '..', 'fixtures', 'demo', 'player.html');
    console.log('Loading', htmlPath);
    await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded' });

    const frameCount = Math.ceil(DURATION_MS / FRAME_INTERVAL);
    console.log(`Capturing ${frameCount} frames at ${FPS} fps...`);

    const framePaths = [];
    for (let i = 0; i < frameCount; i++) {
        const fp = path.join(tmpDir, `frame-${String(i).padStart(5, '0')}.png`);
        await page.screenshot({ path: fp, type: 'png' });
        framePaths.push(fp);
        if (i % 20 === 0) process.stdout.write(`  frame ${i}/${frameCount}\r`);
        await new Promise(r => setTimeout(r, FRAME_INTERVAL));
    }
    console.log(`  Captured ${frameCount} frames.`);

    await browser.close();

    // Assemble animated WebP using img2webp
    console.log('Encoding animated WebP...');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    const delay = Math.round(1000 / FPS);
    // img2webp -loop 0 -d <delay> frame1.png -d <delay> frame2.png ... -o out.webp
    const args = ['-loop', '0'];
    for (const fp of framePaths) {
        args.push('-d', String(delay), fp);
    }
    args.push('-o', outFile);

    execFileSync('img2webp', args, { stdio: 'inherit' });

    // Clean up temp frames
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const stat = fs.statSync(outFile);
    console.log(`Written: ${outFile} (${(stat.size / 1024).toFixed(0)} KB)`);
})();
