# 04 — Federal Forms and the Mechanics of Producing and Filing Them

*Research swarm, fixed-asset SaaS (benchmark: Bloomberg Tax Fixed Assets). Prepared 2026-10-30.*

---

## How far this was verified (read first)

- **Live checking was limited.** This session's network allowlist blocks `www.irs.gov` and its subdomains, so no IRS page could be fetched directly. The swarm's shared web-search budget also ran out after two IRS-scoped queries.
- **What was checked live** (from search-engine extracts of IRS pages, marked **[Verified-snippet]**):
  - the 2025 Instructions for Form 4562 (dated Feb 11, 2026) and their What's New items: new lines 19h/20e for 50-year property, new line 24c for aircraft, the 40%/60% election in place of 100% bonus, and 100% bonus for §168(n) qualified production property (QPP);
  - the existence of a 2026 draft Form 4562 with a new aircraft qualified-business-use question.
- **Everything else** comes from domain knowledge current to mid-2026. Confidence labels:
  - **[H]** high: long-stable structure;
  - **[M]** medium: likely right, but line numbers or revisions may have moved;
  - **[L]** low.
- **VERIFY** marks a fact to confirm against the IRS PDF before engineering depends on it.
- **IRS URLs** in Sources are the canonical locations, but none of them were opened in this session.
- **Action for the team:** allow `irs.gov` in the research environment, then run one pass over the VERIFY flags. Most of them are mechanical (line numbers and revision dates).

---

## Executive summary

1. **Every federal form in scope is an attachment to an income-tax return, not a standalone filing.** Forms 4562, 4797, 4684, 8824, 3115, 8594, 3468, 4255, 3800, 7205, 8908, 4626, 6251, 8990, 1125-A and Schedules M-1/M-3/K-1 all travel inside a 1120, 1120-S, 1065, 1040 or 1041 submission. MeF accepts them only as part of a complete return built by software that passed the Assurance Testing System (ATS) for that return family and tax year. **Our product cannot e-file a Form 4562 by itself.** Its federal output reaches the IRS through return-compliance software, either the customer's or a partner's.
2. **E-filing is effectively mandatory for our customers.** T.D. 9972 (Feb 2023) lowered the e-file threshold to 10 returns in aggregate for corporations (tax years ending on or after Dec 31, 2023) and for partnerships (returns required to be filed on or after Jan 1, 2024). Partnerships with more than 100 partners must e-file regardless **[H]**. Paper/PDF output is therefore mainly for review, workpapers, client delivery and the occasional paper filer. The real filing path is data handed to tax software.
3. **P.L. 119-21 (OBBBA, July 4, 2025) changed the inputs more than the forms.** The engine needs these fields and rules:
   - 100% bonus restored for property acquired after Jan 19, 2025, with an election to use 40%/60% instead in the first tax year ending after that date **[Verified-snippet]**;
   - new §168(n) 100% allowance for QPP placed in service after July 4, 2025, with construction begun after Jan 19, 2025 **[Verified-snippet]**;
   - §179 limits of $2,500,000 / $4,000,000 for 2025 **[H]**, indexed to $2,560,000 / $4,090,000 for 2026 under Rev. Proc. 2025-32 **[M, VERIFY]**;
   - §174A domestic R&E expensing **[H]**;
   - EBITDA-based §163(j) adjusted taxable income again for tax years beginning after 2024 **[H]**;
   - §179D ends for construction beginning after June 30, 2026, and §45L ends for homes acquired after June 30, 2026 **[H]**.

   On the 2025 Form 4562 the visible changes are lines 19h/20e (50-year property, such as railroad grading and tunnel bores) and line 24c (aircraft) **[Verified-snippet]**.
4. **Form layouts change every year and sometimes mid-cycle.** Examples: the new 4562 lines in 2025, the post-IRA restructuring of 3468, 4255 and 3800, and IRS correction notices for past instructions such as the 2021–2023 Form 4562 line 5 correction **[Verified-snippet: title]**. The product therefore needs a versioned form-definition model: form → revision → line → field → calc rule → PDF field map → MeF XPath. Hard-coded templates will not keep up.
5. **Recommended filing path:**
   - **Phase 1:** compute everything and render official IRS PDFs with attached statements.
   - **Phase 2:** integrate with the major compliance suites, sending schema-validated data or XML fragments, and use the IRS Software Developer role mainly to get MeF schemas and business rules.
   - **Phase 3:** own MeF transmitter/ATS status, only if the product grows into full-return preparation.
6. **The heaviest compliance obligations are not on the forms.** They are:
   - **IRC §7216**: software developers count as "tax return preparers" for disclosure and use, which limits analytics and ML on customer data without consent;
   - **the FTC Safeguards Rule** (16 CFR 314), directly or flowed down from CPA-firm customers;
   - **IRS e-file Provider suitability and security standards** (Pub 3112, 4164, 1345, 4557/5708, Security Summit), if the product takes any e-file role.

---

## Part A — Forms content

General conventions for all forms:

- amounts are whole dollars;
- each form carries an *Attachment Sequence No.* that sets paper assembly order;
- **a separate Form 4562 is filed for each business or activity** **[H]**, so a "form instance" is keyed by entity × tax year × activity, not entity × year.

### A1. Form 4562 — Depreciation and Amortization (Including Information on Listed Property)

- **Revision:** 2025 (annual); instructions dated Feb 11, 2026 **[Verified-snippet]**. A 2026 draft exists at `irs-dft/f4562--dft.pdf` **[Verified-snippet]**.
- **Attachment sequence:** No. 179 **[H]**.
- **Entities:** all (1040 Schedules C/E/F, 8829 and employee vehicles; 1065; 1120; 1120-S; 1041; 990-T).
- **Who must file** **[H]**:
  - anyone claiming depreciation on property placed in service during the year;
  - anyone claiming a §179 deduction, including a carryover;
  - anyone claiming depreciation on any listed property, regardless of when placed in service;
  - anyone with amortization that begins during the year;
  - any corporation (other than an S corporation) claiming any depreciation or amortization.
- **2025 What's New** **[Verified-snippet]**:
  - 100% special depreciation allowance (SDA) for qualified property acquired after Jan 19, 2025;
  - election to take 40% instead (60% for long-production-period property and certain aircraft) for the first tax year ending after Jan 19, 2025;
  - 100% SDA for §168(n) QPP placed in service after July 4, 2025, with construction begun or property acquired after Jan 19, 2025;
  - new line 19h (GDS) and line 20e (ADS) for 50-year property (2024 instructions required an attached statement instead);
  - new line 24c aircraft check boxes (own/lease/charter).
