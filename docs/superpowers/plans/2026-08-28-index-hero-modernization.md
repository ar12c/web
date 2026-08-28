# Landing Page (index.html) Hero Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `index.html`'s hero a scroll-pinned, ambient-glow, parallax moment; move its scroll reveals onto the shared `src/motion.js` system; and give the "Words I build by" quotes a full-bleed typographic treatment — all within the existing flat design system and cream/rose color identity.

**Architecture:** Pure CSS + one small page-local vanilla JS block, no new dependencies. New color tokens are additive in `src/site.css` §2. All new page-local CSS lives in the existing `[data-page="home"]` section of `src/site.css` (search for `PAGE: HOME`). The hero's scroll effects are driven by one `requestAnimationFrame` loop that writes a single CSS custom property (`--scroll-progress`) consumed by CSS `calc()` — JS never touches `style.transform` directly, so the CSS is the single source of truth for the visual math and degrades to its default (no transform) if the JS guard skips.

**Tech Stack:** Vanilla JS (no framework), Tailwind CDN (layout utilities only — this page does not use the compiled `src/output.css` pipeline), `src/site.css` (hand-written styles), `src/motion.js` (existing shared reveal system).

**Spec:** `docs/superpowers/specs/2026-08-28-index-hero-modernization-design.md`

## Global Constraints

- Scope is `index.html` and `src/site.css` only. No other HTML page changes.
- No shadows/gradients/inset highlights on resting controls (flat design invariant). New color effects (the hero glow) must read as decorative, same bucket as existing star fields/conic borders — not applied to any button/input/card.
- Every new JS-driven animation must bail under `prefers-reduced-motion: reduce` AND `navigator.webdriver` — content must render fully visible/static when either is true, never hidden.
- Reuse existing motion tokens (`--ease-smooth`, `--ease-soft`, `--dur-1..4`, `--stagger`, `--rise`) — do not invent new ones.
- Keep current page structure (hero → Selected work → Words I build by → footer) and all existing content/copy verbatim.
- Keep the cream (`--bg` `#f5f4ed` light) / dusty-rose (`--accent` `#c96478` light) identity — new tokens must be derived from `--accent`, not new hues.
- No automated test suite exists for `index.html`. Every task's verification step is manual/visual (open in a real browser) — this is called out explicitly per task rather than pretending otherwise.
- Entrance animations using `transform` must use `animation-fill-mode: backwards`, never `both`/`forwards` (site-wide rule — a forwards fill permanently pins `transform` and kills any later hover/press transform on that element).

---

### Task 1: Add `--accent-deep` and `--hero-glow` color tokens

**Files:**
- Modify: `src/site.css` (light token block, immediately after the `--accent-light` line in the `:root {` block around line 86; dark token block, immediately after the `--accent-light` line in the `.dark {` block around line 125)

**Interfaces:**
- Consumes: existing `--accent` token (light: `#c96478`, dark: `#d97790`)
- Produces: `--accent-deep` (a darker rose, opaque) and `--hero-glow` (a low-alpha radial tint of `--accent`) — both consumed by Task 4's hero glow gradient.

- [ ] **Step 1: Read the current token blocks to confirm exact surrounding lines**

Read `src/site.css` around lines 76–136 (the light `:root {}` and `.dark {}` blocks) to get the exact current text for the `Edit` tool's `old_string` match — line numbers may have shifted slightly since this plan was written.

- [ ] **Step 2: Add the light-mode tokens**

In the light token block (the one starting `/* ── Light tokens ─── */` / `::root {`), immediately after this existing line:

```css
  --accent-light:    #d97790;
```

insert:

```css
  --accent-deep:     color-mix(in srgb, var(--accent), black 25%);
  --hero-glow:       color-mix(in srgb, var(--accent) 8%, transparent);
```

- [ ] **Step 3: Add the dark-mode tokens**

In the dark token block (`.dark {`), immediately after this existing line:

```css
  --accent-light:    #c96478;
```

insert:

```css
  --accent-deep:     color-mix(in srgb, var(--accent), black 30%);
  --hero-glow:       color-mix(in srgb, var(--accent) 10%, transparent);
```

