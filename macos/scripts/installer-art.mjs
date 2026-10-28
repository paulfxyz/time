import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('build', { recursive:true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="440" viewBox="0 0 660 440">
<rect width="660" height="440" fill="#f1f3f6"/>
<text x="330" y="60" text-anchor="middle" fill="#202b3b" font-family="Helvetica,Arial,sans-serif" font-size="28" font-weight="600">Time, made for your Mac.</text>
<text x="330" y="92" text-anchor="middle" fill="#5a6676" font-family="Helvetica,Arial,sans-serif" font-size="14">Drag Timescreen to Applications. Make yourself a moment.</text>
<path d="M292 220h76m-15-15 15 15-15 15" stroke="#8a98aa" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="330" y="424" text-anchor="middle" fill="#657285" font-family="Helvetica,Arial,sans-serif" font-size="12">28 styles · 60 palettes · One planet</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile('build/installer-background.png');