- **2026 draft:** adds a question on whether at least 25% of aircraft use is qualified business use not described in §280F(d)(6)(C)(i) **[Verified-snippet]**.
- **Line-letter shift (VERIFY):** adding 19h almost certainly moves residential rental and nonresidential real property to 19i/19j. The PDF field map and MeF XPaths for those lines must be rebuilt from scratch, not carried forward.

| Part / line | Content | Engine data fields |
|---|---|---|
| **Part I — §179** | | |
| 1 | Maximum amount ($2,500,000 for 2025) | Statutory parameter table by tax year **[H]** |
| 2 | Total cost of §179 property placed in service | Σ cost of §179-eligible assets placed in service (PIS) this year (including listed) |
| 3 | Threshold before reduction ($4,000,000) | Parameter |
| 4 | Reduction in limitation | max(0, L2 − L3) |
| 5 | Dollar limitation for tax year | L1 − L4, with married-filing-separately and short-year handling (an IRS correction notice was issued for line 5 in 2021–2023 instructions) |
| 6 (a)(b)(c) | Description; cost (business use only); elected cost | Asset description, business-use cost, §179 elected amount. Only 2 rows on the face, so overflow goes to a statement |
| 7 | Listed property elected cost (from line 29) | Σ §179 on listed assets |
| 8–9 | Total elected cost; tentative deduction (smaller of L5 or L8) | Derived |
| 10 | Carryover of disallowed deduction from prior year | Prior-year L13 (persisted per taxpayer) |
| 11 | Business income limitation | Taxable income from active trade/business (taxpayer-supplied or from return software). Partnerships and S corporations apply it at both entity and owner level |
| 12 | §179 deduction | min(L9 + L10, L11) |
| 13 | Carryover to next year | L9 + L10 − L12 |
| **Part II** | | |
| 14 | SDA for qualified property (other than listed), including 100%/40%/60% and specified plants; QPP probably also here (VERIFY) | Per-asset bonus %, acquisition date, binding-contract date, election flags by class |
| 15 | Property subject to §168(f)(1) election (e.g., unit-of-production) | Method code; period depreciation |
| 16 | Other depreciation (including ACRS, §167, income forecast) | Legacy/non-MACRS methods |
| **Part III — MACRS** | | |
| 17 | MACRS deductions for assets PIS in tax years beginning before 2025 | Σ current-year depreciation on prior-year MACRS assets |
| 18 | General asset account (GAA) election check box (§168(i)(4)) | GAA flag per asset pool |
| 19a–19g | GDS 3-, 5-, 7-, 10-, 15-, 20- and 25-year: columns (b) month/year PIS, (c) basis, (d) recovery period, (e) convention, (f) method, (g) deduction | Basis net of §179/bonus/credit reductions, class, convention (HY/MQ/MM), method (200DB/150DB/SL) |
| 19h | **50-year (new 2025)** | as above |
| 19i–19j (VERIFY) | Residential rental (27.5 years, MM, SL); nonresidential real (39 years, MM, SL) | as above |
| 20a–20e | ADS: class life; 12-year; 30-year; 40-year; **50-year (new 2025)** | ADS flag (required for ERPTB/farming elections under §163(j), tax-exempt use, etc.) |
| **Part IV** | | |
| 21 | Listed property (from line 28) | |
| 22 | Total: lines 12, 14–17, 19 and 20 column (g), and 21. Partnerships and S corporations exclude §179 | Routed to return lines (1120 L20, 1065 L16a, 1120-S L14, Sch C L13) |
| 23 | Basis attributable to §263A costs for assets PIS this year | §263A-capitalized portion |
| **Part V — Listed property** | | |
| 24a/24b | Evidence to support business use? Written? | Substantiation flags |
| 24c | **Aircraft (new 2025)** | Aircraft own/lease/charter flags |
| 25 | SDA for listed property used more than 50% | Bonus on listed property |
| 26 / 27 | Property used more than 50% / 50% or less: (a) type, (b) date PIS, (c) business %, (d) cost, (e) basis, (f) recovery period, (g) method/convention, (h) depreciation, (i) elected §179 | Per-vehicle data; §280F caps (2025 caps per Rev. Proc. 2025-16 — VERIFY values) |
| 28–29 | Totals of column (h) → L21; column (i) → L7 | |
| 30–36 | Vehicle use: business, commuting and personal miles; availability questions | Mileage log fields per vehicle |
| 37–41 | Employer questions (written policies, >5 vehicles, demonstrator use) | Entity-level policy flags |
| **Part VI — Amortization** | | |
| 42 | Costs beginning this year: (a) description, (b) start date, (c) amount, (d) **code section**, (e) period/%, (f) current amortization | Code section (§195, 248, 709, 197, 174 foreign 15-year, **174A** elective domestic amortization, 59(e), 169, …) |
| 43 | Amortization of costs that began before 2025 | |
| 44 | Total → "Other deductions" | |

**Statements and elections the engine must produce** **[H unless noted]**:
- §168(k)(7) election out of bonus, per class per year;
- the transition election to use 40%/60% instead of 100% (statute cite VERIFY);
- §168(k)(5) specified plants;
- §168(n) QPP election (interim guidance reportedly Notice 2026-16, **VERIFY**);
- GAA election (§1.168(i)-1(l));
- §1.168(i)-6(i) election out of carryover/excess-basis treatment for like-kind exchanges and involuntary conversions;
- §179 election and revocation;
- de minimis safe-harbor election (§1.263(a)-1(f));
- §1.263(a)-3(n) election to capitalize repair and maintenance costs;
- §174A(c) amortization election and the transition statements under Rev. Proc. 2025-28 **[M]**;
- overflow statements for lines 6, 19, 20, 26, 27 and 42.

### A2. Form 4797 — Sales of Business Property

- **Revision:** 2025 (annual). **Attachment sequence:** No. 27 **[H]**.
- **Entities:** all.
- **OBBBA impact:** no structural change confirmed. Watch for QPP recapture: §168(n) property reportedly gets §1245-type recapture plus 10-year change-in-use recapture (**VERIFY** statute text and whether a new 4797 line was added).

