# 06 — State Income/Franchise Tax Conformity for Depreciation, and the State Forms Involved

*Research swarm topic 06. Prepared 2026-10-30. Scope: state treatment of federal depreciation (IRC §168(k) bonus, §179, new §168(n) qualified production property, new §174A domestic R&E) after P.L. 119-21 (signed July 4, 2025), the state forms and e-file programs involved, and what this means for a Databricks-backed, effective-dated rules engine.*

> **Research-integrity note (read first).** During this session, direct page retrieval (WebFetch/curl) to tax sites (cost.org, rsmus.com, grantthornton.com, taxfoundation.org, ftb.ca.gov, tax.ny.gov) was refused by the session's network policy (HTTP 403 / DNS block), and the swarm's shared web-search budget ran out after about 15 queries. Every fact below is tagged:
> - **[S]**: backed by a 2025–2026 source surfaced in this session (DOR document, statute summary, Big 4/national-firm alert, or Bloomberg Tax/COST). URL in Sources.
> - **[K]**: from the author's prior knowledge (training data through ~mid-2026). Not re-verified here.
> - **VERIFY**: not confirmed. Do not load it into production rules until a state SME confirms it against the primary source.
>
> Confidence: **H** (high), **M** (medium), **L** (low). Treat the 50-state matrix as a *seed dataset and research backlog*, not as filing-grade content.

---

## 1. Executive summary

1. **Federal baseline changed a lot in 2025.** P.L. 119-21 brought back permanent 100% bonus depreciation for property acquired after Jan. 19, 2025. It created a new 100% allowance for *qualified production property* (nonresidential real property used in manufacturing/production) under new **§168(n)**. It raised §179 to **$2.5M** with a **$4M** phase-out threshold (indexed; reported as $2,560,000 / $4,090,000 for 2026 [S, secondary]). It restored immediate expensing of domestic R&E under new **§174A**. Each item reaches states through a *different statutory hook*. Because §168(n) and §174A are *new subsections*, they slipped past many state bonus-addback statutes that name only "§168(k)". That forced a wave of 2025–2026 decoupling bills.
2. **States responded with targeted decoupling, not wholesale non-conformity.** The pattern in 2025–2026 enactments: move or keep the conformity date, then carve out the expensive OBBBA items.
   - **Florida** HB 7031 (signed June 11, 2026, retroactive) adopts the IRC as of Jan 1, 2026, but freezes §§168(k), 174(a), 163(j), 274 and 179 at the Jan 1, 2025 Code. It fully decouples from §168(n) and §174A [S].
   - **New York** (Ch. 59, L. 2026, Part F, signed May 28, 2026) decouples NYS and NYC from §168(n) for tax years beginning on/after Jan 1, 2025 [S].
   - **Pennsylvania** Act 45 of 2025 (signed Nov 12, 2025) decouples the CNIT from §168(n), §174A and §163(j) for tax years after Dec 31, 2024 [S].
   - **Illinois** P.A. 104-0453 decouples from §168(n) for tax years beginning on/after Jan 1, 2026 [S].
   - **Hawaii** decouples from §168(n) and §174A [S]. **Vermont** and **Minnesota** decouple from §174A [S]. **Massachusetts** conforms to §174A starting in 2026 [S].
   - **California** SB 711 (Oct 1, 2025) moved the conformity date from Jan 1, 2015 to **Jan 1, 2025**. That deliberately excludes OBBBA. California still never allows bonus depreciation [S].
3. **Bonus conformity count (best estimate, corporate tax, as of Oct 2026, VERIFY):** Of 45 corporate-income-tax jurisdictions (44 states + DC):
   - **~19 conform** to §168(k).
   - **~20 decouple fully**, recomputing depreciation without bonus.
   - **~6 decouple partially or with a spread**: MN 80%/5-yr, NC 85%/5-yr, FL 1/7 over 7 years, CT (corp) spread, AZ partial, ME addback-plus-credit.
   - Separately, **Ohio** (no corporate income tax; CAT) applies a 5/6 addback / 5-year recovery for PIT and pass-throughs. **Texas** margin tax uses the IRC as of Jan 1, 2007, so no bonus applies in COGS.
   - A secondary tool claims "22 states + DC decoupled", which is consistent with this count once partial regimes are separated [S, low-quality source].
4. **The computational shapes differ, and the engine must support all of them:**
   - (a) **Full recompute shadow book.** Separate state basis, accumulated depreciation and gain. Examples: CA, NY, NJ, PA, VA, KY, GA, WI. California corporations even use pre-ACRS class-life/ADR methods under R&TC §§24349–24354.
   - (b) **Entity-level spread ledgers.** Addback X% now, subtract 1/N over N later years, independent of the asset's life. Examples: NC, MN, OH, FL, CT.
   - (c) **Hybrid asset-level subtraction with a final-year catch-up.** Example: IL-4562.
   - (d) **Dollar-limit overrides for §179.** CA/HI/MD/NJ-GIT/MN/NC at $25,000/$200,000; IN $25,000. These must be enforced at both entity and owner level.
   - (e) **Pinned-Code regimes.** TX IRC 1/1/2007; FL "Code as of 1/1/2025 for listed sections".
