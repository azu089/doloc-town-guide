# Doloc Amazon Module Refresh — Task-scoped Master

## Scope and provenance

- Task: `ui-doloc-amazon-module-refresh-20260814-01`; state revision `21`; target site SHA `6923b0f62ca0eb51c91dca308a961cd5931c191e`.
- Actual stack: Node.js static generator, semantic HTML, plain CSS and small vanilla-JS progressive enhancement. No React or Tailwind runtime exists.
- Product/IA boundary: bounded maintenance of the released Doloc article template. It adds no URL, game, IA branch or provider backend change. Historical sources are `docs/history/legacy/热词验证报告-2026-08-07.md` and `sites/doloc-town/DESIGN-PLAN.md`; current evidence is `.control/runtime/audits/doloc-content-affiliate-evidence-20260814.json`.
- UI UX Pro Max query: `content-first dark game guide affiliate recommendation module accessible restrained`; dials variance 2/10, motion 1/10, density 5/10. Supplemental searches covered touch targets, focus, responsive overflow, semantic external links and reduced motion.

## Product signature retained

Keep the existing “Ruins & Roots / Farmstead Manual” system unchanged: `#16211A` background, `#22301F` panel, `#EDF2E6` text, `#A8B8A0` muted text, `#7FB069` growth accent, `#F0B457` harvest accent; Zilla Slab headings, Inter body and Space Mono labels; 11/16px radii and 4/8px rhythm. The generated replacement typography, oversized editorial styling, newsletter structure and new palette are rejected because this is a repair, not a redesign.

## Component contract

- Eligible state is provider-registration gated. Render no Amazon module unless governed configuration says the current top-level site is registered and supplies an approved tracking tag/marketplace. Absence, false, malformed or unverified configuration returns an empty string: no placeholder, disabled links or “verified integration” claim.
- When enabled, render exactly one `<aside class="amazon-gear" aria-labelledby="amazon-gear-title">` per eligible article, as a child of `.manual-main`, after the article CTA and before sources. Never render it in `.site-footer`, home, utility pages or twice.
- Container: `inline-size:100%`, `max-inline-size:100%`, `margin-block:32px 0`, `margin-inline:auto`, `padding:20px`, 1px `--line-strong` border, 11px radius and quiet existing panel surface. It must align to the editorial column rather than viewport edges.
- Heading is an `h2` or hierarchy-correct heading with a deterministic unique id. Links are a semantic `<ul>` of five `<li>` items. Each visible label names the product and destination/action, e.g. “Gaming keyboard — search Amazon ↗”; the accessible name must also communicate that a new tab opens.
- Every link has `target="_blank"` and `rel="sponsored nofollow noopener"`. No JavaScript popup, redirector, intermediate route or provider logo is introduced.
- Disclosure appears before the first commercial link in reading/DOM order and retains the exact English sentence: `As an Amazon Associate I earn from qualifying purchases.` A localized explanation may follow, but must not alter or replace that sentence. Also state prices/availability may change.

## Responsive and accessibility tokens

- Mobile-first link grid: one column at 320px; two columns from 375px through 640px only when all localized labels fit without clipping; two or three columns above 641px as available. Use `minmax(0,1fr)`, wrapping text and an 8px minimum gap; never force horizontal scrolling.
- Each link has `min-inline-size:44px`, `min-block-size:44px`, 12px inline padding, centered flex alignment and `touch-action:manipulation`. Body/disclosure remains at least 12px only for legal metadata; action labels are at least 14px with 1.4 line-height.
- `:focus-visible` uses a 2px `--amber-soft` outline with 3px offset and must not be clipped. Visual order equals DOM/tab order; no positive `tabindex`; the wrapper is not focusable.
- Default, hover, focus and pressed states must meet WCAG AA for text. Hover enhancements are gated by `@media (hover:hover) and (pointer:fine)` and are never the only state cue.

## Motion contract (Emil)

- No entrance, scroll, stagger, reveal, shimmer, pulse, hover lift or layout animation. Remove `.reveal` from this module.
- The only motion is immediate press feedback on a frequent explicit action: `transform:scale(.98)` with `transition:transform 120ms cubic-bezier(.23,1,.32,1)`. Purpose: confirm the press. It is interruptible and applies only while `:active`.
- Under `prefers-reduced-motion:reduce`, press transition and transform are removed. Color/border hover may change without movement.

## Failure, analytics and rollback

- Browser/provider challenge, blocked popup, regional mismatch, 4xx/5xx or a final host outside the approved Amazon marketplace is a failed journey, never counted as a successful affiliate integration. Do not fake an inline success/error because a plain external anchor cannot reliably observe the new tab. Verification records the failure; the page remains readable.
- `affiliate_click` may record only click intent for an enabled `rel~="sponsored"` link. It is never an order, commission or revenue event.
- Rollback removes the single implementation commit/config enablement and regenerates the site. It must restore the prior fixed SHA without touching provider registration, credentials, tax or payout settings.