| Part / lines | Content | Engine data fields |
|---|---|---|
| I, 1a | Gross proceeds reported on 1099-B/1099-S that are included on lines 2, 10 or 20 | Proceeds and 1099 flag per disposition |
| I, 1b / 1c | Gain / loss from **partial dispositions of MACRS assets** included on lines 2, 10 (and 24 for gains) | Partial-disposition flag (§1.168(i)-8) |
| I, 2 (a)–(g) | §1231 property held more than 1 year: description, acquired, sold, gross sales price, depreciation allowed or allowable, cost plus improvements and sale expense, gain/loss | Holding period, accumulated depreciation (allowed or allowable), adjusted basis, expenses of sale |
| I, 3 | Gain from Form 4684 line 39 | Link to 4684 |
| I, 4 | §1231 gain from installment sales (Form 6252) | Installment flag |
| I, 5 | §1231 gain/loss from like-kind exchanges (Form 8824) | Link to 8824 |
| I, 6 | Gain from line 32 (non-casualty) | Link to Part III |
| I, 7–9 | Net §1231; nonrecaptured net §1231 losses (5-year lookback) | Prior-5-year §1231 loss history per taxpayer (individuals and corporations; pass-throughs report on K) |
| II, 10 | Ordinary gains/losses (property held ≤1 year, etc.) | |
| II, 11–17 | Loss from L7; gain from L7/L8; gain from L31 (recapture); 4684 lines 31 and 38a; 6252 ordinary; 8824 ordinary (L16); total | |
| III, 19–24 | Per property A–D: description, dates, gross sales price (20), cost plus sale expense (21), depreciation/depletion allowed or allowable (22), adjusted basis (23), total gain (24) | 4 columns per page, so additional pages are needed |
| III, 25a/b | §1245: depreciation; recapture = smaller of L24 or 25a | Includes §179, bonus, §179D/§45L/§50(c) basis reductions treated as depreciation for recapture where applicable (VERIFY per provision) |
| III, 26a–g | §1250: additional depreciation after 1975 (26a), applicable % (26b), 26c, pre-1976 additional depreciation (26d/e), **§291 amount, corporations only (26f)**, total (26g) | Straight-line vs accelerated depreciation history; §291 = 20% × (as-if-§1245 recapture − §1250 recapture) |
| III, 27–29 | §1252 farmland; §1254 IDC/mining/depletion; §1255 §126 cost-sharing | Specialty asset attributes |
| III, 30–32 | Total gains; total recapture (→ L13); remainder (casualty portion → 4684 L33, else → L6) | |
| IV, 33–35 | §179 / §280F(b)(2) recapture when business use drops to 50% or below: prior §179 or depreciation, recomputed depreciation (ADS), recapture | Business-use % history per year |

- **Pass-through outputs:** unrecaptured §1250 gain (1065 K-1 box 9c; 1120-S K-1 box 8c) **[H]**.
- **Individual outputs:** Schedule D unrecaptured §1250 worksheet.
- **Corporate output:** §291 amount.

### A3. Form 4684 — Casualties and Thefts (business: Section B)

- **Revision:** 2025 (annual). **Attachment sequence:** No. 26 **[H]**.
- **OBBBA:** made the personal casualty limitation (Section A) permanent and extended it to certain state-declared disasters **[M]**. Section B (business property) is unaffected.

| Lines | Content | Engine data fields |
|---|---|---|
| 19 | Property A–D: type, location (city/state/ZIP), date acquired. FEMA disaster declaration number (DR-/EM-) where applicable (VERIFY placement) | Asset ID, location, disaster code |
| 20 | Cost or adjusted basis | Adjusted tax basis at date of casualty |
| 21 | Insurance or other reimbursement (whether or not a claim was filed) | Expected or received reimbursement |
| 22 | Gain if L21 > L20 | |
| 23–25 | FMV before / after / decline | Appraisal values |
| 26 | Smaller of L20 or L25; **if totally destroyed, use L20** (§1.165-7(b)(1)) | Total-destruction flag |
| 27–28 | Loss net of reimbursement; total | |
| 29–32 | Held ≤1 year: losses by (b)(i) trade/business/rental/royalty vs (b)(ii) income-producing; gains (c); L31 → 4797 L14 | Holding period, use category |
| 33–39 | Held >1 year: L33 casualty gains from 4797 L32 (depreciation recapture first); L38a → 4797 L14; L39 → 4797 L3 | |
| Sec. C / D | Ponzi safe harbor (Rev. Proc. 2009-20); election to deduct a disaster loss in the prior year (§165(i)) | Election flags |

**Related obligations:**
- §1033 deferral election (statement), with replacement-property tracking and the replacement-period deadline;
- basis of replacement property and its §1.168(i)-6 carryover/excess split;
- write-off of the casualty-loss basis from the asset register (partial or total disposition).

### A4. Form 8824 — Like-Kind Exchanges

- **Revision:** 2025 (annual). **Attachment sequence:** No. 109 (VERIFY).
- **Scope:** real property only since 2018, so equipment trade-ins are taxable sales and go to 4797 **[H]**.

| Lines | Content | Engine data fields |
|---|---|---|
| 1–7 | Descriptions given/received; date originally acquired; date transferred; **identification date (45-day)**; date received (**180-day**); related party? | Exchange record with dates; deadline validation |
| 8–11 | Related-party info and the 2-year disposition test and exceptions | Related-party ID, subsequent-disposition monitoring |
| 12–14 | FMV and adjusted basis of *other* (non-like-kind) property given up; gain/loss | Boot given |
| 15 | Cash received + FMV of other property received + net liabilities assumed by the other party, less exchange expenses | Boot received, liabilities relieved/assumed, expenses |
| 16–19 | FMV of like-kind property received; total; adjusted basis given up + net paid + expenses; realized gain | |
| 20–23 | Smaller of L15 or L19; **ordinary recapture (→ 4797 L16)**; remaining gain; recognized gain | Recapture computed as in 4797 Part III |
| 24–25 | Deferred gain; **basis of like-kind property received** = L18 + L23 − L15 | Replacement asset(s) created in register: carryover basis keeps the old schedule; excess basis is a new asset (§1.168(i)-6) |
| Part IV | §1043 conflict-of-interest sales | Rare; low priority |

Multi-asset exchanges (exchange groups, §1.1031(j)-1) require an attached statement in place of the face lines.

### A5. Form 3115 — Application for Change in Accounting Method

- **Revision:** Rev. December 2022 **[H]**. **Entities:** all.
- **Automatic-change list:** Rev. Proc. 2025-23, superseding 2023-24 **[M, VERIFY]**.
- **Procedures:** Rev. Proc. 2015-13 as modified **[H]**.
- **§174A:** Rev. Proc. 2025-28 provides the automatic change and transition statements in lieu of Form 3115 for the first year **[M]**.
- **Structure:**
  - Part I: automatic change, with the designated change number (DCN) on line 1a;
  - Part II: information for all requests (year of change, exam/appeals status, prior changes, audit protection);
  - Part III: advance consent;
  - Part IV: §481(a) adjustment (line numbers VERIFY);
  - Schedules A (overall method), B (advance payments), C (LIFO), D (long-term contracts/inventories/§263A) and **E (depreciation/amortization)**.