(Dark gets a slightly deeper mix on `--accent-deep` and slightly higher alpha on `--hero-glow` — the dark background needs a touch more intensity for the glow to read at all, per the file's existing pattern of dark-mode values being tuned separately rather than inherited.)

- [ ] **Step 4: Verify — grep for the new tokens**

Run: `grep -n "accent-deep\|hero-glow" src/site.css`
Expected: 4 matches (2 in light block, 2 in dark block), each with a valid `color-mix(...)` value, no typos.

- [ ] **Step 5: Verify — visually confirm the tokens resolve**

Open `index.html` in a browser, open DevTools console, run:
```js
getComputedStyle(document.documentElement).getPropertyValue('--hero-glow')
getComputedStyle(document.documentElement).getPropertyValue('--accent-deep')
```
Expected: both return non-empty color values (not empty strings). Toggle dark mode (site's theme toggle) and re-check — values should change to the dark-mode variants.

- [ ] **Step 6: Commit**

```bash
git add src/site.css
git commit -m "feat: add --accent-deep and --hero-glow tokens for hero glow effect"
```

---

### Task 2: Swap index.html's reveal mechanism to the shared motion.js system

**Files:**
- Modify: `index.html` (remove inline reveal script, add `src/motion.js` script tag, change `class="reveal"` → `data-reveal` on the work section's 3 rows and the footer)
- Modify: `src/site.css` (remove the now-dead `[data-page="home"] .reveal` / `.reveal.in` rules and their leftover reference inside the reduced-motion media block, in the `PAGE: HOME` section)

**Interfaces:**
- Consumes: `src/motion.js`'s existing `[data-reveal]` / `data-reveal-delay` contract (already used on `AI/index.html`, `search/index.html`) and the global `html.motion-ready [data-reveal]` / `.revealed` CSS rules already in `src/site.css` (lines ~721–730) — no changes needed to either, this task only wires `index.html`'s markup into them.
- Produces: nothing new consumed by later tasks (Task 3 adds its own `data-reveal` to the quotes section independently).

- [ ] **Step 1: Add the motion.js script tag**

In `index.html`, find this existing line (near the bottom, before the `NAV_CONFIG` script):

```html
  <script>
    // ── Scroll reveal ──────────────────────────────────────────
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  </script>
```

Replace the entire block above with:

```html
  <script src="src/motion.js"></script>
```

- [ ] **Step 2: Convert the "Selected work" section to per-row `data-reveal`**

Find this line:

```html
    <section id="work" class="py-20 md:py-28 reveal">
```

Change to (drop `reveal`, the section itself no longer animates — only its rows do):

```html
    <section id="work" class="py-20 md:py-28">
```

Then add `data-reveal` + a staggered `data-reveal-delay` to each of the 3 `.work-row` elements. Find:

```html
      <a href="/AI/index.html" class="work-row">
```
→
```html
      <a href="/AI/index.html" class="work-row" data-reveal data-reveal-delay="0">
```

Find:
```html
      <a href="/word/index.html" class="work-row">
```
→
```html
      <a href="/word/index.html" class="work-row" data-reveal data-reveal-delay="45">
```

Find:
```html
      <div class="work-row is-soon"
        style="border-bottom:1px solid var(--border);">
```
→
```html
      <div class="work-row is-soon" data-reveal data-reveal-delay="90"
        style="border-bottom:1px solid var(--border);">
```

(Delays of 0/45/90ms match the site's existing `--stagger: 45ms` token value, applied by hand since `data-reveal-delay` takes a literal ms number, not a CSS var.)

- [ ] **Step 3: Convert the footer to `data-reveal`**

Find:

```html
    <footer class="py-12 border-t border-border-cream">
```

Change to:

```html
    <footer class="py-12 border-t border-border-cream" data-reveal>
```

- [ ] **Step 4: Remove the now-dead `.reveal` CSS in the HOME page section**

In `src/site.css`, in the `PAGE: HOME` section, find:

```css
    /* ── Reveal ────────────────────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(22px); }
      to { opacity: 1; transform: translateY(0); }
    }

    [data-page="home"] .reveal {
      opacity: 0;
      transform: translateY(22px);
      transition: opacity var(--dur-4) var(--ease-smooth), transform var(--dur-4) var(--ease-smooth);
    }

    [data-page="home"] .reveal.in { opacity: 1; transform: translateY(0); }
```

Replace with (keep the `fadeUp` keyframe — `.load` still uses it below — only remove the `.reveal`/`.reveal.in` rules):

```css
    /* ── Reveal ────────────────────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(22px); }
      to { opacity: 1; transform: translateY(0); }
    }
```

Then find, inside the `@media (prefers-reduced-motion: reduce)` block a few lines below:

```css
      [data-page="home"] .reveal { opacity: 1; transform: none; }
```

Delete that line (the global `html.motion-ready [data-reveal]` reduced-motion rule already covers the new markup — this page-local leftover is dead weight).

- [ ] **Step 5: Verify — grep for leftover `.reveal` references**

Run: `grep -n "reveal" index.html src/site.css`
Expected in `index.html`: only `data-reveal`/`data-reveal-delay` attributes, no `class="reveal"` or `class="... reveal"` left, no old `IntersectionObserver` script.
Expected in `src/site.css`: no `[data-page="home"] .reveal` rules remain (the global `[data-reveal]` rules at the top of the file, unrelated to this page section, are expected and untouched).

- [ ] **Step 6: Verify — manual browser check**

Open `index.html`, scroll down. Expected: the 3 work rows rise+fade in with a visible stagger (not simultaneous), the footer rises+fades in. Open DevTools, confirm `<html>` has class `motion-ready`. Emulate `prefers-reduced-motion: reduce` (DevTools rendering tab) and reload — expected: all rows/footer are immediately visible with no animation, nothing is stuck hidden.

- [ ] **Step 7: Commit**

```bash
git add index.html src/site.css
git commit -m "refactor: swap index.html's reveal script for the shared motion.js system"
```

---

### Task 3: Full-bleed typography for "Words I build by"

**Files:**
- Modify: `index.html` (restructure the quotes section markup)
- Modify: `src/site.css` (`PAGE: HOME` section — new `.quote-big` rules, replacing the grid-column quote styling)

**Interfaces:**
- Consumes: `src/motion.js`'s `[data-reveal]` contract (from Task 2 — motion.js is already loaded by this point).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Restructure the quotes section markup**

Find this entire block in `index.html`:

```html
    <!-- ── Words ───────────────────────────────────────────────── -->
    <section class="py-20 md:py-28 border-t border-border-cream reveal">
      <h2 class="eyebrow mb-12" style="font-size:0.72rem;">Words I build by</h2>
      <div class="grid md:grid-cols-2 gap-12 md:gap-16">
        <figure>
          <blockquote class="serif-text text-2xl md:text-3xl text-text-warm leading-snug">
            "What I cannot create, I do not understand."
          </blockquote>
          <figcaption class="eyebrow mt-5" style="font-size:0.68rem;">— Richard Feynman</figcaption>
        </figure>
        <figure class="md:border-l border-border-cream md:pl-16">
          <blockquote class="serif-text text-2xl md:text-3xl text-text-warm leading-snug">
            "Talk is cheap. Show me the code."
          </blockquote>
          <figcaption class="eyebrow mt-5" style="font-size:0.68rem;">— Linus Torvalds</figcaption>
        </figure>
      </div>
    </section>
```

Replace with:

```html
    <!-- ── Words ───────────────────────────────────────────────── -->
    <section class="py-20 md:py-28 border-t border-border-cream">
      <h2 class="eyebrow mb-12" style="font-size:0.72rem;">Words I build by</h2>
      <div class="flex flex-col gap-14 md:gap-20">
        <figure data-reveal data-reveal-delay="0">
          <blockquote class="serif-text quote-big">
            "What I cannot create, I do not understand."
          </blockquote>
          <figcaption class="eyebrow mt-5" style="font-size:0.68rem;">— Richard Feynman</figcaption>
        </figure>
        <figure data-reveal data-reveal-delay="90">
          <blockquote class="serif-text quote-big">
            "Talk is cheap. Show me the code."
          </blockquote>
          <figcaption class="eyebrow mt-5" style="font-size:0.68rem;">— Linus Torvalds</figcaption>
        </figure>
      </div>
    </section>
```

(The `md:border-l` divider is dropped since the quotes are no longer side-by-side; the larger `gap-14 md:gap-20` vertical spacing plus the size jump from `.quote-big` is what now separates them visually.)

- [ ] **Step 2: Add the `.quote-big` CSS rule**

In `src/site.css`, in the `PAGE: HOME` section, find:

```css
    [data-page="home"] .serif-text {
      font-family: 'Century', 'Century Schoolbook', Georgia, serif;
    }
```

Immediately after it, add:

```css
    [data-page="home"] .quote-big {
      font-size: clamp(1.75rem, 3.2vw + 1rem, 3.5rem);
      line-height: 1.15;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      max-width: 44rem;
    }
```

- [ ] **Step 3: Verify — grep for the old grid classes**

Run: `grep -n "md:grid-cols-2\|md:border-l\|quote-big" index.html src/site.css`
Expected: no `md:grid-cols-2`/`md:border-l` remaining on the quotes section in `index.html`; `.quote-big` present in both files (used in `index.html`, defined in `src/site.css`).

- [ ] **Step 4: Verify — manual browser check**

Open `index.html`, scroll to "Words I build by". Expected: two large stacked quotes (not side-by-side columns), noticeably bigger than the current `text-2xl md:text-3xl` size, each with its own reveal stagger. Check at a narrow mobile width (375px) — confirm the `clamp()` keeps the text from overflowing or wrapping awkwardly. Check dark mode — confirm `--text-primary` contrast is correct against the dark `--bg`.

- [ ] **Step 5: Commit**

```bash
git add index.html src/site.css
git commit -m "redesign: full-bleed typography for the Words I build by quotes"
```

---

### Task 4: Scroll-pinned hero with parallax and ambient glow

**Files:**
- Modify: `index.html` (wrap hero markup, add the guarded inline scroll script)
- Modify: `src/site.css` (`PAGE: HOME` section — pin wrapper, glow keyframes, parallax/scale CSS vars, mobile/reduced-motion overrides)

**Interfaces:**
- Consumes: `--accent-deep` and `--hero-glow` tokens (Task 1).
- Produces: nothing consumed by later tasks (this is the last content task; Task 5 is verification-only).

- [ ] **Step 1: Wrap the hero markup**

Find:

```html
    <!-- ── Hero ────────────────────────────────────────────────── -->
    <section class="pt-40 md:pt-52 pb-24 md:pb-36 text-center">
      <div class="flex items-center justify-center gap-4 load d1">
        <img
          src="https://avatars.githubusercontent.com/u/179893130?s=400&u=d8a0d805e4137f21f0dd19fcf5163a1c746f02fd&v=4"
          alt="OkemoVail"
          class="hero-pfp">
        <h1 class="eyebrow">Hey — I'm OkemoVail</h1>
      </div>
      <form action="/search/" method="get" class="hero-search mt-9 load d2" role="search">
        <input type="text" name="q" aria-label="Search the web" placeholder="Search the web…"
          enterkeyhint="search" autocomplete="off" spellcheck="false">
        <button type="submit" class="skuo skuo-accent">Search</button>
      </form>
    </section>
```

Replace with:

```html
    <!-- ── Hero ────────────────────────────────────────────────── -->
    <div class="hero-pin-wrap" id="hero-pin-wrap">
      <section class="hero-pin-inner pt-40 md:pt-52 pb-24 md:pb-36 text-center">
        <div class="flex items-center justify-center gap-4 load d1">
          <span class="hero-pfp-wrap">
            <img
              src="https://avatars.githubusercontent.com/u/179893130?s=400&u=d8a0d805e4137f21f0dd19fcf5163a1c746f02fd&v=4"
              alt="OkemoVail"
              class="hero-pfp">
          </span>
          <h1 class="eyebrow hero-headline">Hey — I'm OkemoVail</h1>
        </div>
        <form action="/search/" method="get" class="hero-search mt-9 load d2" role="search">
          <input type="text" name="q" aria-label="Search the web" placeholder="Search the web…"
            enterkeyhint="search" autocomplete="off" spellcheck="false">
          <button type="submit" class="skuo skuo-accent">Search</button>
        </form>
      </section>
    </div>
```

(The `img`/`h1`/form content is byte-identical to before — only new wrapping elements and 2 new classes: `hero-pfp-wrap` on a new `<span>`, `hero-headline` added to the existing `<h1>`.)

- [ ] **Step 2: Add the pin/glow/parallax CSS**

In `src/site.css`, in the `PAGE: HOME` section, find the hero profile picture block:

```css
    /* ── Hero profile picture ──────────────────────────────────── */
    [data-page="home"] .hero-pfp {
```

Immediately BEFORE that comment, insert:

```css
    /* ── Hero scroll-pin wrapper ──────────────────────────────────
       Base state (no JS, or JS guard skipped): plain relative block,
       .hero-pin-inner renders exactly as the old unwrapped hero did.
       JS adds .pin-active only when it decides to enable the effect —
       see the inline script below. --scroll-progress defaults to 0 via
       the var() fallback in every consumer rule, so without JS running
       the headline/avatar simply render at their natural scale/position. */
    [data-page="home"] .hero-pin-wrap {
      position: relative;
    }

    [data-page="home"] .hero-pin-wrap.pin-active {
      height: 160vh;
    }

    [data-page="home"] .hero-pin-wrap.pin-active .hero-pin-inner {
      position: sticky;
      top: 0;
    }

    [data-page="home"] .hero-pin-inner {
      position: relative;
      z-index: 1;
    }

    /* Ambient glow — pure CSS, independent of scroll/JS. Decorative color
       effect (same bucket as the site's other glow/star-field treatments),
       not applied to any control. Respects the page's existing
       prefers-reduced-motion block below (blanket animation-duration reset). */
    [data-page="home"] .hero-pin-wrap::before {
      content: '';
      position: absolute;
      inset: -10% -10% 0 -10%;
      height: 130%;
      background: radial-gradient(circle at 50% 28%, var(--accent-deep) 0%, var(--hero-glow) 32%, transparent 68%);
      opacity: 0.5;
      pointer-events: none;
      z-index: 0;
      animation: hero-glow-drift 14s var(--ease-soft) infinite;
    }

    @keyframes hero-glow-drift {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50%      { transform: translate(2%, -3%) scale(1.08); }
    }

    [data-page="home"] .hero-pfp-wrap {
      display: inline-flex;
      transform: translateY(calc(var(--scroll-progress, 0) * -40px));
      will-change: transform;
    }

    [data-page="home"] .hero-headline {
      transform: scale(calc(1 - 0.15 * var(--scroll-progress, 0)));
      opacity: calc(1 - 0.3 * var(--scroll-progress, 0));
      transform-origin: center;
      will-change: transform, opacity;
    }

    @media (max-width: 768px) {
      /* Mobile never gets the pin/scale/parallax (JS also checks this via
         matchMedia and won't add .pin-active) — glow stays, it's cheap and
         scroll-independent. This rule is a static-layout safety net in case
         .pin-active is ever present without JS having set --scroll-progress. */
      [data-page="home"] .hero-pin-wrap.pin-active {
        height: auto;
      }
      [data-page="home"] .hero-pin-wrap.pin-active .hero-pin-inner {
        position: relative;
        top: auto;
      }
    }
```

Then find the existing `@media (prefers-reduced-motion: reduce)` block further down in the same section (the one that already zeroes `[data-page="home"] *` animation/transition durations) and confirm it already covers `.hero-pin-wrap::before`'s `animation` — it does, since `[data-page="home"] *` is a universal selector; no edit needed there, just note it in the verification step below.

- [ ] **Step 3: Add the guarded scroll script**

In `index.html`, find the `<script src="src/motion.js"></script>` tag added in Task 2. Immediately after it, add:

```html
  <script>
    (function () {
      var wrap = document.getElementById('hero-pin-wrap');
      if (!wrap) return;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var automated = !!navigator.webdriver;
      var isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (reduce || automated || isMobile) return; // hero stays static — no .pin-active added

      wrap.classList.add('pin-active');
      var ticking = false;

      function update() {
        ticking = false;
        var rect = wrap.getBoundingClientRect();
        var range = wrap.offsetHeight - window.innerHeight;
        var progress = range > 0 ? (-rect.top) / range : 0;
        progress = Math.max(0, Math.min(1, progress));
        wrap.style.setProperty('--scroll-progress', progress.toFixed(3));
      }

      function onScroll() {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    })();
  </script>
```

- [ ] **Step 4: Verify — grep for the new hooks**

Run: `grep -n "hero-pin-wrap\|hero-pin-inner\|hero-pfp-wrap\|hero-headline\|scroll-progress" index.html src/site.css`
Expected: matching class/id names present in both files, no typos (e.g. `hero-pin-wrap` spelled identically everywhere).

- [ ] **Step 5: Verify — manual browser check, desktop**

Open `index.html` at a desktop width (e.g. 1280px). Expected: scrolling down slowly through the hero causes the headline to shrink/fade slightly and the avatar to drift upward more slowly than the page scrolls, while the hero stays pinned to the top of the viewport until the pin range is exhausted, then scrolls away normally into "Selected work". The rose glow behind the hero should be visibly drifting/breathing even before scrolling starts (it's on its own animation loop). Confirm the search input and button remain fully clickable throughout (glow is `pointer-events: none`, avatar/headline transforms don't block the form below them).

- [ ] **Step 6: Verify — reduced motion**

Emulate `prefers-reduced-motion: reduce` in DevTools, reload. Expected: hero renders as a normal static block (no sticky pin, no scale/parallax on scroll), but the ambient glow should NOT animate either (the page's blanket reduced-motion rule collapses its `animation-duration` to near-zero) — confirm the glow is present but static, not moving.

- [ ] **Step 7: Verify — mobile width**

Resize DevTools to 375px width (or use device emulation), reload. Expected: no sticky pin (hero scrolls normally with the rest of the page), no console errors, no horizontal scrollbar introduced by the glow's `inset: -10%` overflow (the `.hero-pin-wrap` has `position: relative` with default `overflow: visible` — confirm the glow doesn't cause the `<body>`/`<main>` to gain horizontal scroll; if it does, add `overflow: hidden` to `.hero-pin-wrap` as a fix before moving on).

- [ ] **Step 8: Verify — dark mode**

Toggle dark mode via the nav's theme button. Expected: glow uses the dark-mode `--hero-glow`/`--accent-deep` values (Task 1), remains subtle and doesn't wash out the dark background or reduce text contrast on the headline/avatar.

- [ ] **Step 9: Commit**

```bash
git add index.html src/site.css
git commit -m "feat: scroll-pinned hero with parallax and ambient glow"
```

---

### Task 5: Full-page verification pass

**Files:** none (verification only — any issue found gets fixed in a follow-up commit before this task is considered done)

**Interfaces:** none.

- [ ] **Step 1: Re-run the full manual checklist end to end**

With all previous tasks committed, open `index.html` fresh (hard reload) and walk the entire page top to bottom in each of these 4 configurations, confirming nothing regressed:
1. Desktop width, light mode, normal motion — hero pin/parallax/glow, staggered work-row reveals, staggered quote reveals, footer reveal.
2. Desktop width, dark mode — same checks, confirm token-driven color changes (glow, text, borders) all look correct.
3. Mobile width (375px), light mode — no pin, glow still breathing, all content readable, no horizontal scroll anywhere on the page.
4. `prefers-reduced-motion: reduce` emulated — everything renders instantly and fully visible, nothing stuck at `opacity: 0`.

- [ ] **Step 2: Confirm no leftover dead code**

Run: `grep -n "class=\"reveal\|reveal\.in\|IntersectionObserver" index.html`
Expected: no matches (the old script and class usage were fully removed in Task 2).

- [ ] **Step 3: Confirm the existing nav/theme-toggle/search-submit flows still work**

Click the search input, type a query, submit — confirm it still navigates to `/search/?q=...` (the `<form action="/search/" method="get">` was untouched, but the wrapping markup changed in Task 4, so this confirms nothing broke the form). Click each nav link. Toggle the theme button. These are pre-existing flows this plan should not have touched — a quick sanity pass, not new functionality.

- [ ] **Step 4: Report status**

If every check in Steps 1–3 passes, the plan is complete — no further commit needed. If any check fails, fix it with a targeted edit, re-verify just that check, and commit with a `fix:` message before considering the plan done.
