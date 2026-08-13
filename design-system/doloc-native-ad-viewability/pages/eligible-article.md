# Eligible article override — Native Banner placement

## Exact cohort

Only these seven canonical paths receive the mid/late-article placement:

1. `/cooking`
2. `/fishing`
3. `/mods`
4. `/gifts`
5. `/ko/cooking`
6. `/ko/fishing`
7. `/ko/exploration`

All other generated URLs, including other locales of the same slugs, keep the current footer placement. Query strings and fragments do not affect eligibility. Path matching occurs from generator inputs (`lang`, `slug`), not by client-side URL parsing.

## Deterministic insertion algorithm

For an eligible article with `N` rendered content sections:

1. Set `k = ceil(0.60 × N)`, clamped to `[2, N - 1]`. `k` is a one-based section number.
2. If section `k` is within or immediately followed by a contiguous tool/table result group that begins with `fishfilter`, `giftfilter`, or `genefilter`, advance `k` to the last contiguous table belonging to that group.
3. Insert the slot after rendered section `k`, before section `k + 1`.
4. Never insert inside a section, between a filter and its result tables, or after the final editorial section.

For the current fixed content this resolves to:

| Path | N | Insert after | Next editorial content |
| --- | ---: | --- | --- |
| `/cooking` | 6 | section 4, “Stocking a Kitchen (A Routine)” | Common Mistakes |
| `/ko/cooking` | 6 | section 4, Korean equivalent | Common Mistakes equivalent |
| `/fishing` | 8 | section 5, final fish lookup table | efficiency/tips sections |
| `/ko/fishing` | 8 | section 5, final fish lookup table | efficiency/tips sections |
| `/gifts` | 6 | section 5, final lookup table | Quick Answers |
| `/mods` | 3 | section 2, “Workshop is live” | Mod FAQ |
| `/ko/exploration` | 6 | section 4, key-resource table | mysteries and FAQ sections |

If section counts or types change, G4 must recompute and snapshot the resolved anchors. A changed anchor is not silently accepted.

## One-unit branch behavior

- Eligible branch: emit the existing Native Banner snippet exactly once inside `.native-ad-slot` and omit it from footer.
- Non-eligible branch: emit no `.native-ad-slot`; retain the existing Native Banner snippet exactly once in footer.
- Every built HTML page must have exactly one provider script URL occurrence and exactly one provider container ID occurrence when Adsterra configuration is present.
- AdSense metadata/script behavior is unchanged and is not evidence of an Adsterra impression.

## Commercial and editorial spacing

- The calculated positions leave editorial content both before and after the unit.
- The wrapper has at least 24px vertical distance from adjacent editorial sections.
- If a future content change places `.store-compare`, `.buy-entry`, `.amazon-gear`, `.sources`, `.cta-box`, a Steam button, or an affiliate link block within 48px, the build/audit fails; the algorithm must choose an earlier eligible section rather than compress the gap.
- Do not place an internal-link purchase prompt immediately above or below the advertisement.

## Analytics semantics

An optional first-party event may be emitted once per eligible page load:

```text
event: ad_slot_eligible
params: { provider: "adsterra", format: "native_banner", placement: "article_mid_late", page_path }
```

This means only that the eligible wrapper was rendered. It must never be reported as an ad impression, viewable impression, filled unit, click, or revenue. No provider creative DOM is inspected to infer those outcomes.

## Browser and G4 assertions

For all seven paths, at 375×812 and 1440×900, and with normal and blocked provider requests:

- exactly one `.native-ad-slot`;
- exactly one provider script URL and one provider container ID in page source;
- zero matching provider snippet inside `.site-footer`;
- slot follows the expected resolved section and precedes at least one editorial section;
- slot is outside `.reveal`, `.toc`, `.manual-side`, tables, filter controls, and all CTA/affiliate components;
- localized visible label equals the page locale and accessible name matches it;
- wrapper and descendants fit within `.manual-main`; no horizontal document overflow;
- no fixed/sticky positioning, overlay, close affordance, auto-audio, or site-authored animation;
- no new keyboard stop or focus trap;
- CLS `<= 0.10`, including blocked/unfilled behavior;
- at 200% zoom the label is present and not clipped.

For a sample non-eligible page in every supported locale:

- zero `.native-ad-slot`;
- exactly one provider script and container ID in footer;
- current footer behavior remains functionally unchanged.

## Experiment and rollback contract

- Observation begins only after an independently audited, fixed-SHA release.
- Minimum decision window: 7 complete UTC days **and** 1,000 GA4 eligible-cohort page views. Maximum window: 14 complete UTC days; below 1,000 views at day 14 is `inconclusive`, not failure or zero.
- Directional baseline: 2026-08-09..13 Doloc domain — 252 Adsterra impressions, USD 1.35 revenue, USD 5.344 eCPM. It is a five-day, domain-level baseline and cannot be treated as page-level viewability.
- Primary directional metric: Doloc Adsterra impressions per 100 GA4 eligible-cohort page views, reported with the source/timezone mismatch disclosed.
- Business metric: Doloc Adsterra revenue per complete UTC day. eCPM is a diagnostic, not the sole success measure.
- Pass candidate: primary metric improves at least 25% and revenue/day improves at least 15%, while all guardrails pass. Because the sample is small and sources differ, a Growth Analyst must make the final lifecycle recommendation; the UI artifact does not self-approve success.
- Guardrails: eligible-cohort engagement rate and average engagement time each decline no more than 10% relative to the comparable pre-period; mobile document overflow is zero; lab/field CLS p75 is below 0.10 where measurable; affiliate/store click classification remains unchanged; no provider/policy warning.
- Immediate stop: duplicate unit/script/container; Adult/Popunder/Smartlink/Social Bar appears; content or CTA is obscured; horizontal overflow; slot-attributable CLS above 0.10; disclosure absent/wrong locale; provider policy/security warning.
- Three-day stop: eligible-cohort engagement rate or average engagement time is down more than 15% on each of three complete days, provided daily eligible samples are reported rather than suppressed.
- Rollback: revert only the fixed implementation commit to its recorded Doloc baseline, regenerate all 168 URLs, and verify every page again has the provider snippet exactly once in its prior footer placement. Do not change the provider account or ad-unit ID during rollback.