| Data required (Schedule E and Part IV) | Engine fields |
|---|---|
| Item being changed; present vs proposed classification, asset class (Rev. Proc. 87-56), recovery period, method, convention, PIS year | Dual-track asset attributes: "as filed" vs "correct" |
| Whether elections apply (§179, §168(k), §168(f)(1), GAA, CLADR) | Election history |
| Facts/law supporting the proposed classification (statement) | Cost-segregation study references |
| **§481(a) adjustment** = depreciation allowed or allowable under present method − amount allowable under proposed method, through the start of the year of change | Full depreciation recomputation per asset for every prior year |
| Spread: positive over 4 years; negative in 1 year; under $50,000 de minimis or "eligible acquisition transaction" elections can use 1 year **[H]** | §481(a) schedule tracker (year 1 of 4, …) |

**Depreciation DCNs:**
- DCN **7**: impermissible-to-permissible depreciation, e.g., missed depreciation or a cost-segregation catch-up **[H]**;
- DCN **8**: permissible-to-permissible **[M]**;
- DCN **184**: repairs **[M]**;
- disposition and partial-disposition DCNs (e.g., 196/205) **[L, VERIFY]**.

**Filing:** attach the original to a timely filed return (including extensions) and send a duplicate to the IRS (Ogden; fax option VERIFY). MeF treatment of Form 3115 (XML vs PDF attachment) also VERIFY.

### A6. Form 8594 — Asset Acquisition Statement Under Section 1060

- **Revision:** Rev. November 2021 **[H]**.
- **Filers:** both buyer and seller, each with its own return for the year of sale (not used for §338 elections, which use Form 8883).
- **Form content:**
  - Part I: other party's name, TIN and address; date of sale; total sales price (consideration);
  - Part II: aggregate FMV and allocation for **Classes I–VII**; line 5 (allocation agreed in a written contract?); line 6 (covenant, license, lease, employment or management agreement? attach a statement with maximum consideration);
  - Part III: supplemental statement for later adjustments (tax year and form of the original filing, old allocation, increase/decrease, redetermined amount, reason).

| Class (Reg. §1.338-6) | Content | Asset-register consequence |
|---|---|---|
| I | Cash, demand deposits | None |
| II | Actively traded personal property, CDs, foreign currency, government securities | None |
| III | Mark-to-market assets, accounts receivable | None |
| IV | Inventory | Inventory basis (1125-A) |
| V | All other assets: equipment, buildings, land, furniture | **New MACRS assets** (buyer); 4797 Part III recapture (seller) |
| VI | §197 intangibles except goodwill and going concern | 15-year amortization (4562 Part VI, code 197) |
| VII | Goodwill and going-concern value | 15-year §197 amortization |

The engine needs purchase-price allocation records linked to asset IDs, so Class V and VI totals reconcile to the register and to Form 8594.

### A7. Forms 3468 / 4255 / 3800 — Investment Credit, Recapture, General Business Credit

**Form 3468 (2025, annual)**
- Restructured since 2023 for IRA credits. It has a taxpayer/election section, with §6417 elective-payment and §6418 transfer registration numbers, and facility-level parts for the §47 rehabilitation, §48 energy, §48A, §48B, §48C, §48D advanced manufacturing and §48E clean electricity credits. Part numbering **VERIFY**.
- OBBBA overlays **[M]**:
  - §48E wind/solar termination for facilities placed in service after 2027, unless construction began by July 4, 2026;
  - prohibited-foreign-entity / material-assistance rules;
  - §48D rate raised to 35% for property placed in service after 2025.
- Engine fields: qualified investment / eligible basis per facility; PIS and construction-start dates; prevailing-wage and apprenticeship (PWA) compliance; domestic content; energy community; low-income bonus; registration number; facility ID/location; FEOC certification.
- **Basis effects (§50(c))** **[H for the principles]**:
  - basis is reduced by 100% of the rehabilitation credit and by **50%** of energy-type credits (§50(c)(3));
  - the reduction percentages for §48C/§48D are VERIFY;
  - the asset register must reduce depreciable basis *before* MACRS and bonus (4562 L14 and L19 columns).

**Form 4255 (Recapture of Investment Credit)**
- Revised for IRA. It covers recapture plus excessive-payment / §6417 amounts. Revision VERIFY.
- Recapture follows the §50(a) schedule: 100%, 80%, 60%, 40% and 20% for disposition or cessation in years 1 through 5 **[H]**.
- **Basis is increased** by the recapture amount, or 50% of it for energy credits (§50(c)(2)) **[H]**.
- Engine fields: credit claimed by component, PIS date, event date and type, recapture %, basis add-back.

**Form 3800 (2025)**
- Receives 3468, 8908 and other credits in Part III, with columns for pass-through EIN, registration number and elective-payment/transfer amounts.
- Line mapping (e.g., 1a/4a for 3468, 1p for 8908) **VERIFY**.
- Our engine supplies only the source-credit amounts. The GBC limitation needs whole-return data and stays in return software.

### A8. Form 7205 — Energy Efficient Commercial Buildings Deduction (§179D)

- **Revision:** VERIFY (first issued Dec 2022/Jan 2023).
- **Entities:** building owners; designers allocated the deduction by government or tax-exempt owners.
- **Engine fields:** building and property address; EEBP cost basis; PIS date; **construction-begin date** (OBBBA: none allowed for construction beginning after June 30, 2026 **[H]**); square footage; certified energy-savings % versus the reference ASHRAE 90.1 standard; PWA flag (the 5× rate); inflation-adjusted per-square-foot rates by year (VERIFY 2025/2026 values); prior §179D taken in the lookback window (3 years, 4 years for some allocations, **VERIFY**); designer allocation data; §179D(f) retrofit-plan alternative.
- **Basis reduction (§179D(e))** **[H]**: reduce the depreciable basis of the building property by the deduction.

### A9. Form 8908 — Energy Efficient Home Credit (§45L)

- **Revision:** VERIFY.
- **Credit amounts** **[H]**: $2,500 (Energy Star) and $5,000 (zero-energy-ready) per home; multifamily $500/$1,000 without PWA and $2,500/$5,000 with PWA.
- **OBBBA:** no credit for homes **acquired after June 30, 2026** **[H]**.
- **Engine fields:** home counts by category, certification, acquisition (sale/lease) date, PWA.
- **Basis:** reduced by the credit (§45L(e)) **[H]**. For builders that hits inventory/COGS; for build-to-rent owners it hits depreciable basis.
- The credit flows to Form 3800.

### A10. Form 4626 (CAMT) and Form 6251 (individual AMT) — depreciation lines

