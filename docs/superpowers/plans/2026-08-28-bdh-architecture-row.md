# BDH Architecture Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone BDH feature showcase on `AI/index.html` with a restrained, responsive architecture row inside the existing Based AI section.

**Architecture:** Keep this as static, semantic page content: one numbered grid row in HTML and page-scoped layout rules in the shared stylesheet. Add a dependency-free Node contract test that checks the durable markup and CSS requirements, then verify the rendered result with Playwright and the `unslop-ui` scanner.

**Tech Stack:** HTML5, CSS, Node.js built-in assertions, Playwright, `unslop-ui` scanner

**Spec:** `docs/superpowers/specs/2026-08-28-bdh-architecture-row-design.md`

## Global Constraints

- Retain the existing rosewood accent, warm neutral tokens, Satoshi type, and JetBrains Mono notation.
- Add only page-local layout rules under `[data-page="ai-home"]` in `src/site.css`.
- Add no gradients, pills, large radii, shadows, glows, icons, decorative SVG, new animation, dependencies, shared tokens, or JavaScript.
- Preserve the BDH facts: `4 cached`, `12 temporal`, `28 x 2 passes`, and `RTX 5080`.
- At widths below `768px`, stack the architecture row in source order without horizontal overflow at 375px.
- Remove the old standalone showcase and delete `AI/index-bdh-prototype.html` after integration.

---

## File Structure

- Modify `AI/index.html`: append semantic BDH row `04` to the Based AI section and remove the standalone showcase.
- Modify `src/site.css`: remove obsolete neuron-map/card rules and add the page-scoped architecture-row desktop/mobile layout.
- Create `test-ai-home-bdh.mjs`: dependency-free static contract test for markup, facts, removed elements, CSS scoping, responsive breakpoint, and prototype cleanup.
- Delete `AI/index-bdh-prototype.html`: remove the throwaway route after its selected design is absorbed.

### Task 1: Integrate the BDH Architecture Row

**Files:**
- Create: `test-ai-home-bdh.mjs`
- Modify: `AI/index.html:361-511`
- Modify: `src/site.css:1526-1580`
- Delete: `AI/index-bdh-prototype.html`

**Interfaces:**
- Consumes: existing `[data-page="ai-home"]` page scope and shared `--accent`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border`, and `--border-strong` CSS tokens.
- Produces: static `.bdh-architecture-row` markup containing `.bdh-row-number`, `.bdh-row-copy`, and `.bdh-specs`; no JavaScript interface.

- [ ] **Step 1: Write the failing static contract test**

Create `test-ai-home-bdh.mjs`:

```js
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
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node test-ai-home-bdh.mjs`

Expected: FAIL in `BDH is a semantic architecture row inside Based AI` because `.bdh-architecture-row` does not exist yet.

- [ ] **Step 3: Replace the standalone showcase with semantic row markup**

In `AI/index.html`, add this as the last child of the existing `.space-y-12` Based AI list, immediately after the current "Scaling Sustainably" row:

```html
<div class="bdh-architecture-row pt-12 border-t border-border-cream">
    <div class="bdh-row-number" aria-hidden="true">04</div>
    <div class="bdh-row-copy">
        <p class="bdh-row-label">Bounded Dynamic Highway</p>
        <h3 class="text-2xl font-semibold mb-3 dark:text-text-warm">BDH neural architecture</h3>
        <p class="text-lg text-rosewood/70 dark:text-text-warm/60 leading-relaxed">
            Saga is moving to a looped network that replaces attention, RoPE, and large KV caches with bounded hidden dynamics. Each block keeps four recent hidden states, mixes them across grouped temporal branches, then repeats the same physical depth.
        </p>
    </div>
    <dl class="bdh-specs">
        <div><dt>state</dt><dd>4 cached</dd></div>
        <div><dt>branches</dt><dd>12 temporal</dd></div>
        <div><dt>depth</dt><dd>28 x 2 passes</dd></div>
        <div><dt>target</dt><dd>RTX 5080</dd></div>
    </dl>
