# Doloc Native Ad Viewability — Task-scoped Master

## Scope and provenance

- Task: `ui-doloc-native-ad-viewability-20260814-01`
- Site: `doloctownguides.com` / `sites/doloc-town`
- Actual stack: Node.js static-site generator (`scripts/generate.js`) emitting semantic HTML and a hand-authored CSS bundle (`templates/style.css` → `public/css/style.css`). There is no React, Tailwind, or client UI framework.
- Existing product/IA sources: the historically approved Doloc G1 report at `docs/history/legacy/热词验证报告-2026-08-07.md`, the Product/IA plan at `sites/doloc-town/DESIGN-PLAN.md`, and the current facts at `docs/research/doloc-town-research.md`.
- Current-governance caveat: no current G1/G2 planning artifact exists under `.control/runtime/planning/`. This is a bounded maintenance experiment on an already released site, not a new site, new game, new URL, IA expansion, or redesign. This artifact requires a new hash-bound UI approval before implementation.
- Evidence: `.control/data/reports/20260814-adsterra-browser-5d.md` records a partial, browser-observed 2026-08-09..13 baseline: Doloc 252 impressions, USD 1.35 revenue, USD 5.344 eCPM. It does not provide page-level viewability or fill rate.

## Product signature retained

Retain the existing “Ruins & Roots / Farmstead Manual” visual system without substitution:

- Dark pastoral surfaces: `--bg #16211A`, `--panel #22301F`, `--panel-2 #2A3B26`.
- Editorial text: `--text #EDF2E6`, `--muted #A8B8A0`.
- Growth and harvest accents: `--sprout #7FB069`, `--amber-soft #F0B457`.
- Type: Zilla Slab display, Inter body, Space Mono field-note labels.
- Shape and rhythm: 11/16px radii and a 4/8px-derived vertical rhythm.

The UI UX Pro Max generated recommendation was intentionally not adopted as a replacement theme: its pink editorial palette, Atkinson typography, newsletter structure, and oversized type conflict with the live Doloc product. Its applicable findings are retained: async third-party loading, mobile-first containment, no horizontal overflow, reserved space for CLS, AA label contrast, explicit breakpoints, and reduced motion.

## Native ad slot tokens

These are task-scoped override tokens; they do not replace global site tokens.

| Token | Value | Purpose |
| --- | --- | --- |
| `--ad-slot-surface` | `rgba(255,255,255,.025)` | Quiet separation without imitating editorial cards |
| `--ad-slot-border` | `rgba(196,220,180,.18)` | Existing `--line-strong` equivalent |
| `--ad-slot-label` | `#C4D3BD` | Visible disclosure; must verify at least 4.5:1 on slot surface |
| `--ad-slot-radius` | `11px` | Align with `--radius-sm` |
| `--ad-slot-gap-editorial` | `24px` minimum | Distance to ordinary editorial sections |
| `--ad-slot-gap-commercial` | `48px` minimum | Distance to store, buy, Amazon, Steam, or other commercial CTA |
| `--ad-slot-reserve` | `clamp(180px, 32vw, 260px)` | Initial and persistent reserved block size while provider response is unknown |
| `--ad-slot-inline-max` | `100%` | Prevent iframe/creative overflow |

The wrapper is full width within `.manual-main`, never wider than the editorial column. It has a 1px border, the task surface, an 11px radius, and 16px inline padding (20px from 641px upward). It must not resemble a guide card, purchase button, system notice, or navigation control.

## Semantic component

Required conceptual structure:

```html
<aside class="native-ad-slot"
  aria-label="Advertisement"
  data-ad-placement="article-mid-late"
  data-experiment="doloc-native-ad-viewability-20260814">
  <span class="native-ad-label">Advertisement</span>
  <!-- the existing provider snippet, byte-for-byte in meaning, exactly once -->
</aside>
```