**Form 4626 (2025, corporations)**
- Covers applicable-corporation status (3-year average AFSI above $1B, or the foreign-parented test) and the 15% minimum tax.
- **AFSI depreciation adjustment (§56A(c)(13)):** remove book depreciation on §168 property, substitute tax depreciation including bonus, and adjust dispositions so gain/loss uses AFSI basis that reflects tax depreciation **[H on principle]**.
- Guidance trail: Notices 2023-7, 2023-64, 2024-10, 2024-33, 2024-47 and 2024-66; Sept 2024 proposed regulations (Prop. Reg. §1.56A-15 for §168 property); late-2025 interim notices (2025-46 / 2025-49) **[M, VERIFY]**. Exact Form 4626 line numbers **VERIFY**.
- Engine fields: per-asset GAAP (covered book) depreciation, tax depreciation, AFSI basis, cumulative book-tax difference, purchase-accounting step-ups, impairments, and 3 or more years of history.

**Form 6251 (2025, individuals, including pass-through owners)**
- Line **2k** (disposition of property, AMT vs regular gain/loss) and line **2l** (post-1986 depreciation, regular vs AMT) **[H]**.
- AMT rules: 150% DB instead of 200% DB for 3–10-year property not taking bonus; no adjustment for bonus property (unless elected out) or §179.
- Pass-through feeds: 1065 K-1 box 17 code A (post-1986 depreciation adjustment) and code B (adjusted gain/loss); 1120-S K-1 box 15 codes A and B **[H/M]**.

### A11. Schedules M-1 and M-3, and Form 1125-A

**Schedule M-1 depreciation lines** **[H]**
- 1120: line **5a** (book depreciation not deducted on the return) and **8a** (tax depreciation not charged to book).
- 1065: lines **4a** and **7a**.
- 1120-S: lines **3a** and **6a**.

**Schedule M-3 (Form 1120)** (Rev. December 2019, VERIFY)
- **Part II line 23 (dispositions)** **[M]**:
  - 23a: book gain/loss;
  - 23b/23c: Schedule D gross gains/losses;
  - 23d: **Form 4797 line 17 net gain/loss**;
  - 23e: abandonment losses;
  - 23f: worthless stock;
  - 23g: other.
- **Part III:** line **31 Depreciation** **[M, VERIFY]**, plus the goodwill, other-amortization and depletion lines (about 23–30), each split into columns:
  - (a) expense per income statement;
  - (b) temporary difference;
  - (c) permanent difference;
  - (d) deduction per return.
- The 1065 and 1120-S M-3 versions have parallel lines; the 1065 version has a separate §179 line (VERIFY).
- **Form 8916-A** splits COGS differences, including a depreciation line (VERIFY letter).

**Form 1125-A (Rev. November 2018, VERIFY)**
- Line 4: additional §263A costs (statement).
- Line 5: other costs (statement); production depreciation lands here or on line 4.
- Line 9: inventory-method questions.
- **Interplay:** total depreciation on 4562 line 22 = amount in COGS (1125-A) + amount elsewhere + the main depreciation line (1120 line 20 "Depreciation from Form 4562 not claimed on Form 1125-A or elsewhere"; 1065 lines 16a–c; 1120-S line 14) **[H]**.
- The engine must allocate depreciation by cost center (production vs SG&A) and by §263A capitalization.

### A12. §179 and depreciation items on pass-through K-1s

| Item | 1065 K-1 (2025) | 1120-S K-1 (2025) |
|---|---|---|
| §179 deduction (separately stated; not in 4562 L22) | **Box 12** **[H]** | **Box 11** **[H]** |
| Dispositions of property with §179 deductions (description, dates, sales price, cost/basis, depreciation allowed, §179 passed through — needed for owner-level gain, §1.179-1(f)) | Box 20 **code L** **[M, VERIFY]** | Box 17 **code K** **[M, VERIFY]** |
| Recapture of §179 (business use ≤50%) | Box 20 **code M** **[M]** | Box 17 **code L** **[M]** |
| Unrecaptured §1250 gain | Box 9c **[H]** | Box 8c **[H]** |
| AMT depreciation / adjusted gain | Box 17 A/B | Box 15 A/B |
| Investment-credit basis / recapture | Box 20 E (energy basis) / H (recapture) **[M]** | Box 17 D / G **[M]** |
| Section 743(b) adjustments (partnerships) | Partner-level step-up depreciation (statement; code VERIFY) | n/a |

**Owner-level mechanics:**
- partners and shareholders apply the §179 dollar and income limits on their own Form 4562;
- the entity does **not** carry forward a disallowed §179 amount that it already passed through;
- the entity reduces asset basis by the full §179 elected, even if an owner cannot use it.

The engine must keep per-asset §179 allocations by owner to generate code L/K statements on later dispositions.

### A13. Form 8990 — Limitation on Business Interest Expense (§163(j))

- **Revision:** OBBBA-updated revision for tax years beginning after 2024 **VERIFY**.
- **Filers:** taxpayers with business interest expense not exempt under the small-business exemption ($31M gross receipts for 2025, VERIFY 2026); pass-throughs also complete Schedules A/B.
- **ATI computation (Part I):**
  - starts with tentative taxable income;
  - adds non-business items, business interest expense, NOL, §199A, and the **depreciation/amortization/depletion addback**, which was absent for 2022–2024 and is restored for tax years beginning after Dec 31, 2024 **[H statute; line number VERIFY]**;
  - subtracts business interest income, floor-plan items, and the "disposition" reductions under §1.163(j)-1(b)(1)(ii)(C)–(E). These recapture prior depreciation addbacks when property, member stock or partnership interests are sold. Whether that rule is extended to post-2024 depreciation is VERIFY.
- **OBBBA, tax years beginning after 2025:** subpart F / GILTI (net CFC tested income) inclusions are excluded from ATI, and an ordering rule applies to capitalized interest **[M]**.
- **Engine fields:**
  - depreciation, amortization and depletion by year and trade/business, including amounts capitalized into inventory (treatment VERIFY);
  - excepted-trade segregation (an electing real property trade or business or farming business must use ADS for real property and QIP, and loses bonus on those assets);
  - per-asset "addback-period depreciation" history for the disposition adjustment.

---

## Part B — Production and filing

### B1. Paper and PDF: Pub 1167 substitute-form rules

- **Pub 1167** (*General Rules and Specifications for Substitute Forms and Schedules*; current revision VERIFY) governs any form not printed by the IRS, including software-generated forms.
- **Core rules** **[M]**:
  - a substitute must match the official form in format, line numbers, captions, sequence, form number, title, tax year/revision and OMB number;
  - same page size, legible type, black ink for non-scannable forms;
  - no added or deleted lines except as permitted;
  - continuation statements must mirror the form's column structure and carry the taxpayer name and TIN;
  - a substitute cannot omit lines that apply to the taxpayer.
