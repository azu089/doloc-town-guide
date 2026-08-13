# Affiliate gear override

Normative for the Amazon gear component on generated Doloc guide articles. The task-scoped `MASTER.md` remains authoritative for tokens and scope.

## Render gate and count

- Fail closed unless governed configuration proves `doloctownguides.com`, the tracking tag and intended Amazon marketplace are provider-registered. An absent, false, malformed or unverified gate renders no module and no Amazon links.
- When enabled, render exactly one `aside.amazon-gear` per eligible article as a child of `.manual-main`, after the article CTA and before sources. Render zero copies in `.site-footer`, home and utility pages.
- Never describe code presence, a tracking parameter or a click as a verified integration, order, commission or revenue event.

## Semantic DOM

Use a labelled `<aside>`, hierarchy-correct heading with unique id, disclosure before links, and a semantic `<ul>` containing five `<li><a>` items. Link labels name the product, Amazon action and new-tab consequence. Each anchor uses `target="_blank"` and `rel="sponsored nofollow noopener"`.

Retain this exact English sentence before the links in all locales: `As an Amazon Associate I earn from qualifying purchases.` A localized explanation and the statement that price/availability may change may follow, but cannot replace it.

## Layout and responsive behavior

- Module `inline-size:100%`, `max-inline-size:100%`, centered with `margin-inline:auto`, constrained by `.manual-main`, never by viewport or footer width.
- Mobile-first grid uses `minmax(0,1fr)`, wrapping labels and at least 8px gaps. At 320px use one column. At 375px and 414px use two columns only when every localized label fits without clipping; otherwise one. Above 641px use two or three columns as space permits.
- Every anchor is at least 44×44 CSS px with 12px inline padding and `touch-action:manipulation`. No horizontal overflow at 320, 375, 414 or desktop; module center matches `.manual-main` center within 1 CSS px.
- Long zh-CN, zh-TW, ja, ko and es labels wrap. No truncation, ellipsis or single-line constraint.

## Focus and motion

- DOM order equals visual/tab order; no positive `tabindex`; wrapper is not focusable.
- `:focus-visible` has a visible 2px `--amber-soft` outline with 3px offset and is not clipped. Hover is gated to `(hover:hover) and (pointer:fine)` and is not the only cue.
- No entrance, scroll, reveal, stagger, shimmer, pulse or hover-lift motion; the module must not carry `.reveal`.
- Only `:active` press feedback is allowed: `transform:scale(.98)` with `transition:transform 120ms cubic-bezier(.23,1,.32,1)`. Under reduced motion, remove both transform and transition.

## Deterministic browser and rollback assertions

1. Two fixed-SHA builds are byte-identical.
2. Gate disabled/unverified: zero `.amazon-gear` nodes and zero Amazon tracking URLs on every generated page.
3. Gate enabled with approved test config: one module per eligible article, direct child of `.manual-main`, zero footer copies, five links, disclosure preceding links.
4. Every link has visible descriptive text, required target/rel tokens, governed query/tag values and no silent hard-coded fallback.
5. At 320/375/414/desktop and 200% zoom: no overflow; all targets are at least 44×44; focus ring is visible; center tolerance is 1 CSS px. Test six locales and reduced motion.
6. In real Chrome, every link opens a new HTTPS tab whose final host is the approved Amazon marketplace and whose search intent matches the label. Blank tabs, challenges, navigation errors and unexpected hosts fail QA; do not fake inline success.
7. Rollback reverts only the fixed implementation/config commit to the recorded Doloc baseline and regenerates the site. It must not mutate provider registration, credentials, tax or payout settings.