</div>
```

Delete the complete standalone BDH `<section>` that currently follows the Based AI section, from its opening `<section class="py-24 ...">` through its closing `</section>`.

- [ ] **Step 4: Replace obsolete map CSS with the architecture-row layout**

In `src/site.css`, delete the complete rule block from `[data-page="ai-home"] .bdh-neural-card` through `[data-page="ai-home"] .bdh-map-label--core` and insert:

```css
[data-page="ai-home"] .bdh-architecture-row {
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1.35fr) minmax(17.5rem, 0.65fr);
    gap: 2rem;
    align-items: start;
}

[data-page="ai-home"] .bdh-row-number,
[data-page="ai-home"] .bdh-row-label,
[data-page="ai-home"] .bdh-specs {
    font-family: "JetBrains Mono", monospace;
}

[data-page="ai-home"] .bdh-row-number {
    padding-top: 0.25rem;
    color: var(--accent);
    font-size: 1.25rem;
}

[data-page="ai-home"] .bdh-row-label {
    margin-bottom: 0.75rem;
    color: var(--accent);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

[data-page="ai-home"] .bdh-specs {
    margin: 0;
    border-top: 1px solid var(--border-strong);
    font-size: 0.76rem;
}

[data-page="ai-home"] .bdh-specs div {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0.875rem 0;
    border-bottom: 1px solid var(--border);
}

[data-page="ai-home"] .bdh-specs dt {
    color: var(--text-tertiary);
}

[data-page="ai-home"] .bdh-specs dd {
    margin: 0;
    color: var(--text-primary);
    text-align: right;
}

@media (max-width: 768px) {
    [data-page="ai-home"] .bdh-architecture-row {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }

    [data-page="ai-home"] .bdh-row-number {
        padding-top: 0;
    }
}
```

- [ ] **Step 5: Delete the throwaway prototype**

Delete `AI/index-bdh-prototype.html`. Do not retain the variant switcher or prototype-only CSS anywhere in production.

- [ ] **Step 6: Run static tests**

Run:

```powershell
node test-ai-home-bdh.mjs
node test-ai-home-theme.mjs
node test-z-index.mjs
```

Expected: all tests print only `ok - ...` lines and exit with status 0.

- [ ] **Step 7: Run the anti-slop audit**

Run:

```powershell
$env:PYTHONIOENCODING='utf-8'
python "C:\Users\okemo\.agents\skills\unslop-ui\scripts\devibe_scan.py" "AI\index.html"
```

Expected: the previous four `rounded-2xl` BDH findings are absent, with no new finding attributable to the architecture row.

- [ ] **Step 8: Verify desktop and mobile rendering with Playwright**

Start a local server from the repository root:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

In a second shell, run:

```powershell
node -e "const { chromium } = require('playwright'); (async()=>{ const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:1440,height:1000}}); await p.goto('http://127.0.0.1:4173/AI/index.html',{waitUntil:'networkidle'}); const row=p.locator('.bdh-architecture-row'); if(await row.count()!==1) throw new Error('BDH row missing'); if(await p.locator('.bdh-neuron-map').count()) throw new Error('old map remains'); if(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)) throw new Error('desktop overflow'); await p.setViewportSize({width:375,height:812}); await p.reload({waitUntil:'networkidle'}); if(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)) throw new Error('mobile overflow'); console.log('ok - BDH row renders without desktop or mobile overflow'); await b.close(); })().catch(e=>{console.error(e);process.exit(1)})"
```

Expected: `ok - BDH row renders without desktop or mobile overflow`.

- [ ] **Step 9: Inspect the final diff**

Run:

```powershell
git diff --check
git diff -- AI/index.html src/site.css test-ai-home-bdh.mjs AI/index-bdh-prototype.html docs/superpowers/specs/2026-08-28-bdh-architecture-row-design.md docs/superpowers/plans/2026-08-28-bdh-architecture-row.md
```

Expected: `git diff --check` exits 0; the diff contains only the approved BDH integration, focused test, prototype deletion, and its spec/plan.

- [ ] **Step 10: Commit the implementation only if explicitly requested**

Do not commit by default. If the user explicitly requests a commit, inspect `git status`, `git diff`, and `git log --oneline -10`, stage only the six files listed in Step 9, then run:

```powershell
git commit -m "redesign: simplify BDH architecture section"
```