- **Approval** **[L–M]**:
  - computer-generated substitutes of income-tax forms that conform generally do not need pre-approval;
  - the IRS Substitute Forms Program reviews submissions on request;
  - certain families have mandatory or special regimes: the 94X employment forms; W-2/W-3 (Pub 1141); 1099 Copy A (Pub 1179);
  - **VERIFY** the exact list and any requirement for software developers to submit samples.
- **Barcodes:** none are needed for the business attachment forms in scope. Pub 1167's barcode and OCR scan-line requirements apply to scannable forms and vouchers (e.g., 1040-ES/1040-V) **[M, VERIFY]**.
- **Layout tolerance:** dimensional tolerances and allowed scaling are specified in Pub 1167 **VERIFY**. Scaling should be avoided; render at 100%.
- **Filling IRS PDFs is allowed and is the lowest-risk route.** IRS forms are U.S. government works (17 U.S.C. §105, no copyright), and IRS fill-in PDFs are official forms. An official PDF filled by software (AcroForm fields set, then flattened) is the official form, not a "substitute" **[M]**.
- **Practical cautions:**
  - field names (e.g., `topmostSubform[0].Page1[0].f1_1[0]`) change between revisions, so each new revision needs a regenerated field map;
  - drafts (`irs-dft`) are watermarked and **must not be filed**;
  - overflow rows (4562 L6/L19/L26/L42; 4797 L2 and the A–D columns in Part III) require attached statements;
  - re-validate whenever the IRS reposts a corrected PDF.

### B2. Modernized e-File (MeF)

**What gets transmitted** **[H]**
- A *submission* is a ZIP containing a manifest, the return XML (ReturnHeader + ReturnData with one XML document per form or schedule, e.g., `IRS4562`, `IRS4797`, `IRS8824`) and PDF binary attachments.
- Multiple Form 4562 instances are allowed, one per activity.
- Submission IDs are 20 characters: EFIN (6) + year and Julian day (7) + 7 alphanumeric characters.
- Elections and statements go into dependency schemas (general explanation/election statements) or PDF attachments when no XML schema exists.

**Schemas and business rules** **[M–H]**
- The IRS publishes release memos and the list of schema versions publicly (e.g., "1120/1120-S/1065 TY2025 vX.Y").
- The **schema packages and business rules** are distributed through the **e-Services Secure Object Repository (SOR)** to holders of an e-file application with the **Software Developer** (or Transmitter) role.
- Business rules carry IDs such as `F4562-xxx` (form-level), `R0000-xxx` (return-level) and `X0000-xxx` (XML validation). Each has a severity: Reject, Reject and Stop, or Alert.
- MeF accepts the current and generally two prior tax years. Each tax year has its own schema version, and schemas are revised during the filing season.

**Pub 4164** (*MeF Guide for Software Developers and Transmitters*; current processing-year edition, VERIFY) **[M]**:
- transmission envelope and SOAP/MTOM;
- submission composition and naming;
- binary attachment rules: PDF only, no encryption or scripts, size limits VERIFY;
- ack format;
- duplicate-submission handling;
- IFA vs A2A;
- testing and communication requirements.

**Pub 4163** covers e-file provider rules for business returns. **Pub 1345** covers individual returns.

**Assurance Testing System (ATS)** **[M–H]**
- Before production, a Software Developer must pass ATS for each return family and tax year it supports, using the IRS test scenarios:
  - **Pub 5078** for business submissions (1120, 1120-S, 1065, 1041, 990, 7004, etc.);
  - **Pub 1436** for 1040.
- Passing yields the yearly **Software ID** carried in ReturnHeader.
- Transmitters must also pass a **communication test**.
- ATS for a new tax year typically opens in November.
- **Key point:** the scenarios are full returns. A product that produces only Form 4562 has nothing that can pass ATS on its own.

**e-file application, roles and identifiers** **[H unless noted]**
- **Form 8633** (the paper application) is obsolete. The application is made online in e-Services after identity proofing (ID.me/Login.gov). Pub 3112 governs.
- Provider options:
  - Electronic Return Originator (ERO);
  - Intermediate Service Provider;
  - **Transmitter**;
  - **Software Developer**;
  - Reporting Agent;
  - Online Provider;
  - Large Taxpayer.
- Principals and Responsible Officials must pass suitability checks (tax compliance, criminal background). Fingerprinting applies unless exempt: attorneys, CPAs, EAs and certain officers. Whether a Software-Developer-only application needs fingerprints is VERIFY.
- **EFIN:** issued to every approved provider. **ETIN:** issued to Transmitters and Software Developers; it starts in Test status and moves to Production after ATS/communication testing.

**A2A vs IFA** **[M]**
- **IFA** (Internet Filing Application) is a browser upload in e-Services.
- **A2A** (Application-to-Application) is a SOAP web-service interface (Login, SendSubmissions, GetNewAcks/GetAcks, GetSubmissionsStatus, etc.).
- A2A requires registering an *application system* in e-Services (System ID) and an **X.509 certificate from an IRS-approved certificate authority**, bound to the ETIN.
- The IRS supplies an MeF A2A toolkit and interface documentation via SOR.

**Acknowledgments** **[M]**
- Each submission gets Accepted or Rejected, with validation errors (rule number, severity, XPath, data value).
- Transmitters must retrieve acks promptly and notify EROs.
- A rejected return can be corrected and resubmitted within the "perfection period" and still be treated as timely (10 days for business returns, VERIFY).

### B3. Security and privacy obligations

**IRC §7216 / Reg. §301.7216** **[H]**
- Anyone who develops software used to prepare or file returns, and any Authorized e-file Provider, is a "tax return preparer" for these purposes.
- Using or disclosing return information beyond preparation requires taxpayer consent in the prescribed format (Rev. Proc. 2013-14). This covers analytics, benchmarking, marketing, and **ML training in Databricks**.
- Violations bring criminal penalties (§7216) and civil penalties (§6713).

**FTC Safeguards Rule (16 CFR 314; amended rule fully effective June 2023; breach notice to the FTC within 30 days for events affecting 500 or more consumers, effective May 13, 2024)** **[H]**
- Tax preparers are "financial institutions" under GLBA.
- The rule requires:
  - a Qualified Individual;
  - a written risk assessment;
  - access controls;
  - asset inventory;
  - encryption in transit and at rest;
  - secure development;
  - **MFA for anyone accessing customer information**;
  - disposal within 2 years after last use;
  - change management;
  - logging and monitoring;
  - annual penetration tests and semiannual vulnerability scans (or continuous monitoring);
  - training;
  - **service-provider oversight**;
  - an incident response plan;
  - an annual report to the board.
- Our CPA-firm customers must contractually oversee us. Corporate in-house tax departments may not be GLBA institutions, but they will ask for the same controls in SOC 2 form.

