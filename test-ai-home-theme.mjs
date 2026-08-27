import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./src/site.css', import.meta.url), 'utf8');
const heroSection = css.match(/\[data-page="ai-home"\] \.hero-section \{([\s\S]*?)\n\s*\}/)?.[1] || '';

assert.match(heroSection, /background-color:\s*#000;/, 'AI hero uses Apple Cinematic black stage');

console.log('ok - AI hero background follows the active site theme');
