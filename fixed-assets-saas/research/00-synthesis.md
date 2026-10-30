# 00 — Synthesis: building a Bloomberg-class fixed-asset platform

*Research date: 2026-10-30. Eight parallel research agents, one per topic (reports 01–08), plus
independent checks run while building the prototype in `engine/` and `data/`.*

## Read this first: how much to trust this research

- **The agents could not reach most primary sources.** irs.gov, state revenue sites,
  pro.bloombergtax.com, Thomson Reuters, Wolters Kluwer, Capterra and most Big 4/firm sites were
  blocked by this environment's network policy, and the agents shared a web-search budget that
  ran out partway through each run. Many claims rest on search-result extracts or on knowledge
  current to mid-2026. Every report tags confidence (H/M/L or [S]/[K]) and marks gaps **VERIFY**.
- **Nothing here is tax advice or filing-ready content.** Rule rows in the engine carry
  `status = verify` until someone with signing authority checks them against the primary text.
- **Independently checked here:** the engine reproduces the published Pub 946 MACRS tables
  (3/5/7/10/15/20-year HY, mid-quarter Q1/Q4, 27.5-year MM). The 39-year table quirk the federal
  agent reported (Jan 2.461% published vs 2.457% by formula) is consistent with the arithmetic.
  The §179 figures from my seed data and the federal agent agree. The Postgres tenant isolation
  was tested on a real Postgres 16 instance.

## Bottom line

1. **There is room for a new entrant, but not on depreciation math alone.** Incumbents (Bloomberg,
   Thomson Reuters, Wolters Kluwer, Sage) cover federal books well. The gaps are elsewhere:
   - state conformity at scale;
   - a single record running from the book ledger to the personal property return;
   - provable migration from legacy systems;
   - open APIs;
   - true multi-tenant cloud for CPA firms (01, 02).
2. **The 2025 tax act (P.L. 119-21) is a forcing event.** It brought permanent 100% bonus for
   property acquired after Jan 19, 2025, new §168(n), and §179 at $2.5M/$4.0M (2026: $2.56M/$4.09M).
   States are carving out pieces of it, sometimes retroactively: FL HB 7031, NY on §168(n), PA Act 45,
   IL. Every customer has to re-model, and many of them by state (03, 06).
3. **Content is both the moat and the main liability.** Federal, 51 state regimes and thousands of
   assessor jurisdictions change every year. The product is as much a rules-maintenance pipeline,
   with citations, independent verification, regression packs and human sign-off, as it is software
   (`docs/swarm-playbook.md`).
4. **Don't try to be an e-file transmitter early.** Forms 4562, 4797 and the rest are attachments
   to a full return. Ship official-PDF output and workpapers, then push data into customers' return
   software. Local property-tax filing is the exception: there, owning the return is realistic
   (CA SDR XML, TX substantial-compliance renditions) (04, 07).
5. **The stack holds up, with one notable choice.** Lakebase (managed Postgres) is the system of
   record for edits; Delta/Unity Catalog holds rules, history, runs and audit. Cloudflare sits at
   the edge, and one Python engine serves both batch and interactive work (08).
6. **SOC 1 Type II gates enterprise sales** and takes 12–15 months of evidence. Start in phase 0 (02, 05, 08).

## Positioning (01, 02)

| Bet | Why it's defensible | First proof point |
|---|---|---|
| **One ledger, book → federal → state → local property tax** | Thomson Reuters sold its property-tax line; Bloomberg has no personal property returns; property-tax vendors lack depreciation depth. M&A history separated these two budgets. | CA 571-L + TX 50-144 from the same register that produces the 4562 |
| **Convert-and-prove migration** | Rebuilding historical depreciation is the biggest switching cost; each conversion grows a mapping library. | Recompute a Sage FA or Fixed Assets CS register to the penny, with a variance report |
| **Versioned, cited rules with a SOC 1-grade audit trail, sold as an ERP/tax-engine sidecar** | ERPs keep tax books but produce no forms; Bloomberg has no public API (a third party scrapes it). | Public API + "what changed for my assets" impact report on each rule release |

Watch: Netgain (cloud product for CPA firms launched Nov 2025), bundling by the tax-suite vendors,
and property-tax vendors moving into depreciation.

## Federal tax (03, 04)

| Item | 2025 | 2026 |
|---|---|---|
| §179 limit / phase-out / SUV cap | $2,500,000 / $4,000,000 / $31,300 | $2,560,000 / $4,090,000 / $32,000 |
| §280F yr-1 cap with bonus / without | $20,200 / $12,200 | $20,300 / $12,300 |
| Bonus, acquired after Jan 19, 2025 | 100% (permanent) | 100% |
| Bonus, acquired earlier (phase-down) | 40% | 20% |

All amounts come from search summaries of Rev. Procs. 2024-40, 2025-16, 2025-32 and 2026-15 —
VERIFY against the primary text.

Design consequences:
- Bonus and §168(n) key on **binding-contract and construction-start dates**, often per component.
  Most fixed-asset registers don't capture these dates, so the data model does.
- Many calculations are **entity-wide** (mid-quarter test, §179 limit). Calculation is two-phase,
  and one new Q4 asset can change every other asset's convention.
- Forms are filled by **semantic key**. The 2025 Form 4562 added lines 19h, 20e and 24c, which
  shifted the letters of existing lines.

## GAAP / IFRS (05)