- Use `aside` plus a localized accessible name. Do not add `role="alert"`, `aria-live`, `tabindex`, a close control, or a fake loading message.
- The visible label precedes the provider content in DOM and visual order.
- Do not alter, wrap links into, or visually mask provider creative content.
- Do not add a second provider script or a second `container-b77bc61705d2dcbe2c5239c8553cdb1a` on any page.
- The provider script remains asynchronous. No Adult, Popunder, Smartlink, Social Bar, interstitial, sticky, auto-audio, or additional ad unit is in scope.

## Localized disclosure

| Locale | Visible text and `aria-label` |
| --- | --- |
| `en` | `Advertisement` |
| `zh-CN` | `广告` |
| `zh-TW` | `廣告` |
| `ja` | `広告` |
| `ko` | `광고` |
| `es` | `Publicidad` |

The label uses Inter, 12px minimum, 600 weight, 0.08em letter spacing, no all-caps transformation outside English, and `--ad-slot-label`. It is disclosure, not a clickable heading.

## Responsive and CLS contract

- At 320, 375, 414, 768, 1024, and 1440 CSS px: the wrapper and every provider child/iframe must remain within the content column; document `scrollWidth <= clientWidth`.
- Reserve `--ad-slot-reserve` before the provider script resolves and keep the reserve when blocked or unfilled. Do not collapse it after a timer; that would trade blank space for layout shift.
- Provider descendants receive `max-inline-size:100%`. The wrapper clips accidental visual overflow but must not crop a correctly sized native creative.
- No fixed or sticky positioning. The slot scrolls with the article.
- Lab CLS for each eligible page is `<= 0.10` with a normal provider response and with the request blocked. Any shift attributable to the slot is a stop condition.
- The site remains readable at 200% browser zoom and at 320px width. The disclosure must not truncate.

## Accessibility and editorial separation

- Disclosure contrast is at least 4.5:1. The wrapper boundary is supplemental; color is not the only signal because the text label is always present.
- The slot is not interactive at the wrapper level and introduces no keyboard stop. Provider-owned links, if any, must not be covered by overlays.
- Reading order stays: preceding guide section → advertisement landmark/label → following guide section.
- Keep at least 24px between the slot and ordinary editorial sections, and at least 48px between slot and `.store-compare`, `.buy-entry`, `.amazon-gear`, `.cta-box`, or any affiliate/store CTA. The slot cannot appear between an interactive filter and the tables it controls.
- No editorial heading, “recommended,” game-art frame, sprout icon, button styling, or affiliate disclosure may be reused as the ad label.

## Motion contract (Emil framework)

| Component | Frequency | Purpose | Easing / duration | Interruptibility | Reduced motion |
| --- | ---: | --- | --- | --- | --- |
| Native ad wrapper | Every eligible guide visit | None; delayed third-party content must not attract or mislead | No animation or transition | Not applicable | Identical static behavior |
| Visible ad label | Every eligible guide visit | Disclosure | No animation or transition | Not applicable | Identical static behavior |
| Provider content arrival | Every filled eligible visit | Provider-owned load, not a site interaction | No site-authored fade, slide, scale, shimmer, reveal, or keyframe | Provider-owned only | No site-authored motion |
| Existing surrounding guide sections | Normal browsing | Existing spatial reveal, outside this task | No new behavior introduced | Existing implementation | Existing global reduced-motion rule remains |

Emil decision: users may see this unit on every high-traffic article visit, and it has no explanatory or feedback purpose. Therefore it must not animate. In particular, never give it the existing `.reveal` class and never use `transition: all`, `scale(0)`, `ease-in`, layout-property animation, or decorative hover treatment.

## Rejected patterns

- More than one unit per page or duplicating the same container ID.
- Moving all pages at once; the experiment is an exact cohort.
- Inserting above the first substantive section, inside the hero/TOC, inside a table/filter workflow, in the sticky sidebar, or adjacent to a commercial CTA.
- A floating/sticky banner, overlay, modal, popunder, social bar, or adult inventory.
- Skeleton shimmer, reveal motion, parallax, pulse, or “sponsored recommendation” card styling.
- Calling `ad_slot_eligible` an impression, viewability event, click, or revenue event.
