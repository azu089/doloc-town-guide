# Article override — Amazon gear module

This override applies to generated guide articles only. All rules in `../MASTER.md` remain normative.

## Required DOM placement

```html
<div class="manual-main">
  <!-- editorial sections and existing article CTA -->
  <aside class="amazon-gear" aria-labelledby="amazon-gear-title">
    <h2 id="amazon-gear-title">Game gear</h2>
    <p class="amazon-disclosure">As an Amazon Associate I earn from qualifying purchases.</p>
    <ul class="amazon-gear-links"><!-- five li > a entries --></ul>
    <p class="aff-note">Prices and availability may change.</p>
  </aside>
  <!-- sources -->
</div>
```

There must be no `.amazon-gear` descendant or sibling under `.site-footer`. If the provider-registration gate is not proven for `doloctownguides.com`, the required result is zero modules and zero Amazon links.

## Viewport assertions

| Width | Required result |
| ---: | --- |
| 320 | One-column links; 16px page gutter; no clipping/overflow; every target at least 44×44 CSS px |
| 375 | Two columns only if localized labels wrap cleanly; otherwise one column; 8px gaps |
| 414 | Same adaptive rule; module center equals `.manual-main` center within 1 CSS px |
| 641–900 | Full single editorial-column width after sidebar collapses |
| Desktop | Module remains inside `.manual-main`; never spans the footer or viewport; center equals editorial-column center within 1 CSS px |

Test all six locales, 200% zoom, keyboard-only traversal and reduced motion. Long Japanese, Korean, Spanish and Chinese labels wrap; they do not truncate.

## Deterministic G4 assertions

1. Build twice from the fixed candidate and require identical generated output.
2. Gate disabled/unverified: every generated page has `document.querySelectorAll('.amazon-gear').length === 0` and no Amazon tracking URL.
3. Gate enabled with approved test configuration: each eligible article has exactly one module; it is a direct descendant of `.manual-main`; footer count is zero; five links exist; disclosure precedes links.
4. All five anchors have non-empty visible text, `target=_blank`, and rel tokens `sponsored`, `nofollow`, `noopener`; query and tracking tag match governed configuration, not a silent hard-coded fallback.
5. At 320/375/414/desktop: `scrollWidth <= clientWidth`; targets are at least 44×44; focus outline is visible and unclipped; geometry center tolerance is 1 CSS px.
6. Real Chrome journey: click each link, confirm a new tab, HTTPS, approved final Amazon host and expected search intent. Challenge, blank tab, unexpected host or navigation error fails the journey.
7. Motion: no `.reveal`, IntersectionObserver dependency or entrance/scroll keyframe; only the specified 120ms press feedback, absent under reduced motion.
8. Rollback test restores zero or prior governed module behavior without provider/backend mutation.