**IRS Pub 4557** (*Safeguarding Taxpayer Data*) and **Pub 5708** (Security Summit WISP template, 2024) **[M–H]**
- A WISP is expected of every preparer and provider.
- PTIN renewal asks preparers to confirm awareness of their WISP obligation.

**Pub 1345 / Pub 3112 provider standards** **[M]**
- Rules on e-file logo use and advertising, record retention, and prompt correction of software errors.
- **Reporting security incidents** to the IRS (no later than the next business day after confirmation, for Online Providers).
- The six **Online Provider security, privacy and business standards**:
  1. Extended Validation TLS certificate;
  2. weekly external vulnerability scans;
  3. privacy/safeguard policies;
  4. protection against bulk fraudulent filing;
  5. domain registration in the U.S.;
  6. incident reporting.

**Security Summit (IRS + states + industry, since 2015)** **[M]**
- Trusted-customer requirements for software: password and lockout standards, **MFA** (expected for tax-professional products), and identity verification.
- Fraud-detection data elements sent in the return header (device, IP and timing data). The exact business-return elements are VERIFY.
- Participation in the IDTTRF-ISAC.
- Mainly relevant once we transmit or embed in a preparer workflow. Treat it as a design baseline now.

---

## Implications for the product

### 1. Form-definition data model (versioned, data-driven)

```
form(form_id, jurisdiction='US-IRS', number='4562', title, entity_types[], attachment_seq,
     omb_no, filing_mode{attachment|standalone}, parent_returns[1120,1120S,1065,1040,1041,990T])
form_revision(revision_id, form_id, tax_year, revision_label('2025'|'Rev. Dec 2022'),
     applies_to_tax_years[from,to], status{draft|final|corrected|superseded},
     pdf_url, pdf_sha256, instr_url, instr_date, released_on, legislative_basis['P.L.119-21'])
section(section_id, revision_id, part='III', section='B', label)
line(line_id, revision_id, section_id, line_no='19h', label, data_type{amount|int|pct|date|text|bool|enum},
     sign_rule, rounding='whole_dollar', repeating{none|rows|columns}, face_capacity, overflow_template_id,
     required_when(expr), entity_type_filter[])
field(field_id, line_id, column='(g)', row_index, semantic_key='macrs.gds.50yr.deduction')
calc_rule(rule_id, target_field_id, expr_dsl, inputs[facts|field_refs], precedence,
     conditions(expr: entity_type, elections, dates), authority[IRC §, instr page], test_vectors[])
fact_binding(semantic_key -> Databricks view/column, aggregation, filters, lineage_tag)
pdf_field_map(revision_id, field_id, acro_name, page, rect, format{comma,no_cents,neg_parens}, checkbox_on_value)
mef_map(field_id, schema_family='1120x', schema_version='TY2025v5.x', xpath, repeating_group_xpath,
     xsd_type, business_rules[F4562-xxx])
statement_template(template_id, kind{overflow|election|explanation|481a|8594_supplemental},
     layout, mef_dependency_schema|pdf)
validation_rule(rule_id, scope, expr, severity, mirrors_irs_rule_id)
form_instance(instance_id, entity_id, tax_year, activity_id, revision_id, run_id, status, sign-offs)
field_value(instance_id, field_id, row, value, source{calc|override}, override_reason, lineage[asset_ids, query_hash])
```

**Design notes:**
- `semantic_key` decouples engine facts from line numbers. That is what absorbs churn such as the 2025 shift of 19h → 19i.
- Every value records lineage back to Databricks assets and run IDs, for audit and reviewer drill-down.
- Rules are tested with IRS-example and ATS-like test vectors.
- Drafts are loaded early (August–October) so mappings can be built ahead of final release, but they are blocked from filing output.

### 2. Rendering approach

- **Primary:** fill the official IRS AcroForm PDF for the matching revision, flatten it, and append generated continuation statements that mirror the form columns. The forms stay official, which avoids Pub 1167 approval questions.
- **Fallback:** a Pub 1167-conformant vector substitute (e.g., HTML → PDF), for forms without a usable fillable PDF or for heavy-overflow layouts. Each substitute layout is reviewed against Pub 1167 before release.
- **Machine outputs:**
  - canonical JSON keyed by semantic keys;
  - MeF-schema XML fragments (`IRS4562`, `IRS4797`, `IRS8824`, …) validated with the official XSDs and mirrored business rules;
  - vendor-specific import files.
- **Workpapers:** asset rollforwards; book-tax-AMT-CAMT-state multi-book comparisons; the M-1/M-3 depreciation reconciliation; §481(a) and §1.168(i)-6 computations; the §179 owner-allocation ledger.

### 3. Phased filing path (recommended)

