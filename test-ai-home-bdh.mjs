import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync(new URL('./AI/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./src/site.css', import.meta.url), 'utf8');

function extractBlock(source, startPattern, label) {
  const match = startPattern.exec(source);
  assert.ok(match, `missing ${label}`);

  const openBrace = source.indexOf('{', match.index);
  assert.notEqual(openBrace, -1, `missing opening brace for ${label}`);

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openBrace + 1, index);
  }

  assert.fail(`missing closing brace for ${label}`);
}

function extractBlocks(source, startPattern, label) {
  const blocks = [];
  let offset = 0;

  while (offset < source.length) {
    const remainder = source.slice(offset);
    const match = startPattern.exec(remainder);
    if (!match) break;

    const start = offset + match.index;
    blocks.push(extractBlock(source.slice(start), startPattern, label));
    offset = start + match[0].length;
  }

  assert.ok(blocks.length > 0, `missing ${label}`);
  return blocks;
}

function extractBdhRow(section) {
  const rowStart = section.search(/<div class="[^"]*bdh-architecture-row[^"]*">/);
  assert.notEqual(rowStart, -1, 'missing BDH architecture row');

  const specsEnd = section.indexOf('</dl>', rowStart);
  assert.notEqual(specsEnd, -1, 'missing BDH specification list');
  return section.slice(rowStart, specsEnd + '</dl>'.length);
}

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
  const basedStart = html.indexOf('<!-- Based AI: Core Pillars');
  const basedEnd = html.indexOf('</section>', basedStart);
  const bdhRow = extractBdhRow(html.slice(basedStart, basedEnd));

  for (const fact of ['4 cached', '12 temporal', '28 x 2 passes', 'RTX 5080']) {
    assert.ok(bdhRow.includes(fact), `missing BDH row fact: ${fact}`);
  }
});

test('old BDH showcase is removed', () => {
  for (const obsolete of [
    'bdh-neural-card',
    'bdh-neuron-map',
    'bdh-map-ring',
    'bdh-map-link',
    'bdh-map-neuron',
    'bdh-map-label',
    'Small memory, repeated thought',
    '4 states cached',
  ]) {
    assert.ok(!html.includes(obsolete), `obsolete showcase remains: ${obsolete}`);
    assert.ok(!css.includes(obsolete), `obsolete CSS remains: ${obsolete}`);
  }
});

test('BDH layout is page-scoped and stacks at the approved breakpoint', () => {
  assert.match(css, /\[data-page="ai-home"\] \.bdh-architecture-row\s*\{[^}]*display:\s*grid;/s);
  const mobileBlocks = extractBlocks(
    css,
    /@media\s*\(max-width:\s*768px\)\s*\{/,
    '768px media blocks',
  );
  assert.ok(
    mobileBlocks.some((block) => /\[data-page="ai-home"\] \.bdh-architecture-row\s*\{[^}]*grid-template-columns:\s*1fr;/s.test(block)),
    'BDH architecture row does not stack inside a 768px media block',
  );
});

test('throwaway BDH prototype has been deleted', () => {
  assert.equal(existsSync(new URL('./AI/index-bdh-prototype.html', import.meta.url)), false);
});
