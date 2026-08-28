# BDH Architecture Row Design

**Date:** 2026-08-28
**Scope:** Simplify the BDH presentation on `AI/index.html` without changing the rest of the page or the underlying architecture claims.

## Problem

The current BDH section separates the architecture from the preceding "Based AI" material and presents it as a feature showcase: four rounded fact cards, a decorative circular neuron map, a slogan, and three badges. The amount of framing competes with the information and makes the section resemble a generated landing-page block rather than a research update.

The `unslop-ui` audit confirms the local mechanical tell: all four fact cards use the same large `rounded-2xl` treatment. Visual review also finds duplicated information between the cards, map labels, explanatory copy, and badges.

## Design Intent

Treat BDH as the fourth architecture item in the existing "Based AI" sequence. The visual reference is the page's own numbered, rule-separated technical language rather than a new external style. The section should read like a concise architecture note: direct prose, exact values, and no decorative simulation of a neural network.

This is a deliberate project-specific choice:

- **Reference:** the site's established Swiss-influenced technical layout, including Satoshi headlines, JetBrains Mono notation, rosewood accent, and hairline rules.
- **Color:** retain the existing rosewood accent and warm neutral tokens; introduce no new palette.
- **Type:** retain Satoshi for prose/headings and JetBrains Mono for the row number and specifications.
- **Layout:** one asymmetric architecture row because the user needs to understand the architecture claim and its constraints, not browse feature cards.

## Production Layout

The existing standalone BDH `<section>` is removed. Its content becomes row `04` at the bottom of the existing "Based AI" section, after "Scaling Sustainably."

At desktop widths, row `04` uses three columns:

1. A narrow JetBrains Mono row number: `04`.
2. The architecture name and one explanatory paragraph.
3. A compact definition list containing four specifications.

The row uses the same top rule, spacing rhythm, and maximum page width as the preceding Based AI rows. It is not enclosed in a card and receives no distinct background, radius, shadow, icon, or illustration.

At widths below `768px`, the columns stack in source order. The specification list remains a two-column key/value layout within the available width. Text wraps without clipping, and the page must not gain horizontal overflow at 375px.

## Content

The production copy is:

**Label:** `Bounded Dynamic Highway`
**Heading:** `BDH neural architecture`

**Explanation:**

> Saga is moving to a looped network that replaces attention, RoPE, and large KV caches with bounded hidden dynamics. Each block keeps four recent hidden states, mixes them across grouped temporal branches, then repeats the same physical depth.

**Specifications:**

| Key | Value |
|---|---|
| `state` | `4 cached` |
| `branches` | `12 temporal` |
| `depth` | `28 x 2 passes` |
| `target` | `RTX 5080` |

The ASCII `x` is used in HTML source for consistency with the repository's default ASCII editing rule. CSS may style the notation but must not transform its meaning.

## Removed Elements

Remove all of the following from `AI/index.html`:

- The standalone `BDH Neural Architecture` section.
- The four rounded feature cards.
- The circular SVG neuron map and its accessibility title/description.
- The "Small memory, repeated thought" slogan.
- The three badges beneath the map.

Remove the now-unused BDH presentation rules from the `[data-page="ai-home"]` section of `src/site.css`:

- `.bdh-neural-card`
- `.bdh-neuron-map`
- `.bdh-map-ring`
- `.bdh-map-link`
- `.bdh-map-neuron`
- `.bdh-map-neuron--core`
- `.bdh-map-label`
- `.bdh-map-label--core`

Delete the throwaway `AI/index-bdh-prototype.html` after the production row is implemented. The prototype is not a permanent route or production artifact.

## Styling

Add only page-local layout rules under `[data-page="ai-home"]` in `src/site.css`. Use names scoped to the architecture row rather than generic global names.

Required behavior:

- Three-column grid on desktop: narrow number, flexible explanation, narrower specifications.
- Existing `--accent`, `--text-*`, and `--border*` tokens only.
- Satoshi remains inherited from the page; JetBrains Mono is used for number/spec notation.
- Hairline rules establish grouping.
- No gradients, pills, large radii, shadows, glows, icons, decorative SVG, or new animation.
- No new dependencies and no changes to shared controls or tokens.

The existing section-level `data-reveal` remains. No child-level entrance motion is added.

## Accessibility

- Use a semantic heading and paragraph for the architecture explanation.
- Use `<dl>`, `<dt>`, and `<dd>` for the specification pairs.
- Preserve logical source order: number, explanation, specifications.
- Do not communicate meaning through color alone; labels and values remain explicit text.
- Maintain the existing color tokens, whose light/dark treatment is already shared across the page.

## Implementation Footprint

- `AI/index.html`: remove the standalone BDH section and append row `04` to the existing Based AI section.
- `src/site.css`: replace the obsolete map/card styles with the architecture-row layout and mobile breakpoint.
- `AI/index-bdh-prototype.html`: delete after integrating the chosen variant.
- No JavaScript changes.
- No backend, chat, navigation, shared module, or dependency changes.

## Verification

1. Run the `unslop-ui` scanner on `AI/index.html`; the four large-radius BDH findings must be gone and no new finding may be introduced by this change.
2. Serve the site locally and load `AI/index.html` in Playwright at desktop width (1440px). Confirm the BDH row is present, the old SVG/cards/badges are absent, and the document has no horizontal overflow.
3. Repeat at 375px width. Confirm the row stacks in source order, definition pairs remain readable, and there is no horizontal overflow.
4. Check both light and dark themes visually for readable text and visible rules.
5. Run `node test-z-index.mjs`; this change should not affect layering, but the page consumes the shared stylesheet and must not regress its established invariant.
6. Confirm `AI/index-bdh-prototype.html` no longer exists after production integration.

## Success Criteria

- BDH reads as item `04` within Based AI, not as a separate marketing showcase.
- All four architecture facts remain visible and accurate.
- The old neuron map, rounded fact cards, badges, and slogan are absent.
- The layout is readable in light/dark modes and at desktop/mobile widths.
- No horizontal overflow or new unslop scanner findings are introduced.
- The throwaway prototype is deleted.

## Out of Scope

- Rewriting the other three Based AI rows.
- Changing the site's typography, color identity, navigation, hero carousel, or motion system.
- Verifying or changing the scientific validity of BDH itself; this work only changes presentation.
- Adding interactions, diagrams, animation, or a dedicated architecture route.
