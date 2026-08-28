# Landing page (`index.html`) modernization — design

**Date:** 2026-08-28
**Scope:** `index.html` only. No other pages, no shared component changes beyond additive tokens and a page-local CSS section.

## Problem

The flat-design migration (2026-08-19) correctly stripped shadows/gradients/depth
from resting controls site-wide, but `index.html` never had a signature visual
moment to begin with — it read as "quiet" before flat, and "empty" after. User
feedback: "website looking like a bit too bland." Reference points discussed:
Apple product pages, Linear, Stripe (clean-but-premium via motion/typography,
not skeuomorphic depth) — explicitly **not** WebGL/3D-engine territory (ruled out
in favor of 2D depth effects: scroll choreography, parallax, ambient gradient
motion — no three.js, no new runtime dependency).

## Constraints (carried over from CLAUDE.md, non-negotiable)

- Flat design language stays intact: no shadows/gradients/inset highlights on
  resting controls. New color effects must fall into the existing "decorative
  color stays" exception (conic gradients, star fields, text gradients, glow
  visualizations) — same bucket, not a new precedent.
- Motion hard invariants: every new JS-driven animation MUST bail under
  `prefers-reduced-motion: reduce` AND `navigator.webdriver` (keeps the
  Playwright snapshot harness deterministic). Content must never be hidden
  when JS is absent or bails.
- Reuse existing motion tokens (`--ease-smooth`, `--ease-soft`, `--dur-1..4`,
  `--stagger`, `--rise`) rather than inventing new ones.
- Keep the current page structure: hero → Selected work → Words I build by →
  footer. No new sections, no cut content, no reordering.
- Keep the current color identity (cream `--bg` `#f5f4ed`, dusty-rose
  `--accent` `#c96478`) as the base — extensions must read as the same family,
  not a repaint.

## Gap found during design: index.html's motion is currently unguarded

`index.html` has its own inline `IntersectionObserver` reveal script (added
before the site-wide motion system existed) with **no**
`prefers-reduced-motion`/`navigator.webdriver` guard — a real violation of the
stated invariant. This work retires that script in favor of the shared
`src/motion.js` (`[data-reveal]` system), already used on `AI/index.html` and
`search/index.html`, which has the guards built in.

## Design

### 1. New tokens (additive only — no existing token changes)

In `src/site.css` §1 (`:root` light block and `.dark` block), add:

- `--accent-deep`: `color-mix(in srgb, var(--accent), black 25%)` — a darker
  rose for text/foreground use against the glow, where plain `--accent` would
  be too low-contrast.
- `--hero-glow`: a very low-alpha radial tint derived from `--accent` (~6–10%
  opacity, e.g. `color-mix(in srgb, var(--accent) 8%, transparent)`) — the
  hero's ambient backdrop color.

Both tokens are scoped the same way `--accent`/`--accent-light` already are
(separate light/dark values), so dark mode gets its own tuned glow rather than
inheriting a mismatched one.

### 2. Hero — scroll-pinned moment

The hero section wraps in a taller container (~160vh) with the visible hero
content `position: sticky` inside it. While pinned:

- Headline (`<h1>` "Hey — I'm OkemoVail") scales `1 → 0.85` and fades slightly
  (opacity `1 → 0.7`) as scroll progress through the pin range advances.
- Avatar (`.hero-pfp`) parallaxes at a slower rate than scroll (simple
  `translateY` offset, a fraction of scroll delta) — drifts up more slowly
  than the page, creating depth without any 3D transform.
- `--hero-glow` renders as a radial-gradient backdrop behind the hero,
  animating on its own slow independent loop (position/scale drift, several
  seconds per cycle) — ambient, not tied to scroll position.

All three effects come from one `requestAnimationFrame`-driven scroll handler,
written as a small inline script local to `index.html` (not part of shared
`src/motion.js`, since this behavior is bespoke to this one hero). It mirrors
`src/motion.js`'s exact guard pattern: compute
`prefers-reduced-motion`/`navigator.webdriver` once on load; if either is
true, skip entirely — hero stays static, fully visible, non-sticky, no glow
animation, no parallax. This is a graceful degrade, not a broken state.