5. **Retroactivity is now the norm.** FL (June 2026, retroactive to 2025 returns, with F-1120X amendments), NY (May 2026, with Notice N-26-1 requiring amended 2025 returns) and PA (Nov 2025 budget) all changed rules *after* returns were filed. The rules store must be **bitemporal**: tax-year validity plus knowledge/recording time. It must reproduce "as-filed" and "as-amended" results.
6. **Forms and e-file are a second, separate maintenance stream.** Separate depreciation forms include CA FTB 3885/3885A/3885F/3885L/3885P, NY IT-398/CT-399 (plus NYC-399/399Z), NJ GIT-DEP and CBT-100 Schedule S, IL-4562, PA REV-1834, GA 4562, KY 4562 and MD 500DM. All are delivered through the IRS Fed/State MeF channel. That requires annual state software-developer registration, Assurance Testing (ATS), schema updates (state schemas are coordinated through FTA's TIGERS), and in several states substitute-form approval (e.g., NY Publication 76; CA FTB substitute-forms program).

---

## 2. Conformity concepts

### 2.1 Three ways states adopt the IRC

| Type | Meaning | Implication for the rules engine | Examples (VERIFY each) |
|---|---|---|---|
| **Rolling (dynamic)** | The state adopts the IRC "as amended" and automatically picks up federal changes unless the legislature decouples. | A federal change flows through on enactment. The engine must assume conformity *unless* a decoupling rule exists, and must watch for retroactive decoupling bills. | AL, AK (corp), CO, CT, DC, DE, IL, IA (VERIFY start yr), KS, LA, MD (with auto-decoupling), MA (corp), MI, MO, MT, NE, NJ, NM, NY, ND, OK, OR (taxable-income definitions), PA (CNIT starts from federal TI), RI, TN (excise starts from federal TI), UT |
| **Static / fixed-date** | The state adopts the IRC "as of" a date, updated by annual or periodic conformity bills. | Federal changes after the date are ignored until the next conformity bill. The engine must store the *conformity date per tax year* and treat post-date federal sections as non-existent for the state. | CA (1/1/2025), FL (1/1/2026 with exceptions), GA, HI, ID, IN, KY, ME, MN, NC, NH, SC, TX (1/1/2007), VT, VA (12/31/2025), WV, WI, AZ |
| **Selective** | The state adopts only enumerated IRC sections, sometimes each with its own date. | The rule must be kept per IRC section, not per Code. | AR, MS, PA PIT (no general IRC conformity), plus FL's per-section dates since 2026 |

A state can be rolling for corporations and static for individuals (MA). It can be "rolling but auto-decoupling" (MD: federal changes with more than $5M fiscal impact are automatically decoupled for the year of enactment unless the General Assembly acts [K, M]). It can also be "conforming to the Code but with section-specific dates" (FL after HB 7031 [S]). **Model conformity per (jurisdiction × tax type × IRC section × tax year), not per state.**

### 2.2 Decoupling mechanics for depreciation

| Mechanic | Description | Example |
|---|---|---|
| **Recompute without bonus** | State depreciation = §167/§168 *as if* no bonus election. State basis and accumulated depreciation diverge. The gain on disposal differs. | NY (IRC as in effect 9/10/2001 for post-6/1/2003 property), NJ, PA CNIT (Act 72-2018), CA, VA, KY, GA, WI |
| **Addback with a fixed spread** | Add back X% of federal bonus (and/or excess §179) in year 1. Subtract the addback in equal parts over N later years, regardless of asset life. | NC 85% then 20% × 5 yrs; MN 80% then 20% × 5 yrs; OH 5/6 then 1/5 × 5 yrs; FL 100% then 1/7 × 7 yrs |
| **Factor / ratio subtraction** | Add back bonus. Subtract a factor × federal depreciation each year, then a final-year catch-up. | IL: 100% addback. Subtraction = non-bonus depreciation for 100% bonus property (IL-4562 line 16 [S]); historically a bonus%/(1−bonus%) factor for partial-bonus years [K, M] |
| **Dollar-limit override (§179)** | State caps §179 at a different amount and phase-out. The excess is added back, sometimes with its own spread. | CA $25k/$200k [S]; MN, NC $25k/$200k with spread [K]; MD $25k [K]; NJ GIT $25k [S, secondary]; IN $25k [K] |
| **Pinned Code** | Use the depreciation rules of a frozen Code. | TX margin tax (IRC 1/1/2007) [K]; FL §168(k)/§179 frozen at 1/1/2025 [S] |
| **Credit in lieu** | Disallow bonus but grant a credit. | ME Capital Investment Credit (VERIFY rate and scope) [K, L] |

### 2.3 The "new subsection" problem (why OBBBA forced bills)

Many state addback statutes were written around "the special depreciation allowance under §168(k)". OBBBA put the factory-building expensing in **§168(n)** and R&E expensing in **§174A**. In rolling states, those flow through automatically unless the statute is amended. IL needed P.A. 104-0453 [S]. NY needed Part F [S]. PA needed Act 45 [S]. In static states they do not flow through until a conformity bill adopts them. CA's Jan 1, 2025 date excludes them [S]. FL adopted the 2026 Code but expressly excluded them [S]. **Engine implication:** decoupling rules must key on *IRC section identifiers* with their own effective windows. A new federal subsection should create an automatic research ticket for every jurisdiction.

### 2.4 Federal items that drive state differences (P.L. 119-21)

| Item | Federal rule (summary) | Confidence |
|---|---|---|
| §168(k) bonus | 100% permanent for property *acquired* after Jan 19, 2025. Pre-Jan 20, 2025 acquisitions placed in service in 2025 get 40% (60% for long-production property/aircraft). Taxpayers may elect the lower rate for the first tax year ending after Jan 19, 2025. | H [K] |
| §168(n) QPP | 100% allowance for the nonresidential-real-property portion used in a qualified production activity (manufacturing/production/refining of tangible personal property). Construction must begin after Jan 19, 2025 and before 2029; placed in service before 2031. Election required. 10-year use-change recapture. Offices, administrative space, R&D and similar areas are excluded. | M-H [K] |
| §179 | $2.5M limit / $4M phase-out threshold for property placed in service in tax years beginning after 2024, indexed (2026: $2,560,000 / $4,090,000) | H for 2025; M for 2026 [S, secondary] |
| §174A | Domestic R&E deductible for tax years beginning after 2024 (optional 60-month amortization). Foreign R&E stays 15-yr under §174. Transition: unamortized 2022–2024 domestic amounts may be deducted in 2025 or over 2025–2026. Small businesses (gross receipts ≤ ~$31M) may apply it retroactively to 2022+. | M [K] |
| §163(j) | EBITDA-based ATI restored (depreciation is added back in ATI) | M [K]. Relevant because states decoupling §163(j) (PA [S], FL [S]) change how much depreciation helps |

---

## 3. 50-state + DC matrix

**Legend.** Y = conforms; N = decouples (recompute); P = partial or spread; N/A = no broad-based corporate/individual income tax on business income. "Federal" §179 = follows the federal limit as of the state's conformity date. Form names given without VERIFY are known from FTB/IDOR/NY/NJ/PA materials. Others are VERIFY. Rows focus on the **corporate** regime unless noted. Section 6 covers corporate vs. individual differences.

| St | Conformity type / date (Oct 2026) | §168(k) bonus | §179 limit | §168(n) QPP | §174A | Addback / recovery mechanics | State depreciation form(s) | Conf. |
|---|---|---|---|---|---|---|---|---|
| AL | Rolling (corp) [K] | Y | Federal | Y presumed (rolling); VERIFY | Y presumed; VERIFY | None | Fed 4562 | M |
| AK | Rolling, corp only; no PIT [K] | Y; oil & gas taxpayers have special rules VERIFY | Federal | Y presumed; VERIFY | Y presumed; VERIFY | Oil/gas exception VERIFY | Fed 4562 | M-L |
| AZ | Static, annual conformity bill; current date VERIFY | P/VERIFY. History: addback of federal depreciation, AZ depreciation subtracted, partial bonus allowance; whether full conformity since TY2023 is unverified | Federal as of AZ date; VERIFY | VERIFY | VERIFY | Add/subtract lines on 140/120 | No separate form known; VERIFY | L |
| AR | Selective/static (listed IRC sections) [K] | N | VERIFY (historically $25k; later increases reported) | N presumed (static); VERIFY | VERIFY | Recompute | AR depreciation schedule (AR4562?); VERIFY | L |
| CA | Static: IRC as of **1/1/2025** (SB 711, signed 10/1/2025; TY ≥ 2025) [S] | **N (never)** [S] | **$25,000 / $200,000** (R&TC 17255 PIT; 24356 corp) [S] | **N** (post-date) [S, inferred] | **N** (post-date) [S, inferred] | Full recompute. Corps: R&TC 24349–24354 methods with class-life/ADR lives. PIT: MACRS w/o bonus [S] | **FTB 3885** (corp), **3885A** (indiv adj.), **3885F** (fiduciary), **3885L** (LLC/568), **3885P** (partnership/565) [S]; Sch CA; Sch D-1 | H |
| CO | Rolling [K] | Y historically. A 2026 secondary source says CO decouples. **VERIFY** (2025 special session / 2026 session) | Federal | VERIFY | VERIFY | VERIFY | Fed 4562 | L |
| CT | Rolling [K] | Corp: N. 100% addback, recovered 25%/yr over 4 succeeding years (VERIFY). PIT: believed to conform (VERIFY) | Federal (VERIFY) | VERIFY | VERIFY | Spread ledger (corp) | CT-1120 Sch A / CT-1120 ATT; VERIFY | M-L |
| DE | Rolling [K] | Corp: Y historically (VERIFY). PIT: decoupled from 100% bonus by late-2025 law per GT alert [S, partial] | Federal | VERIFY (GT: DE decoupled from "key OBBBA rules") [S, partial] | VERIFY | PIT recompute | VERIFY | L-M |
| DC | Rolling with statutory decouplings [K] | N | $25,000 (VERIFY) | VERIFY | VERIFY | Recompute | D-20/D-30 lines; VERIFY | M-L |
| FL | Static: **IRC 1/1/2026**, except §§168(k), 174(a), 163(j), 274, 179 frozen at **1/1/2025** Code (HB 7031, signed 6/11/2026, effective on signing, retroactive) [S] | **N/P**: 100% addback, 1/7 subtracted per year over 7 yrs (F.S. 220.13(1)(e)) [K, M] | §179 per 1/1/2025 Code (pre-OBBBA limits) [S, inferred] | **N** [S] | **N** [S] | Spread ledger (1/7) | F-1120 Sch I/II; amended **F-1120X** [S] | H (law) / M (mechanics) |
| GA | Static, annual bill; 1/1/2025 or 1/1/2026 (VERIFY 2026 bill) [K] | N | GA-specified each year; adoption of the OBBBA $2.5M is VERIFY | N presumed; VERIFY | VERIFY | Recompute | **GA Form 4562** [K] | M |
| HI | Static (date VERIFY). 2026 law decouples §168(n) and §174A; keeps §174 as of 12/31/2024 [S] | N (never adopted) [K] | $25,000 / $200,000 (VERIFY) | **N** [S] | **N** [S] | Recompute | Fed 4562 recomputed; HI schedule VERIFY | M |
| ID | Static: Code as of Jan 1 of the current year (VERIFY 2026) [K] | Y since 2010 (VERIFY) | Federal | VERIFY | VERIFY | None | Fed 4562 | L-M |
| IL | Rolling [K] | **N**: 100% addback. Subtraction via IL-4562 (non-bonus depreciation; final-year/disposition catch-up) [S] | Federal | **N for TY beginning ≥ 1/1/2026** (P.A. 104-0453; IDOR Bulletin FY 2026-15). TY2025: flows through [S] | Conforms presumed (rolling); VERIFY | Asset-level subtraction | **IL-4562** [S] | H |
| IN | Static, annual bill (2026 date VERIFY) [K] | N | $25,000 cap; excess added back [K, M] | VERIFY | VERIFY | Recompute | Add-back codes on IT-40 Sch 1 / IT-20; VERIFY | M |
| IA | Rolling (start year VERIFY) [K] | Y (coupled from TY2023) [K, M] | Federal | VERIFY | VERIFY (2026 session) | None | Fed 4562 (legacy IA 4562A/B) | M-L |
| KS | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M-L |
| KY | Static (12/31/2024 or 12/31/2025; VERIFY) [K] | N | KY-specific (historic IRC §179 date; amount VERIFY) | N presumed; VERIFY | VERIFY | Recompute | **KY Form 4562** (KY depreciation & amortization) [K] | M |
| LA | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M-L |
| ME | Static, annual (VERIFY 2026 update) [K] | P: addback with later recovery, plus a Capital Investment Credit in lieu (rates VERIFY) [K, L] | VERIFY | VERIFY | VERIFY | Addback, recovery, credit | 1040ME/1120ME worksheets; VERIFY | L |
| MD | Rolling with **automatic decoupling** above $5M fiscal impact [K] | N | $25,000 / $200,000 [K] | VERIFY (auto-decoupling likely for TY2025) | VERIFY | Recompute | **Form 500DM** (decoupling modification) [K] | M |
| MA | Corp rolling; PIT static (date VERIFY) [K] | N (both) [S, secondary] | Corp federal; PIT per PIT date (VERIFY) | VERIFY | Decoupled 2025; **conforms for TY ≥ 1/1/2026** [S, secondary] | Recompute | Form 355 / Form 1 schedules; VERIFY | M |
| MI | Rolling (CIT has election rules) [K] | Y (VERIFY the 2025 budget package) | Federal | VERIFY | VERIFY | None | None | L-M |
| MN | Static (current date VERIFY) [K] | **P**: 80% addback, 20% of the addback subtracted in each of the next 5 yrs [K, M-H] | $25,000 / $200,000. 80% of the excess added back, 5-yr recovery [K, M] | VERIFY | **N** [S, secondary] | Spread ledger | Sch M1M / M1NC; M4I; KPI/KPC/KF lines (VERIFY line refs) | M |
| MS | Selective/static (VERIFY) | VERIFY (believed Y) | VERIFY | VERIFY | VERIFY | VERIFY | VERIFY | L |
| MO | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M |
| MT | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M-L |
| NE | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | (legacy 4562N) | M-L |
| NV | No CIT/PIT. Commerce Tax on gross revenue | N/A | N/A | N/A | N/A | None | None | H |
| NH | BPT: static (date VERIFY) [K] | N [K] | Federal (VERIFY) | VERIFY | VERIFY | Recompute | NH-1120 / DP schedules; VERIFY | L-M |
| NJ | Rolling [K] | **N**: CBT since 2002, GIT since 2004 [S, secondary] | **GIT $25,000/$200,000** [S, secondary]; CBT treatment VERIFY | VERIFY | VERIFY | Recompute; addback recovered over MACRS life [S, secondary] | **GIT-DEP**; **CBT-100 Schedule S** [K, H] | M-H |
| NM | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M-L |
| NY (+NYC) | Rolling [K] | **N** for property placed in service on/after 6/1/2003, except Resurgence Zone and Liberty Zone property. Uses §167/§168 as in effect 9/10/2001 [S/K] | Federal, except SUVs > 6,000 lb (TY2004+) [K] | **N for TY beginning ≥ 1/1/2025** (Ch. 59 L. 2026 Part F; Notice N-26-1 requires amended 2025 returns) [S] | VERIFY | Recompute; disposition adjustment | **IT-398** (PIT), **CT-399** (corp) [S]; NYC-399 / NYC-399Z [K] | H |
| NC | Static (date VERIFY) [K] | **P**: 85% addback, 20% deducted in each of the next 5 yrs [K, M-H] | $25,000 / $200,000. 85% of the excess added back, 5-yr recovery [K, M] | VERIFY | VERIFY | Spread ledger | D-400 Sch S; CD-405; D-403 (worksheets); VERIFY | M |
| ND | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M-L |
| OH | No CIT (CAT on gross receipts). PIT conformity date VERIFY | PIT/PTE: **5/6 addback** (2/3 or 0 with Ohio withholding increase), recovered over 5 (or 2) yrs [K, M] | PIT: 5/6 of "qualifying §179 expense" added back [K, M] | VERIFY | VERIFY | Spread ledger | IT 1040 Sch of Adjustments; IT 4708 / IT 1140 [K] | M |
| OK | Rolling [K] | Y (plus OK-specific expensing; VERIFY) | Federal | VERIFY | VERIFY | None | None | M-L |
| OR | Rolling for taxable-income definitions [K] | Y (VERIFY 2026 short session) | Federal | VERIFY | VERIFY | None | None | L-M |
| PA | CNIT: starts from federal TI with statutory decouplings. PIT: independent (no general IRC conformity) [S/K] | **N**. CNIT: add back bonus, deduct MACRS w/o §168(k) for property placed in service after 9/27/2017 (Act 72-2018). PIT: no bonus [S] | CNIT federal. PIT: federal limit for property placed in service in TY ≥ 2023 (Act 53-2022); $25k before [S] | **N** (Act 45-2025, TY > 12/31/2024) [S] | **N** (Act 45-2025) [S] | Recompute | **REV-1834** (CNIT bonus depreciation schedule) [S]; PA-40 Sch C / PA-20S-PA-65 schedules (VERIFY) | H |
| RI | Rolling [K] | N [K] | VERIFY | VERIFY | VERIFY | Recompute | VERIFY | L-M |
| SC | Static, annual (12/31 of the prior year) [K] | N [K] | Federal (VERIFY) | VERIFY | VERIFY | Recompute | VERIFY | M-L |
| SD | No CIT/PIT (bank franchise only) | N/A | N/A | N/A | N/A | None | None | H |
| TN | Excise starts from federal TI; no PIT [K] | N [K] | Federal (VERIFY) | VERIFY | VERIFY | Recompute | FAE 170 schedules; VERIFY | M |
| TX | Franchise (margin) tax. IRC as of **1/1/2007** for COGS and other IRC references (Tax Code §171.0001(9)) [K, M-H] | N (2007 Code has no post-2007 bonus) | 2007 Code limits; amount VERIFY | N | N (VERIFY) | Separate TX depreciation for the COGS deduction and for gain in total revenue | Form 05-158-A/B (COGS lines) [K] | M |
| UT | Rolling [K] | Y | Federal | VERIFY | VERIFY | None | None | M-L |
| VT | Static, annual [K] | N [K] | VERIFY | VERIFY | **N** [S, secondary] | Recompute | VERIFY | M-L |
| VA | **Fixed date 12/31/2025** (2026 law; reportedly replaced a short-lived rolling provision) [S, secondary] | N: 100% addback, recovered over remaining life [K] | Federal [K] | VERIFY | VERIFY | Recompute | Sch ADJ / 500ADJ [K] | M |
| WA | No CIT/PIT (B&O gross receipts; capital-gains excise excludes most §1231 property) | N/A | N/A | N/A | N/A | None | None | H |
| WV | Static, annual [K] | Y (VERIFY) | Federal | VERIFY | VERIFY | None | None | L-M |
| WI | Static (date VERIFY; last broad update believed 12/31/2022) [K] | N [K] | Federal (VERIFY) | N unless a later bill adopts it | N unless a later bill adopts it | Recompute | Sch I + Form 4562 at WI amounts [K] | M |
| WY | No CIT/PIT | N/A | N/A | N/A | N/A | None | None | H |

### 3.1 Summary counts (corporate, best estimate; VERIFY before external use)

- **No general corporate income tax:** NV, OH (CAT), SD, TX (margin tax, which *does* use depreciation in COGS), WA (B&O), WY = 6.
- **Conform to §168(k) (~19):** AL, AK, CO\*, DE (corp)\*, ID, IA, KS, LA, MI, MS\*, MO, MT, NE, NM, ND, OK, OR\*, UT, WV\* (\* = notable uncertainty).
- **Decouple fully, recompute (~20):** AR, CA, DC, GA, HI, IL, IN, KY, MD, MA, NH, NJ, NY, PA, RI, SC, TN, VT, VA, WI.
- **Partial or spread (~6):** AZ\*, CT (corp), FL, ME\*, MN, NC. Outside the corporate group: OH PIT/PTE spread, TX margin pinned to 2007.
- **§168(n) explicitly decoupled by 2025–2026 legislation (verified):** FL, HI, IL (TY2026+), NY/NYC (TY2025+), PA (TY2025+). Static-date states not yet updated past July 4, 2025 also do not conform (e.g., CA, WI, TX).
- **§174A explicitly decoupled (verified, mostly secondary sources):** FL, HI, MN, PA, VT. CA by its conformity date. MA conforms from 2026.

---

## 4. Deep dives on priority states

The 15 largest state economies are approximately CA, TX, NY, FL, IL, PA, OH, GA, WA, NJ, NC, MA, VA, MI, CO/AZ/TN (the ranking of the tail varies) [K]. Representative unusual regimes are added.

### 4.1 California: never conforms to bonus; its own §179; corporations use pre-ACRS methods
- **Conformity date:** SB 711 (signed Oct 1, 2025) moved the "specified date" from Jan 1, 2015 to **Jan 1, 2025**, generally for tax years beginning on/after Jan 1, 2025, for both PIT and corporations. It keeps decoupling from §199A, the 80% NOL limit and certain TCJA long-term-contract changes, and it revises the research credit [S: KPMG, EY, BDO, PwC, HCVT, Western CPE]. OBBBA (July 4, 2025) is *after* the date, so §168(n), §174A, the $2.5M §179 and 100% bonus are not adopted [S]. A 2026 bill (AB 2377) was reported as pending, not enacted, as of mid-2026 [S, secondary; VERIFY status at session end, Aug 31, 2026].
- **Bonus:** California has never adopted §168(k) [S].
- **§179:** $25,000 limit, phase-out from $200,000 (fully gone at $225,000), under R&TC 17255 (PIT) and 24356 (corp) [S: FTB 3885 instructions]. The engine must apply this at the **entity and the owner level** (partners/members receive CA §179 via 565/568 K-1s and are limited again at the individual level) [K, M].
- **Corporations ≠ individuals:** Corporations compute depreciation under **R&TC §§24349–24354**. Useful lives follow the federal class-life ADR guidelines (Cal. Code Regs. tit. 18, §24349(l)), and the corporation may not choose a period outside the guideline system [S]. In practice the corporate "CA book" is not "federal MACRS minus bonus": it is a separate methods/lives regime. Individuals, partnerships and LLCs use MACRS as of the conformity date without bonus [S/K].
- **Forms:**
  - **FTB 3885** (corporations, including LLCs taxed as corporations; attaches to Form 100/100W; S corps report on Schedule B (100S)).
  - **FTB 3885A** (individuals; only when CA ≠ federal; one per activity).
  - **FTB 3885F** (fiduciary, Form 541).
  - **FTB 3885L** (LLC, Form 568).
  - **FTB 3885P** (partnership, Form 565) [S].
  - Differences flow to Schedule CA (540/540NR). Dispositions with different basis go on **Schedule D-1** (Sales of Business Property) [K, H].
- **Dispositions:** CA adjusted basis is generally higher (less depreciation), so CA gain is smaller. Depreciation recapture is recomputed with CA amounts [K].

### 4.2 New York State and New York City: decoupled since 2003; Resurgence and Liberty Zone exceptions; §168(n) decoupled
- **Post-2003 decoupling:** For property placed in service on/after June 1, 2003 (TY2003+), NY requires depreciation under IRC §167/§168 *as they existed on Sept 10, 2001*, i.e., no §168(k), for both PIT and corporate franchise tax [S/K]. **Exceptions:** *qualified Resurgence Zone property* (Lower Manhattan, roughly between Canal and Houston Streets) and *qualified New York Liberty Zone property* (south of Canal) keep federal bonus treatment [K, M; VERIFY boundaries]. NY also decoupled §179 for SUVs over 6,000 lb (TY2004+) [K, M].
- **2026 change:** The FY2026-27 budget, Ch. 59 L. 2026 Part F (signed May 28, 2026), decouples NYS and NYC from **§168(n)** for tax years beginning on/after **Jan 1, 2025**. Depreciation must be computed as if OBBBA had not been enacted. Notice **N-26-1** (June 16, 2026) says already-filed 2025 returns must be amended [S: RSM, CohnReznick, CPA Journal]. §174A treatment is **VERIFY** (the executive proposal "would decouple from certain OBBBA provisions" [S: EY]; final scope not confirmed here).
- **Forms:** **IT-398** (NYS Depreciation Schedule for IRC §168(k) property, for PIT, including partnerships and S corps passing through) and **CT-399** (Depreciation Adjustment Schedule, corporations). The §168(n) addback is reported on the same schedules [S]. NYC: NYC-399 (business corporations) and NYC-399Z (UBT/older property) [K, M].
- **Product notes:** NY's rule is "recompute under a 2001-vintage Code", so the engine needs a *pinned-Code depreciation profile*, not a percentage. Disposition adjustments are reported on IT-398/CT-399 in the year of disposition [K, M].

### 4.3 Pennsylvania: CNIT vs. PIT are two different worlds
- **CNIT bonus:** PA statute disallows §168(k). Under **Act 72 of 2018**, for property placed in service after Sept 27, 2017, the taxpayer adds back federal bonus and deducts §167/§168 depreciation computed *without* §168(k) [S: PA DOR form REV-1834; CNIT audit manual 10/7/2025]. When federal bonus was below 100% (80% in 2023, etc.), the add-back-and-recompute interplay produced the effect practitioners called "PA super-depreciation" (Reed Smith, 2023) [S]. Pre-9/28/2017 property used the older 3/7 recovery approach [K, M].
- **Act 45 of 2025 (HB 416, signed Nov 12, 2025):** decouples the CNIT from **§174A**, **§168(n)** and the **§163(j)** changes for tax years beginning after Dec 31, 2024. For QPP, the allowed deduction is depreciation under §§167/168 without §168(n) [S: EY, Brown Plus, GTM]. A Grant Thornton alert (Dec 23, 2025) groups PA and DE as decoupling from key OBBBA rules [S].
- **PIT:** PA PIT does not follow the IRC generally. It has no bonus depreciation; depreciation is recomputed on PA-40 Schedule C and the pass-through schedules [S: PA DOR]. For §179, **Act 53 of 2022** raised the PIT limit to match the federal limit for property placed in service in tax years beginning on/after Jan 1, 2023. Earlier property stays under the $25,000 / $200,000 regime. PIT Bulletin 2023-02 (Aug 3, 2023) applies [S]. §179 may offset only business (Schedule C) net profits in that income class [S].
- **Forms:** REV-1834 (CNIT bonus depreciation schedule/instructions) [S]; RCT-101 adjustments [K]; PA-40 Schedule C; PA-20S/PA-65 for pass-throughs (VERIFY line mapping).

### 4.4 New Jersey: decoupled in both CBT and GIT, with separate forms
- **CBT:** decoupled from §168(k) since 2002. Add back and recompute; the difference is recovered over the remaining MACRS life [S, secondary]. Reported on **CBT-100 Schedule S** (Depreciation and Safe Harbor Leasing) [K, H].
- **GIT:** decoupled since 2004. **GIT-DEP** recomputes depreciation with a $25,000 §179 maximum. A legacy 30% special allowance survives for older property [S, secondary].
- **§179 for CBT** is **VERIFY** (sources conflict). **§168(n)/§174A:** no NJ-specific legislation was found. In a rolling state those would flow through unless NJ acted. VERIFY against FY2027 budget legislation (enacted by June 30, 2026).

### 4.5 Illinois: rolling conformity, IL-4562, and a 2026 §168(n) decoupling
- Add back 100% of federal bonus. Subtract over time on **Form IL-4562**. For 100% bonus property, the subtraction equals the depreciation that would have been allowed without the bonus election (IL-4562 line 16). The remainder is subtracted in the last year of the recovery period or on disposition [S: IDOR Bulletin FY 2026-15; IL-4562 instructions]. For partial-bonus years, IL historically used a factor (bonus%/(1−bonus%)) times federal depreciation [K, M].
- **P.A. 104-0453:** decouples from **§168(n)** for tax years beginning on/after **Jan 1, 2026**, using the same IL-4562 mechanics. For calendar 2025, §168(n) flowed through under rolling conformity [S].
- **§174A:** VERIFY. No decoupling was found; rolling conformity implies it flows through.

### 4.6 Texas: margin tax, COGS and a frozen 2007 Code
- The franchise tax base is "margin": total revenue minus the greater of COGS, compensation, 30% of revenue, or the statutory deduction amount (VERIFY current amount). IRC references for computing total revenue and COGS use the **IRC in effect for federal tax years beginning on Jan 1, 2007**, not including later changes (Tax Code §171.0001(9)) [K, M-H].
- **Consequence:** Depreciation inside the **COGS** election must follow 2007-Code rules (no 2008+ bonus; 2007-Code §179). Gains on asset sales flow into total revenue, so a TX basis drives TX gain [K, M]. Comptroller Rule 3.588 governs COGS, including which depreciation is allowable [K]. Whether the 2025 session updated the general IRC date is **VERIFY** (no update found).
- **Product notes:** Texas needs its *own book*, but only for entities electing COGS. Track it per entity per report year. Forms: Form 05-158-A/B COGS lines [K].

### 4.7 Ohio: no corporate income tax, but a heavy PIT/pass-through addback
- **CAT:** a gross-receipts tax with no depreciation relevance. **PIT and pass-throughs** (IT 1040, IT 4708 composite, IT 1140 withholding):
  - Add back **5/6** of federal bonus and of "qualifying §179 depreciation expense". The rate drops to **2/3** if the taxpayer increases Ohio withholding, or **0** if the increase is at least the bonus amount.
  - The addback is subtracted in equal parts over the following **5** years (2 years when the 2/3 rule applies) [K, M].
- **Municipal net-profit taxes** (ORC Ch. 718) are a separate regime; their depreciation conformity is VERIFY [K, L].
- **Product notes:** this is a pure entity-level spread ledger that must survive asset disposals and entity changes.

### 4.8 Florida: HB 7031 (2026), per-section freezes and retroactivity
- Adopts the IRC as amended and in effect on **Jan 1, 2026**, effective on signing (June 11, 2026) and retroactive. Taxpayers that filed on the old basis may need **F-1120X** [S: Bloomberg Tax/FL DOR, HBK, Forvis Mazars, Grant Thornton, Florida Senate analysis].
- **§§168(k), 174(a), 163(j), 274 and 179** are applied as in effect on **Jan 1, 2025**. **§168(n) and §174A** are fully decoupled [S].
- Florida's longstanding bonus addback (F.S. 220.13(1)(e)) is a 100% addback with a 1/7 subtraction in each of 7 years [K, M]. Its interaction with the frozen 2025 §168(k) (40%/20% phase-down) needs SME confirmation (VERIFY).
- Reported adopting the 2026 Code without modification would have cost $3.484B in FY2026-27; the enacted version is described as roughly revenue-neutral [S].

### 4.9 Georgia, North Carolina, Minnesota, Wisconsin, Virginia: fixed-date states with annual bills
- **GA:** decoupled from bonus since 2002. Each annual IRC-update bill sets the §179 dollar amounts. A separate **GA Form 4562** is required [K, M]. The 2026 bill's treatment of OBBBA is VERIFY.
- **NC:**
  - Bonus: 85% addback, deducted 20% per year over the next 5 years.
  - §179: 85% of the excess over NC's $25,000 / $200,000 is added back, also deducted 20% × 5 [K, M-H].
  - The latest conformity date and OBBBA treatment are VERIFY.
- **MN:**
  - Bonus: 80% addback, 20% subtracted per year over 5 years.
  - §179: $25,000 / $200,000, with 80% of the excess added back and recovered over 5 years [K, M].
  - §174A is decoupled per 2026 reports [S, secondary].
  - Pass-throughs report the addbacks to owners on **KPI/KPC/KF** [K].
- **WI:** decoupled from bonus. Static IRC date (VERIFY current). Schedule I bridges federal to WI amounts [K, M]. Absent a new bill, §168(n) and §174A are not adopted.
- **VA:** decoupled from bonus with a 100% addback recovered over the asset's life. Conforms to §179 [K, M]. The 2026 legislation reportedly sets a **fixed date of Dec 31, 2025** [S, secondary]. Treatment of §168(n) and §174A is VERIFY.

### 4.10 Massachusetts, Michigan, Colorado, Arizona, Tennessee
- **MA:** corporate excise is rolling, PIT is fixed-date. Decoupled from bonus. §174A conformity begins with TY2026 [S, secondary]. §168(n) is VERIFY.
- **MI:** CIT and PIT are believed to conform to bonus [K, L-M]. Michigan's late-2025 budget/road-funding package may contain decoupling; VERIFY.
- **CO:** rolling and historically conforming. Colorado held an August 2025 special session to close an OBBBA-driven revenue gap (QBI addback and other items [K, M]). A 2026 secondary table lists Colorado as decoupled from bonus [S, low quality]. **VERIFY.** This is a high-priority research item.
- **AZ:** historically used a "federal depreciation addback / Arizona depreciation subtraction" with partial bonus. The current status is **VERIFY**.
- **TN:** franchise and excise. The excise tax starts from federal taxable income and decouples bonus [K, M]. The *franchise* tax is based on net worth or property, which uses *book* values (GAAP net book value of real and tangible property), so the product's GAAP book feeds it [K, M].

---

## 5. Dispositions, basis and other cross-cutting computations

- **Different basis gives a different gain.** For recompute states, state adjusted basis = cost − state accumulated depreciation (and state §179). On disposal: state gain = federal gain − (state basis − federal basis). Depreciation recapture character (§1245/§1250) is recomputed with state amounts. Reporting happens on the state disposition schedule (CA Schedule D-1; NY IT-398/CT-399 disposition lines; NJ GIT-DEP/Schedule S; IL-4562 final subtraction; PA REV-1834) [S/K].
- **Spread-ledger states** (NC, MN, OH, FL, CT): the addback/subtraction schedule is an *entity-level deferred-deduction ledger*. Whether a disposal accelerates the remaining subtractions or they continue on schedule varies by state. **VERIFY per state**; NC, MN and OH are believed to continue on schedule [K, L].
- **§179 at two levels:** for pass-throughs, states with a lower §179 limit apply it at the entity *and* at the owner across all K-1s (CA explicitly [K, M]). Taxable-income limits are computed with state income. Carryovers of disallowed §179 are *state* carryovers.
- **§168(n) recapture:** if QPP use changes within 10 years, federal recapture applies. In decoupled states there is nothing to recapture, but basis still differs [K]. Needs SME confirmation.
- **Like-kind exchanges and §1031 property:** state deferred gain follows state basis. CA requires an annual information return (FTB 3840) for out-of-state replacement property [K, M].
- **Apportionment and franchise bases:** property factors (where still used) generally need average original cost by state. Some net-worth franchise taxes (TN, NC, GA, and others; VERIFY list) use book values. These are not depreciation-conformity questions, but the same asset register must supply location, cost and GAAP net book value.

---

## 6. Corporate vs. individual differences, and PTET

### 6.1 Notable corporate/individual splits
| State | Corporate | Individual / pass-through | Conf. |
|---|---|---|---|
| CA | R&TC 24349 methods (ADR lives), $25k §179, no bonus; FTB 3885 | MACRS without bonus, $25k §179 at entity and owner; 3885A/3885P/3885L/3885F | H |
| PA | CNIT: Act 72 recompute; federal §179; §168(n)/§174A/§163(j) decoupled (Act 45) | PIT: no bonus; §179 at the federal limit for TY2023+ property; income-class rules | H |
| MA | Rolling; bonus decoupled | Fixed date; bonus decoupled; date-specific §179 | M |
| NJ | CBT: Schedule S; §179 VERIFY | GIT: GIT-DEP, $25k §179 | M |
| CT | Corp bonus addback with spread (VERIFY) | PIT believed to conform (VERIFY) | L-M |
| DE | Corp believed to conform (VERIFY) | PIT decoupled from 100% bonus (late-2025 law) [S, partial] | L-M |
| OH | No CIT (CAT) | 5/6 addback, 5-yr recovery | M |
| TX, TN, NH | TX margin (2007 Code); TN excise (federal TI start); NH BPT also applies to unincorporated businesses | No wage income tax in any of the three | M |
| NY | CT-399 | IT-398 (partnerships and S corps pass the adjustments through) | H |

### 6.2 Pass-through entity taxes (PTET)
- Roughly **36 states** (plus NYC) have elective PTETs (count VERIFY). OBBBA's final text raised the SALT cap (to $40,000, with phase-down) but did **not** adopt the PTET limits floated in earlier drafts [K, M; VERIFY].
- The PTET base is normally the *state-modified* income of the entity, so state depreciation (recomputed or spread) changes PTET liability, estimated payments and owner credits. Examples: CA elective tax "qualified net income" is computed under CA law, so 3885P/3885L amounts flow into it [K, M]. NY PTET taxable income uses NY-adjusted items (IT-398 adjustments), VERIFY [K, L].
- **Product implications:**
  1. Compute state depreciation at the entity level per state.
  2. Allocate addbacks and subtractions to owners by state K-1 line.
  3. Keep spread-ledger balances at the entity *and* track them after ownership changes (owner-level carryover in MN/NC: VERIFY).
  4. Feed PTET estimate calculations mid-year, before the year's legislation is final.

---

## 7. State forms and e-file

### 7.1 Inventory of separate state depreciation forms
| State | Form(s) | Who | Status |
|---|---|---|---|
| CA | FTB 3885 / 3885A / 3885F / 3885L / 3885P | Corp / Individual / Fiduciary / LLC / Partnership | [S] H |
| NY | IT-398; CT-399; NYC-399; NYC-399Z | PIT and pass-throughs; Corp; NYC corp; NYC UBT/other | [S] H (NYC [K] M) |
| NJ | GIT-DEP; CBT-100 Schedule S | Individuals/pass-throughs; Corp | [S]/[K] M-H |
| IL | IL-4562 | All filers | [S] H |
| PA | REV-1834; PA-40 Schedule C (PIT) | CNIT; PIT | [S] M-H |
| GA | GA Form 4562 | All | [K] M |
| KY | KY Form 4562 | All | [K] M |
| MD | Form 500DM | Corp / PTE (individual mapping VERIFY) | [K] M |
| MN | Sch M1M/M1NC lines; M4I; KPI/KPC/KF | All | [K] M; VERIFY line refs |
| WI | Schedule I with WI-basis Form 4562 | All | [K] M |
| FL | F-1120 Schedules I/II; F-1120X | Corp | [S]/[K] M |
| TX | 05-158-A/B COGS lines | Margin-tax filers electing COGS | [K] M |
| NC, OH, VA, CT, IN | Lines and worksheets on the main return/schedules (no stand-alone depreciation form) | All | [K] M-L; VERIFY |

Many states require the **federal Form 4562 recomputed with state amounts** to be attached (a "state 4562"). The product should generate a *state-basis 4562-format report* for every state, even where no official form exists.

### 7.2 E-file channel: Fed/State MeF
- Most states accept business and individual returns through the **IRS Modernized e-File (MeF) Fed/State program**. A state submission can be *linked* to the federal submission or sent *state-only (unlinked)*. States retrieve it from the IRS. Governing IRS publications are Pub. 4164 (MeF Guide for Software Developers and Transmitters) and Pub. 1345 (authorized e-file providers) [K, H].
- **State schemas and business rules** are published by each state, using a common state XML standard coordinated by the **Federation of Tax Administrators' TIGERS** (Tax Implementation Group for e-Services) working with industry [K, M; VERIFY current distribution channel].
- **Software developer approval:** each state runs an annual registration and **Assurance Testing System (ATS)** cycle, typically from Oct–Nov to Jan. Developers submit state test scenarios, pass validation and get production approval per form type and tax year. Examples: CA FTB e-file program publications and annual testing; NY's software developer program (Publication number VERIFY); IL/PA/NJ developer portals [K, M]. Some states require developers to support specific forms (e.g., IT-398/CT-399 and FTB 3885 schedules as structured XML, not PDF attachments; VERIFY per form).
- **Mandates:** several states (e.g., NY, CA, and others) mandate e-file for corporations and/or preparers above thresholds [K, M], so depreciation schedules effectively *must* be produced in XML.

### 7.3 Substitute and scannable forms
- **NACTP** (National Association of Computerized Tax Processors) is the industry body that coordinates with the IRS and states on substitute-form standards, 2D barcodes, and testing logistics [K, H]. The federal analogue is IRS Pub. 1167.
- **New York Publication 76** (Specifications for Reproduction of NYS Tax Forms) governs substitute NY forms. Vendors submit samples for approval [K, H; VERIFY current edition].
- **California FTB** runs a substitute-forms approval program with annual specifications and vendor approval (publication number VERIFY; FTB 1006 is a forms-listing publication, VERIFY) [K, M].
- Many states require **2D-barcode** printing on paper returns using NACTP/state specifications [K, M].
- **Product implications:**
  1. Paper output requires per-state approval of each year's form images (or use of state fill-in PDFs where permitted).
  2. Barcode payloads must match the state data dictionary.
  3. Approval letters are annual artifacts to track.

### 7.4 How vendors maintain state rules each year (industry pattern)
| Phase | Timing | Activities |
|---|---|---|
| Legislative monitoring | Continuous; peaks Jan–Jun; late budgets (PA Nov 2025, NY May 2026) | Track bills and DOR notices. Sources: Bloomberg Tax, Tax Foundation, COST maps (COST published OBBBA conformity maps dated Mar, Apr, May and July 2026 [S]), Big 4/national-firm alerts, state legislature feeds |
| Codification | Within days of enactment | Encode rules with citations; regression-test against prior-year cases |
| Draft forms | Sep–Dec | States release draft forms and instructions; vendors map lines |
| Schemas and ATS | Oct–Jan | Implement state XML schema changes; pass state ATS; obtain approvals |
| Release | Jan–Feb | Production release; e-file opens (states open with or soon after IRS MeF) |
| Mid-season and retroactive changes | Any time | Patch releases; amended-return support (FL F-1120X 2026; NY N-26-1 2026) |
| Fiscal-year filers | Rolling | Multiple rule versions are live at once (TY2025 vs TY2026 rules) |

---

## 8. Implications for the product

### 8.1 Design principles
1. **Rules are data, keyed to IRC sections and effective windows,** never hard-coded per state.
2. **Bitemporal versioning.** Valid time (tax year begin dates, placed-in-service or acquisition windows) is kept separate from knowledge time (when enacted, when recorded, when superseded). This reproduces as-filed returns and drives amended-return detection.
3. **Three computation primitives** must be composable:
   - (a) **profile substitution**: different method, life, bonus %, §179 limit or pinned Code;
   - (b) **entity-level spread ledger**: addback X%, recover 1/N over N years;
   - (c) **dollar-limit override with entity and owner tiers**.
4. **Citations and confidence on every rule row**, with promotion status: `draft → sme_reviewed → enacted → effective`.
5. **Federal is the base book. A state book is a derived book**: base + ordered overrides. It is materialized as its own book only where basis diverges.

### 8.2 Proposed data model (Delta tables in Databricks; Unity Catalog)

```text
dim_jurisdiction(jurisdiction_id, code, name, level[state|city|county], parent_id,
                 has_cit, has_pit, has_franchise_networth, has_gross_receipts, notes)

dim_tax_type(tax_type_id, jurisdiction_id, code[CIT|PIT|PTET|FRANCHISE_MARGIN|BPT|EXCISE|UBT],
             entity_types_applicable[], return_forms[])

conformity_regime(regime_id, jurisdiction_id, tax_type_id,
                  regime_type[ROLLING|STATIC|SELECTIVE|AUTO_DECOUPLE],
                  irc_as_of_date,            -- null for rolling
                  tax_year_begin_from, tax_year_begin_to,   -- valid time
                  enacted_by (bill/act), enacted_date, effective_date, retroactive_flag,
                  recorded_at, superseded_at,               -- knowledge time
                  status, confidence, source_ids[])

provision_rule(rule_id, regime_id, irc_section ['168(k)','168(n)','179','174A','163(j)',...],
               treatment[CONFORM|DECOUPLE_RECOMPUTE|PINNED_CODE|ADDBACK_SPREAD|
                         LIMIT_OVERRIDE|FACTOR_SUBTRACTION|CREDIT_IN_LIEU|ELECTIVE],
               pinned_code_date,          -- e.g. NY 2001-09-10, TX 2007-01-01, FL 2025-01-01
               applicability: { pis_from, pis_to, acquired_from, acquired_to,
                                property_classes[], qpp_flag, zone_codes[] (NY Resurgence/Liberty),
                                entity_types[], taxpayer_tests (e.g. OH withholding increase) },
               priority, tax_year_begin_from/to, recorded_at, superseded_at,
               status, confidence, source_ids[])

addback_rule(rule_id → provision_rule, addback_pct, recovery_years, recovery_start_offset,
             recovery_pattern[EQUAL|FACTOR|REMAINING_LIFE|FINAL_YEAR_CATCHUP],
             factor_formula (e.g. IL bonus%/(1-bonus%)), on_disposition[CONTINUE|ACCELERATE|NONE],
             alternate_pct_conditions (e.g. OH 2/3 or 0))

limit_rule(rule_id → provision_rule, sec179_limit, phaseout_threshold, indexing_rule,
           apply_at[ENTITY|OWNER|BOTH], carryover_rule, taxable_income_limit_basis[STATE|FEDERAL])

method_profile(profile_id, name (e.g. 'CA_CORP_24349_ADR', 'NY_IRC_20010910', 'TX_IRC_20070101'),
               method_map(property_class → method, convention, life), bonus_pct_override,
               allow_179, allow_168n)

form_map(form_map_id, jurisdiction_id, tax_type_id, tax_year, form_code ('FTB 3885A','IT-398',
         'CT-399','IL-4562','GIT-DEP','REV-1834'), line_code, data_element (e.g.
         'state_depr_current', 'bonus_addback', 'spread_subtraction', 'disposition_adj'),
         efile_schema_version, xpath, substitute_form_approval_id, status)

source_citation(source_id, url, publisher, doc_type[STATUTE|DOR_GUIDANCE|FORM_INSTR|
                FIRM_ALERT|TRACKER], retrieved_at, quote_hash)

state_book_definition(book_id, entity_id, jurisdiction_id, tax_type_id, derived_from_book_id
                      ('FED_TAX'), materialize[SHADOW|DELTA_ONLY], rule_snapshot_ts)

asset_state_ledger(entity_id, asset_id, book_id, tax_year, state_basis, state_179, state_bonus,
                   state_depr, state_accum, fed_minus_state_delta, disposition_gain_state,
                   rule_ids_applied[], computed_at, rule_snapshot_ts)

entity_spread_ledger(entity_id, jurisdiction_id, tax_type_id, origin_tax_year, rule_id,
                     addback_amount, scheduled_subtractions[{year, amount}], taken_to_date,
                     owner_allocations[])
```

### 8.3 Deriving a state book from federal
1. **Resolve rules.** For (entity, jurisdiction, tax type, tax year), select the conformity regime and the active provision rules *as of the knowledge timestamp* (for as-filed vs. amended runs).
2. **Per asset:** evaluate applicability using placed-in-service date, acquisition date, the QPP flag (§168(n) election), property class, location/zone and the federal elections made.
3. **Pick the computation:**
   - If any rule is `DECOUPLE_RECOMPUTE` or `PINNED_CODE`, compute a **shadow** schedule with the `method_profile` and keep the state basis.
   - If rules are `ADDBACK_SPREAD` only, keep the federal schedule and post to `entity_spread_ledger`.
   - If `FACTOR_SUBTRACTION` (IL), compute the subtraction per asset and do the final-year catch-up on the last recovery year or disposal.
4. **Apply §179 `limit_rule`s.** Allocate the state §179 across eligible assets with a deterministic, user-overridable allocation. Apply the entity limit, then owner-level limits across K-1 inputs.
5. **Dispositions:** compute the state gain with the state basis. Apply `on_disposition` for spread ledgers.
6. **Emit `fed_minus_state_delta`** and map it to `form_map` lines and e-file XPaths. Attach `rule_ids_applied` and `source_ids` for the audit trail.
7. **Amendment detection:** when a new rule version is recorded with a retroactive window (e.g., FL HB 7031, NY Part F), re-run affected (entity, year) pairs and flag differences above a threshold as "amendment candidates".

### 8.4 Annual maintenance process: a "state swarm"
- **One agent/analyst cell per state** (51 cells, plus NYC and other major localities). Each cell owns monitoring, codification, forms and e-file for its state.
- **Triggers:** federal enactment (auto-ticket every jurisdiction for each new IRC section); state session calendar; DOR notices; tracker updates (COST maps, Bloomberg Tax, Tax Foundation, Big 4 alerts).
- **Workflow:**
  1. Agent drafts the rule rows with citations.
  2. Agent writes golden test cases from DOR examples or form instructions.
  3. State SME reviews.
  4. Rows are promoted to `enacted`.
  5. Rows become `effective` when the window opens.
  6. Forms/schemas track ATS separately.
- **Quality gates:** no `VERIFY` row reaches production. Every production rule cites a primary source (statute, DOR guidance or form instructions). Firm alerts are accepted only as secondary support.
- **Calendar:** Jan–Jun legislative peak; Jul–Sep budget stragglers and special sessions; Sep–Jan forms and ATS; year-round retroactive patches.

---

## 9. Sources

Sources surfaced in this session (titles/URLs as returned by search; full text was not retrievable because of network policy):

**Trackers and multi-state**
- COST: OBBBA/H.R. 1 conformity maps (Mar 16, Apr 30, May and Jul 10, 2026): https://www.cost.org/globalassets/cost/state-tax-resources-pdf-pages/maps--charts---obbba/hr-1-maps-july-10-2026---final.pdf ; https://www.cost.org/globalassets/cost/state-tax-resources-pdf-pages/maps--charts---obbba/final-maps-may-2026-----read-only.pdf ; https://www.cost.org/globalassets/cost/state-tax-resources-pdf-pages/maps--charts---obbba/obbba-conformity-maps-april-30---final-af.pdf ; https://www.cost.org/globalassets/cost/state-tax-resources-pdf-pages/maps--charts---obbba/obbba-conformity-maps-final---march-16.pdf
- Bloomberg Tax, State Conformity to Federal Bonus Depreciation: https://pro.bloombergtax.com/insights/federal-tax/state-conformity-to-federal-bonus-depreciation/
- RSM, State corporate income tax law changes, Q2 2026: https://rsmus.com/insights/tax-alerts/2026/state-corporate-income-tax-law-changes-for-the-second-quarter.html
- PwC Financial Services SALT newsletter (July 2026): https://www.pwc.com/us/en/state-local-tax/newsletters/salt-insights/assets/pwc-financial-services-state-and-local-tax-newsletter-july-2026.pdf
- KBF Advisory, Q2 2026 state corporate tax update: https://kbfadvisory.com/q2-2026-state-corporate-tax-update-ob3-conformity-rate-reductions-and-key-court-decisions/
- Secondary/low-quality (used only to flag disagreements): https://sales.tax/expert-articles/state-tax-conformity-in-2026-what-multistate-businesses-need-to-know/ ; https://deprecimax.com/tools/bonus-depreciation-conformity ; https://costsegsmart.com/bonus-depreciation/state-conformity/

**California**
- FTB 2025 Instructions for FTB 3885A: https://www.ftb.ca.gov/forms/2025/2025-3885a-instructions.html
- FTB 2024 Instructions for FTB 3885: https://www.ftb.ca.gov/forms/2024/2024-3885-instructions.html ; 2021: https://www.ftb.ca.gov/forms/2021/2021-3885-instructions.html
- FTB 3885L (2025): https://www.ftb.ca.gov/forms/2025/2025-3885l.pdf ; FTB 3885P (2025): https://www.ftb.ca.gov/forms/2025/2025-3885p.pdf
- SB 711: KPMG https://kpmg.com/kpmg-us/content/dam/kpmg/taxnewsflash/pdf/2025/10/25310.pdf ; EY https://taxnews.ey.com/news/2025-2032-california-updates-general-date-conformity-to-internal-revenue-code-while-continuing-to-decouple-from-significant-federal-provisions ; BDO https://www.bdo.com/insights/tax/california-updates-irc-conformity-and-research-credit-rules ; PwC https://www.pwc.com/us/en/services/tax/library/california-irc-conformity-update.html ; HCVT https://www.hcvt.com/alertarticle-California-Senate-Bill-711 ; Western CPE https://www.westerncpe.com/etax-alerts/california-corner-california-advances-internal-revenue-code-conformity-date/ ; CalCPA https://www.calcpa.org/advocacy/federal-tax-conformity-legislation-signed

**New York**
- RSM, NY budget federal conformity: https://rsmus.com/insights/tax-alerts/2026/new-york-budget-federal-conformity-rates-property-tax.html
- CohnReznick, NYS FY2026-27 budget: https://www.cohnreznick.com/insights/new-york-state-passes-fiscal-year-2026-2027-budget
- CPA Journal, NYS 2026-27 budget overview: https://www.cpajournal.com/2026/09/01/new-york-states-2026-2027-budget-bill-overview/
- EY, NY FY2026-27 executive budget: https://taxnews.ey.com/news/2026-0294-new-york-fy2026-27-proposed-executive-budget-includes-retroactive-business-and-individual-tax-changes-would-decouple-from-certain-obbba-provisions

**Pennsylvania**
- PA DOR, OBBBA / TCJA guidance page: https://www.pa.gov/agencies/revenue/resources/tax-law-policies-bulletins-notices/tax-cuts-and-jobs-one-big-beautiful-bill-acts
- PA DOR, REV-1834: https://www.revenue.pa.gov/FormsandPublications/FormsforBusinesses/CorporationTax/Documents/rev-1834.pdf
- PA DOR, CNIT Audit Manual (10/7/2025): https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/taxlawpoliciesbulletinsnotices/auditmanuals/documents/cni_audit_manual.pdf
- PA DOR, 2025 RCT-101 instructions (REV-1200): https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforbusinesses/corporationtax/documents/2025/2025_rev-1200.pdf
- PA PIT Bulletin 2023-02 (§179): https://www.revenue.pa.gov/TaxLawPoliciesBulletinsNotices/TaxBulletins/PIT/Documents/pit_bulletin_2023-02.pdf
- EY, PA budget decouples from select OBBBA provisions: https://taxnews.ey.com/news/2025-2403-pennsylvania-budget-bill-decouples-from-select-obbba-provisions
- Grant Thornton, PA and Delaware decouple key OBBBA rules: https://www.grantthornton.com/insights/alerts/tax/2025/salt/p-t/pa-delaware-decouple-key-obbba-rules-12-23
- Reed Smith, PA super-depreciation: https://www.reedsmith.com/en/perspectives/2023/06/pennsylvania-super-depreciation-begins-in-2023-are-you-ready
- Brown Plus: https://www.brownplus.com/blog/pennsylvanias-2025-2026-budget-bill/ ; GTM Tax: https://gtmtax.com/insight/understanding-pennsylvanias-approach-to-ob3-conformity/

**Florida**
- Bloomberg Tax, FL DOR 2026 IRC conformity: https://news.bloombergtax.com/daily-tax-report-state/florida-dor-announces-2026-irc-conformity-decoupling-changes-for-corporate-income-tax
- Grant Thornton: https://www.grantthornton.com/insights/alerts/tax/2026/salt/f-j/fl-resets-federal-conformity-date-decouples-from-obbba-provisions-08-03
- HBK, HB 7031: https://hbkcpa.com/insights/florida-irc-conformity-hb-7031-2026/
- Forvis Mazars: https://www.forvismazars.us/forsights/2026/07/florida-updates-tax-law-in-response-to-one-big-beautiful-bill-act
- Florida Senate analysis (SB 7048): https://www.flsenate.gov/Session/Bill/2026/7048/Analyses/2026s07048.pre.ap.PDF

**Illinois**
- IDOR Informational Bulletin FY 2026-15 (Dec 2025): https://tax.illinois.gov/content/dam/soi/en/web/tax/research/publications/bulletins/documents/2026/fy-2026-15.pdf
- 2025 IL-4562 instructions: https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/miscellaneous/il-4562-instr.pdf

**New Jersey (secondary only in this session)**
- https://costsegsmart.com/bonus-depreciation/new-jersey/ ; https://www.monacocpa.cpa/post/section-179-bonus-depreciation-nj

**Not retrievable this session (recommended primary sources for VERIFY items):** Tax Foundation state conformity maps (taxfoundation.org); each state's DOR conformity notices; NY Publication 76; CA FTB e-file and substitute-forms publications; IRS Pub. 4164 and Pub. 1345; FTA/TIGERS state schema pages; NACTP (nactp.org).

---

## 10. Open questions (research backlog, ordered by product risk)

1. **Colorado, Michigan, Oregon, Delaware (corp), Arizona:** current §168(k), §168(n) and §174A status after 2025 special sessions and 2026 sessions. Secondary sources conflict (CO especially).
2. **Current conformity dates** for GA, IN, KY, MN, NC, SC, WI, ME, VT, HI, ID, WV, NH, AR after 2026 sessions, and whether each adopted the $2.5M §179.
3. **§174A** in NY, NJ, IL, GA, NC, VA, CT, MD: conform, decouple, or adopt the transition and small-business retroactive elections?
4. **Maryland automatic decoupling:** which OBBBA items the Comptroller treated as decoupled for TY2025, and whether the 2026 General Assembly overrode them.
5. **Spread-ledger disposition rules** (NC, MN, OH, FL, CT): continue or accelerate on sale, merger or entity termination; owner-level carryover after ownership changes.
6. **NJ CBT §179** limit (sources conflict) and any NJ FY2027 OBBBA decoupling.
7. **Florida:** interaction of the frozen 1/1/2025 §168(k) (40%/20% phase-down) with the 1/7 addback statute's sunset (VERIFY expiry year).
8. **Texas:** confirm no 2025 IRC-date update; confirm the §179 amounts under the 2007 Code; confirm Rule 3.588 depreciation requirements.
9. **E-file specifics:** which states accept depreciation schedules as structured XML vs. PDF attachments; current NY and CA software-developer publications and ATS calendars; TIGERS schema distribution.
10. **Local regimes:** NYC (confirmed for §168(n)), Philadelphia BIRT/NPT, Ohio municipalities, Kentucky localities, Portland/Multnomah, St. Louis/Kansas City. Depreciation conformity for each is VERIFY.
11. **PTET:** current list of PTET states and whether each PTET base includes state depreciation modifications (NY, NJ, IL, MN, GA in particular).
12. **OH:** confirm the current 5/6 and 2/3 percentages, the withholding-increase test, and the "qualifying §179 depreciation expense" definition under ORC 5747.01(A)(17).