- New standards in the window:
  - ASU 2025-06 (internal-use software; no more project stages).
  - ASU 2025-10 (government grants: reduce cost or defer income).
  - ASU 2024-03/2025-01 (expense disaggregation: depreciation by caption, from FY2027).
  - IFRS 18 (parallel requirement from 2027).
- The ASC 360 core is unchanged.
- IFRS is not "GAAP with different parameters." Components, impairment reversals, revaluation
  surplus and decommissioning remeasurement need IFRS-only state.
- Close model: OPEN → PRE_CLOSE → CLOSED → REOPENED.
  - Each close freezes an immutable snapshot.
  - Back-dated events post catch-up to the open period.
  - A re-close produces delta journal entries, never replacements.

## State (06)

- About 19 states conform to federal bonus, about 20 recompute without it, and about 6 partly
  decouple or spread the addback (corporate; best estimate, VERIFY). TX (margin tax on the 2007 Code)
  and OH (5/6 addback for individuals) are special cases.
- California moved its conformity date to 1/1/2025 (SB 711). That excludes P.L. 119-21. CA still
  never allows bonus, keeps §179 at $25k/$200k, and corporations use their own class-life (ADR)
  methods on FTB 3885.
- **§168(n) and §174A slipped past state addback statutes that name only "§168(k)".** Expect
  more decoupling bills.
- Model:
  - A state book is federal plus ordered overrides. It is materialized as its own book only where
    basis differs.
  - Spread rules live in an entity-level ledger.
  - Retroactive changes trigger detection of returns that may need amending.

## Local (07)

- 2026 exemptions jumped:
  - TX: $125k per location.
  - IN: $2M per county.
  - AZ: $500k.
  - WY: $75k per county.
  - WI repealed its tax in 2024.

  Many small filers drop out. "Certify no filing needed" becomes a feature.
- **Launch states:** CA (uniform form, SDR XML, machine-readable factors), TX (largest market;
  rule allows software-generated renditions), FL, GA, NC.
- NYC still disallows federal bonus. Other city taxes (Philadelphia, KY, Portland, Detroit, St.
  Louis/KC) are unconfirmed. These need extra books, not a separate engine.

## Platform (08)

See `docs/architecture.md`. Cost envelope:
- About $2.5k–$5k/month at 10 tenants and $15k–$35k at 500, before audit and identity costs.
- At MVP, audit and identity costs are the larger share.

## Accessibility (cross-cutting)

Accessibility is a legal and market requirement, not a nice-to-have.

- **Federal buyers:** Section 508 governs what they procure, and they expect a VPAT/ACR.
- **State and local governments:** DOJ's 2024 ADA Title II rule requires WCAG 2.1 AA for their web
  content and apps, including what they provide through vendors. The original deadlines were
  April 2026 for entities serving 50,000+ people and April 2027 for smaller ones (VERIFY any DOJ
  extension). Government asset books (GASB) and assessor-facing tools are in scope if we sell there.
- **Form output:** rendered forms are documents people must review and sign. Tagged PDF (PDF/UA)
  with a correct reading order belongs in forms QA.
- **Engineering target:** WCAG 2.2 AA in the app, with keyboard-complete grid editing.
  Spreadsheet-style grids are where accessibility usually breaks.

## Cross-cutting risks

1. **A wrong published rule.** One public table error erodes trust; the Oracle MACRS forum threads
   show this. Mitigation: four-eyes releases, independent verifier agents, golden packs, per-tenant
   impact diffs, and periods pinned at close.
2. **Missing source data.** Contract and construction dates, lien-date location, lease status, and
   assets expensed or fully depreciated but still taxable as personal property. Build intake to
   capture these, not just calculate.
3. **Retroactive law.** FL, NY and PA changed past years in 2025–26. Bitemporal storage plus
   amendment detection are required.
4. **Compliance obligations from day one:** §7216 consent before any cross-client analytics or ML,
   the FTC Safeguards Rule (WISP, MFA, encryption, incident notice), IRS Pub 4557.
5. **Lakebase maturity:** CDC feed in preview, private connectivity from Cloudflare unconfirmed.
   Fallback is Fargate + Tunnel.

## Top VERIFY items before any customer use

1. All 2025/2026 amounts above, against the Rev. Proc. text.
2. Notice 2026-11 (bonus procedures, the 40%/60% election scope) and Notice 2026-16 (§168(n)).
3. Whether bonus reduces basis for the mid-quarter 40% test (Reg. 1.168(d)-1(b)(4)).
4. Every cell of the 50-state conformity matrix marked [K] or VERIFY (06).
5. TX HB 9 / Prop 9 mechanics (per location, related-party aggregation); AZ enacting bill; MI HB 5878.
6. 2025 Form 4562/4797 line maps and AcroForm field names, per revision.
7. Bloomberg Tax Fixed Assets: SOC report scope, hosting, state forms actually produced, pricing.
8. Lakebase GA scope and private connectivity; whether Cloudflare Containers can be pinned to US locations.

## Report index

| # | Report | Words |
|---|---|---|
| 01 | Bloomberg Tax Fixed Assets deep dive | ~6,000 |
| 02 | Competitive landscape | ~6,100 |
| 03 | Federal tax depreciation & dispositions | ~10,100 |
| 04 | Federal forms & e-file | ~7,400 |
| 05 | GAAP / IFRS fixed assets & controls | ~9,400 |
| 06 | State conformity & forms | ~8,700 |
| 07 | Local property tax & local returns | ~8,600 |
| 08 | Platform architecture | ~7,500 |
