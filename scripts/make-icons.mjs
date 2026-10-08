// PWA アイコン（PNG）を SVG から生成する: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1b2a4a"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <path d="M136 120h176a64 64 0 0164 64v208H200a64 64 0 01-64-64z" fill="#ffffff"/>
    <path d="M176 176h144M176 224h144M176 272h96" stroke="#1b2a4a" stroke-width="18" stroke-linecap="round"/>
    <path d="M300 300l40 -56 40 56" fill="none" stroke="#b08d3c" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M340 252v100" stroke="#b08d3c" stroke-width="22" stroke-linecap="round"/>
  </g>
</svg>`;

const targets = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/icon-maskable-512.png", 512, 64],
  ["public/apple-touch-icon.png", 180, 24],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [file, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote", file);
}
await browser.close();
