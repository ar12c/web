import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync(new URL('./AI/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./src/site.css', import.meta.url), 'utf8');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (error) {
    console.error('not ok - ' + name);
    throw error;
  }
}

test('BDH is a semantic architecture row inside Based AI', () => {
  const basedStart = html.indexOf('<!-- Based AI: Core Pillars');
  const basedEnd = html.indexOf('</section>', basedStart);
  const basedSection = html.slice(basedStart, basedEnd);

  assert.match(basedSection, /class="[^"]*bdh-architecture-row[^"]*"/);
  assert.match(basedSection, /class="bdh-row-number"[^>]*>04</);
  assert.match(basedSection, /<h3[^>]*>BDH neural architecture<\/h3>/);
  assert.match(basedSection, /<dl class="bdh-specs">/);
});

test('BDH row retains all approved architecture facts', () => {
  for (const fact of ['4 cached', '12 temporal', '28 x 2 passes', 'RTX 5080']) {
    assert.ok(html.includes(fact), `missing BDH fact: ${fact}`);
  }
});

test('old BDH showcase is removed', () => {
  for (const obsolete of [
    'bdh-neural-card',
    'bdh-neuron-map',
    'bdh-map-neuron',
    'Small memory, repeated thought',
    '4 states cached',
  ]) {
    assert.ok(!html.includes(obsolete), `obsolete showcase remains: ${obsolete}`);
    assert.ok(!css.includes(obsolete), `obsolete CSS remains: ${obsolete}`);
  }
});

test('BDH layout is page-scoped and stacks at the approved breakpoint', () => {
  assert.match(css, /\[data-page="ai-home"\] \.bdh-architecture-row\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\[data-page="ai-home"\] \.bdh-architecture-row\s*\{[^}]*grid-template-columns:\s*1fr;/);
});

test('throwaway BDH prototype has been deleted', () => {
  assert.equal(existsSync(new URL('./AI/index-bdh-prototype.html', import.meta.url)), false);
});