| Phase | Scope | IRS status needed | Notes |
|---|---|---|---|
| **1. Compute + official PDFs** (first season) | 4562 (per activity), 4797, 4684 Sec. B, 8824, 3115 Sch. E + §481(a), 8594 support, M-1/M-3 depreciation lines, 6251/4626 schedules, K-1 §179 statements, 8990 depreciation inputs, 3468/4255/7205/8908 basis effects | None | Paper filers plus review copies; strongest value is accurate data and workpapers |
| **2. Integrate with return software** | Push data and XML fragments into the customer's compliance system (CCH Axcess/ProSystem fx, Thomson Reuters ONESOURCE/GoSystem/UltraTax, Corptax, Lacerte/ProConnect for the SMB tier — VERIFY each vendor's import/partner API); validate against MeF XSDs and business rules | Apply for the **Software Developer** role mainly for SOR schema/business-rule access (eligibility for a non-transmitting developer: VERIFY with e-Help) | The return vendor stays the ATS-certified software and transmitter. This mirrors how incumbent fixed-asset tools work (VERIFY Bloomberg's integration list in doc 01) |
| **3. Own MeF status** (optional, year 3+) | Only if we build full 1120/1065/1120-S returns (or standalone e-filed products) | Software Developer + Transmitter, ATS per family per year, A2A system plus X.509 certificate, Security Summit and Pub 4164 compliance | Large recurring cost (annual ATS, schema churn, ack operations, suitability, 24×7 filing-season support). Not justified by attachments alone |

### 4. Compliance obligations for the product (from day 1)

- **§7216:**
  - the default design is "preparation purpose only";
  - consent flows are needed before any cross-client analytics or ML use;
  - Unity Catalog row/column security and tenant isolation in Databricks.
- **Safeguards Rule-grade controls:** SOC 2 Type II; MFA everywhere; encryption; logging; 6-month vulnerability scans and an annual penetration test; incident response with customer notification SLAs supporting their 30-day FTC deadline; a data-disposal schedule.
- **WISP** for the company (Pub 5708 template), plus a customer-facing security addendum.
- **If we take an e-file role:**
  - Pub 3112 suitability for principals;
  - next-business-day incident reporting to the IRS;
  - e-file logo and advertising rules;
  - annual ATS;
  - Security Summit data elements.

---

## Sources

IRS primary sources. Canonical URLs; **not fetched in this session** (irs.gov blocked). Items marked † were confirmed through search extracts.

- † Instructions for Form 4562 (2025): https://www.irs.gov/instructions/i4562 · PDF https://www.irs.gov/pub/irs-pdf/i4562.pdf
- † Form 4562 (2025): https://www.irs.gov/pub/irs-pdf/f4562.pdf · † 2026 draft: https://www.irs.gov/pub/irs-dft/f4562--dft.pdf · † 2024 instructions: https://www.irs.gov/pub/irs-prior/i4562--2024.pdf
- † Correction to 2021–2023 Instructions for Form 4562, Part I line 5: https://www.irs.gov/forms-pubs/correction-to-the-2021-2022-and-2023-instructions-for-form-4562-instructions-for-part-i-line-5
- † Pub 946 (2025): https://www.irs.gov/publications/p946
- Form/Instructions 4797: https://www.irs.gov/pub/irs-pdf/f4797.pdf · https://www.irs.gov/pub/irs-pdf/i4797.pdf
- Form/Instructions 4684: https://www.irs.gov/pub/irs-pdf/f4684.pdf · https://www.irs.gov/pub/irs-pdf/i4684.pdf
- Form/Instructions 8824: https://www.irs.gov/pub/irs-pdf/f8824.pdf · https://www.irs.gov/pub/irs-pdf/i8824.pdf
- Form/Instructions 3115: https://www.irs.gov/pub/irs-pdf/f3115.pdf · https://www.irs.gov/pub/irs-pdf/i3115.pdf
- Form/Instructions 8594: https://www.irs.gov/pub/irs-pdf/f8594.pdf · https://www.irs.gov/pub/irs-pdf/i8594.pdf
- Forms 3468 / 4255 / 3800: https://www.irs.gov/pub/irs-pdf/f3468.pdf · https://www.irs.gov/pub/irs-pdf/f4255.pdf · https://www.irs.gov/pub/irs-pdf/f3800.pdf (and i3468/i4255/i3800)
- Form 7205: https://www.irs.gov/pub/irs-pdf/f7205.pdf · Form 8908: https://www.irs.gov/pub/irs-pdf/f8908.pdf
- Form 4626: https://www.irs.gov/pub/irs-pdf/f4626.pdf · Form 6251: https://www.irs.gov/pub/irs-pdf/f6251.pdf
- Schedule M-3 (1120): https://www.irs.gov/pub/irs-pdf/f1120sm3.pdf · Form 1125-A: https://www.irs.gov/pub/irs-pdf/f1125a.pdf
- Partner's Instructions for Schedule K-1 (1065): https://www.irs.gov/pub/irs-pdf/i1065sk1.pdf · Shareholder's Instructions for Schedule K-1 (1120-S): https://www.irs.gov/pub/irs-pdf/i1120ssk.pdf
- Form/Instructions 8990: https://www.irs.gov/pub/irs-pdf/f8990.pdf · https://www.irs.gov/pub/irs-pdf/i8990.pdf
- Pub 1167: https://www.irs.gov/pub/irs-pdf/p1167.pdf
- Pub 4164: https://www.irs.gov/pub/irs-pdf/p4164.pdf · Pub 4163: https://www.irs.gov/pub/irs-pdf/p4163.pdf
- Pub 5078 (ATS, business): https://www.irs.gov/pub/irs-pdf/p5078.pdf · Pub 1436 (ATS, 1040): https://www.irs.gov/pub/irs-pdf/p1436.pdf
- Pub 3112: https://www.irs.gov/pub/irs-pdf/p3112.pdf · Pub 1345: https://www.irs.gov/pub/irs-pdf/p1345.pdf
- Pub 4557: https://www.irs.gov/pub/irs-pdf/p4557.pdf · Pub 5708: https://www.irs.gov/pub/irs-pdf/p5708.pdf
- MeF schemas and business rules landing page: https://www.irs.gov/e-file-providers/modernized-e-file-mef-schemas-and-business-rules (path VERIFY)
- Become an Authorized e-file Provider: https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider

Other primary sources (not fetched):
- P.L. 119-21 (H.R. 1, 119th Congress): https://www.congress.gov/bill/119th-congress/house-bill/1
- FTC Safeguards Rule, 16 CFR Part 314: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314
- 26 CFR §301.7216-1 et seq.: https://www.ecfr.gov/current/title-26/chapter-I/subchapter-F/part-301
- T.D. 9972 (e-file thresholds), Federal Register Feb 23, 2023 (document URL VERIFY)
- Revenue procedures: Rev. Proc. 2015-13; 2025-23; 2025-28; 2025-32; 2013-14 (IRB citations VERIFY)

---

## Open questions

1. **2025 Form 4562 lines:** final letters for residential and nonresidential lines after 19h was added; whether QPP is reported on line 14 or on a separate line or statement; and the statute cite and statement wording for the 40%/60% election (VERIFY from i4562 2025).
2. **QPP (§168(n)):** election mechanics, 10-year recapture reporting on 4797, and the status of Notice 2026-16 or later proposed regulations.
3. **Rev. Proc. 2025-23 DCNs:** the current DCN list for depreciation, disposition and §174A changes; whether Form 3115 is XML or a PDF attachment in MeF; the duplicate-copy filing method.
4. **Form 8990:** the post-OBBBA revision, line numbers, and whether the disposition-reduction rule is extended to post-2024 addbacks.
5. **Revisions not confirmed:** current revisions and part numbering for 3468, 4255, 3800, 7205, 8908 and 4626; the CAMT §168 adjustment line and the latest notices.
6. **K-1 codes:** 2025 box 20 (1065) and box 17 (1120-S) codes for §179 dispositions and recapture, and the §743(b) code.
7. **Pub 1167:** the current revision, which forms need mandatory approval, sample-submission rules for software developers, and dimensional tolerances.
8. **e-file application:** can a non-transmitting vendor hold the Software Developer role purely for SOR schema access? Fingerprinting rules for that role; the current SOR access process.
9. **Vendor integrations:** partner-program terms and import formats for CCH, Thomson Reuters, Corptax and Intuit; whether any accept MeF-schema XML fragments directly.
10. **Our §7216 posture:** whether hosting for corporate in-house tax departments (non-preparers) still triggers §7216 through our role as a software developer. Legal review needed before any ML or benchmarking feature.