Mobile (`<=768px`, matching the breakpoint the codebase already uses for other
layout-mode splits — e.g. Word Focus Canvas): the scroll-linked pin/scale/
parallax is disabled entirely — hero renders as a normal static block, same
as the reduced-motion fallback. The ambient `--hero-glow` animation stays
active at all sizes (it's scroll-independent, cheap, and is what reads as
"alive" on a phone where a 160vh pinned scroll would just feel like a stuck
page). This is a `matchMedia('(max-width: 768px)')` check alongside the
existing `prefers-reduced-motion`/`navigator.webdriver` checks in the same
guard block — any one of the three true disables pin/scale/parallax; glow
is independent of all three.

### 3. Selected work — staggered reveal

Content and the 3 rows are unchanged. The reveal mechanism moves from the
current inline `IntersectionObserver` + `.reveal`/`.in` classes to
`src/motion.js`'s `[data-reveal]` system: each work row gets `data-reveal` +
a `data-reveal-delay` staggered by `--stagger` (45ms) per row, so rows rise
and fade in sequence rather than firing together. Visual effect: rise
(`--rise`, 10px) + fade, `--ease-smooth`, using `backwards` fill (per the
site's hard rule — `both`/`forwards` on a transform entrance would permanently
pin `transform` and kill any later hover/press transform on that element;
irrelevant here since rows have no hover transform today, but keeping the
rule consistent avoids a footgun if one is added later).

### 4. Words I build by — full-bleed typography

Structural content unchanged (still Feynman + Torvalds, still 2 quotes). Visual
treatment changes from the current small 2-column grid to a large, full-width
serif statement — significantly bigger `Century` serif size than today's
`text-2xl md:text-3xl`, giving the quotes the weight of a design moment rather
than a footnote. Reveal treatment: same `[data-reveal]` mechanism as section 3
for consistency.

### 5. Footer

No structural or content change. Gets `data-reveal` for consistency with the
rest of the page's reveal treatment.

### 6. Implementation footprint

- `index.html`:
  - Add `<script src="src/motion.js">` (before the page's own inline
    scripts, matching load order on other pages).
  - Remove the inline `IntersectionObserver`/`.reveal` script entirely.
  - Replace `class="reveal"` on the work/quotes/footer sections with
    `data-reveal` (+ `data-reveal-delay` on individual rows where staggering
    is wanted).
  - Add a new small inline script (guarded per above) implementing the hero
    scroll-pin/parallax/glow behavior.
  - Wrap the hero section markup for the sticky container (extra wrapper div
    around the existing hero content — content itself is unchanged).
- `src/site.css`:
  - Add `--accent-deep` and `--hero-glow` to the existing light/dark token
    blocks (§1).
  - Add a `[data-page="home"]` section (following the file's existing
    per-page-section convention) containing: sticky hero wrapper rules, glow
    keyframes, parallax transform hooks (CSS custom properties the inline
    script writes to, e.g. `--scroll-progress`), and the enlarged quote
    typography.
- No changes to `src/nav.js`, no changes to any other HTML page, no new
  npm/CDN dependencies.

### 7. Testing / verification

No automated test suite covers `index.html` today (Tailwind CDN page, no
build step beyond the shared `src/output.css`/Tailwind pipeline for other
pages — this page isn't part of that). Verification is manual/visual only,
and will be reported as such rather than claimed as automated coverage:

- Open `index.html` directly in a browser; scroll through the hero pin range
  at varying speeds, confirm headline scale/fade and avatar parallax read as
  intentional (not janky/laggy).
- Confirm the ambient glow animates independently of scroll and doesn't
  interfere with text contrast/readability (check against
  `--accent-deep` contrast where text overlaps the glow).
- Emulate `prefers-reduced-motion: reduce` in DevTools → confirm hero renders
  fully static, non-sticky, no glow animation; page remains fully usable.
- Confirm work rows and quotes stagger in sequence on scroll into view (both
  light and dark mode).
- Check mobile viewport width (e.g. 375px) — confirm the hero pin either
  feels intentional or falls back per the mobile note in section 2; confirm
  no horizontal overflow introduced by the glow backdrop or sticky wrapper.
- Dark mode pass on all four sections (tokens are dark-aware, but glow
  opacity/contrast should be eyeballed separately from light mode).

## Explicitly out of scope

- Any other HTML page (`AI/index.html`, `search/index.html`, etc.).
- Any change to the flat design system's rules for controls/buttons/inputs.
- Any new build dependency (three.js, GSAP, or otherwise).
- Restructuring, reordering, or content changes to the 4 existing sections.
- Automated test coverage (none exists for this page; not being added here).
