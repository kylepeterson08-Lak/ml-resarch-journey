# 03 — Federal Income-Tax Cost Recovery and Dispositions: Rule Content for the Calc Engine

*Research date: 2026-10-30. Scope: U.S. federal income tax (regular tax, individual AMT, corporate AMT/AFSI, E&P). State conformity, GAAP/IFRS, and form layouts are covered in other reports.*

**How sources were verified (read this first).** This sandbox could not fetch irs.gov or most firm websites directly (DNS blocked by the network allow-list), and the shared web-search budget ran out partway through. Post-OBBBA amounts and guidance were confirmed with web searches. Those searches returned summaries of the IRS documents and of Big-4/national-firm commentary on them. MACRS percentage tables were recomputed from first principles in Python and checked against the published Rev. Proc. 87-57 / Pub 946 values. Statutory mechanics that have not changed in years come from long-standing law and are cited to the Code and regulations. Each material claim carries a confidence tag:

- **[H]** — high confidence: confirmed by two or more consistent sources, or long-settled law.
- **[M]** — medium confidence: one source, or my reading of statute or guidance not re-read in full.
- **[VERIFY]** — not confirmed. An engineer must check the primary document before encoding it.

---

## 1. Executive summary

1. **Bonus depreciation now has two regimes, split by acquisition date.** P.L. 119-21 (OBBBA, signed 2025-07-04) §70301 makes 100% bonus permanent for qualified property *acquired after January 19, 2025* [H]. For this purpose, property is not acquired after the cutoff if a written binding contract existed on or before that date [H]. Property acquired on or before January 19, 2025 stays on the TCJA phase-down:

   | Property | 2025 | 2026 | 2027 |
   |---|---|---|---|
   | General | 40% | 20% | 0% |
   | Long-production-period property (LPPP) and certain non-commercial aircraft | 60% | 40% | 20% |

   [H]. For the *first taxable year ending after January 19, 2025*, a new §168(k)(10) election lets a taxpayer take 40% (60% for LPPP/aircraft) in place of 100% [H]. **Notice 2026-11** (issued 2026-01-14) is the interim guidance. It applies Reg. §1.168(k)-2 with the January 19, 2025 date substituted, keeps the 10% safe harbor and physical-work test for self-constructed property, and keeps the election to treat components of a larger self-constructed property as separately eligible [H]. The engine therefore needs a **binding-contract date** and a **construction-start date** on every asset and component, not just a placed-in-service date.
2. **New §168(n): a 100% "qualified production property" (QPP) allowance for factory buildings.** OBBBA §70307 created it [H]. QPP is the portion of *nonresidential real property* used as an integral part of a qualified production activity (manufacturing, production, or refining). Construction must begin after 2025-01-19 and before 2029-01-01, and the property must be placed in service before 2031-01-01 [H]. Lessor-owned property is excluded [H], and so are office, R&D, and storage areas [M]. A 10-year use-based recapture applies [H]. **Notice 2026-16** (2026-02-20) is the interim guidance [H]. This is the first time a building portion can be fully expensed, so the engine must split a building's basis by QPA-use percentage and monitor use for 10 years.
3. **§179 limits:**

   | Tax years beginning in | Limit | Phase-out threshold | SUV cap |
   |---|---|---|---|
   | 2025 | $2,500,000 | $4,000,000 | $31,300 |
   | 2026 | $2,560,000 | $4,090,000 | $32,000 |
   | 2024 (prior law) | $1,220,000 | $3,050,000 | $30,500 |

   The 2025 limit and threshold are statutory under OBBBA §70306 [H]. The 2025 SUV cap is from Rev. Proc. 2024-40 [H]. The 2026 amounts are from Rev. Proc. 2025-32 [H, confirmed through multiple secondary sources citing it]. §179 amounts key off the **tax year beginning date**. A fiscal year beginning in 2024 uses the 2024 amounts.
4. **§280F luxury-auto caps:**

   | Placed in service | Year 1 with bonus | Year 1 without bonus | Year 2 | Year 3 | Year 4 and later | Source |
   |---|---|---|---|---|---|---|
   | 2025 | $20,200 | $12,200 | $19,600 | $11,800 | $7,060 | Rev. Proc. 2025-16 [H] |
   | 2026 | $20,300 | $12,300 | $19,800 | $11,900 | $7,160 | Rev. Proc. 2026-15 [H] |
5. **§174A restored expensing of domestic R&E** for tax years beginning after 2024 (OBBBA §70302). Unamortized 2022–2024 domestic amounts can be deducted in 2025, or ratably over 2025–2026. The small-business retroactive election under Rev. Proc. 2025-28 had to be made by **July 6, 2026**, and that date has passed [H]. Foreign R&E is still amortized over 15 years.
6. **Accounting-method changes.** The current automatic list is **Rev. Proc. 2025-23**, as modified by Rev. Proc. 2025-28 and **Rev. Proc. 2026-32** (2026-09-04, §174A and construction contracts) [H]. Core depreciation DCNs:

   | DCN | Change |
   |---|---|
   | 7 | Impermissible to permissible depreciation, assets still held |
   | 107 | Same change for disposed assets |
   | 200 | Grouping assets in a general asset account |
   | 205 / 206 / 207 | Disposition determinations |

   [M–H].
7. **The main design implication: there is no single "effective date."** Each rule keys off a different trigger date:

   | Rule | Trigger date |
   |---|---|
   | §179 | Tax-year begin |
   | Bonus | Acquisition or binding-contract date, plus placed-in-service date, plus "first tax year ending after" |
   | §168(n) | Construction begin, plus placed-in-service date |
   | §280F | Placed-in-service calendar year |
   | §1031 | Exchange date |
   | 39-yr vs 31.5-yr real property; ACRS vs MACRS | Placed-in-service date |

   Rules-as-data tables must therefore declare *which date dimension* they are keyed on, and must be **bitemporal**: law-effective time plus knowledge/recorded time, because IRS interim guidance restates past years.

---

## 2. Rules by topic

### 2.1 MACRS framework (§168; Rev. Procs. 87-56, 87-57)

**Systems.** GDS (§168(a)) is the default. ADS (§168(g)) uses straight-line over ADS periods: generally the class life, 12 years for personal property with no class life, 30 years for residential rental property placed in service after 2017, 40 years for nonresidential real property, and 20 years for QIP [H]. Sources: [IRC §168](https://www.law.cornell.edu/uscode/text/26/168); [Pub 946 (2025)](https://www.irs.gov/publications/p946).

**Recovery classes.**
- Rev. Proc. 87-56 (1987-2 C.B. 674) supplies class lives and GDS/ADS periods by asset class. Examples:
  - 00.11 office furniture: 10-yr class life, 7-yr GDS.
  - 00.12 information systems: 6-yr class life, 5-yr GDS.
  - 00.22 automobiles: 3-yr class life, 5-yr GDS.
  - 00.241 light trucks: 4-yr class life, 5-yr GDS.
  - 00.3 land improvements: 20-yr class life, 15-yr GDS.
  - 57.0 distributive trades & services: 9-yr class life, 5-yr GDS.
  - 01.1 agricultural machinery: 10-yr class life, 7-yr GDS. New farm machinery placed in service after 2017 is 5-yr under §168(e)(3)(B)(vii).
- Statutory assignments in §168(e) override the Rev. Proc. Examples:
  - QIP: 15-yr.
  - Property with no class life: 7-yr.
  - Water utility property: 25-yr.
  - Residential rental: 27.5-yr.
  - Nonresidential: 39-yr if placed in service after 1993-05-12; 31.5-yr if placed in service 1987-01-01 through 1993-05-12.

  [H]. The asset-class table must therefore support **statutory overrides with their own effective dates**.

**Methods (§168(b)).**

| Method | Applies to |
|---|---|
| 200% DB, switching to SL in the year SL yields more | 3-, 5-, 7- and 10-yr property |
| 150% DB | 15- and 20-yr property; property for which 150% DB is elected (by class, by year, §168(b)(5)); farm property placed in service before 2018 |
| SL | 25-, 27.5- and 39-yr property, QIP, ADS, and elected SL (by class) |

[H]. TCJA §13203 removed the 150% DB requirement for farm property placed in service after 2017 (other than 15/20-yr property) [M].

**Conventions (§168(d); Reg. §1.168(d)-1).**
- **Half-year (HY)** is the default for personal property.
- **Mid-month (MM)** applies to residential rental, nonresidential real property, and railroad grading/tunnel bore.
- **Mid-quarter (MQ)** applies to all non-MM property placed in service in the year if the depreciable bases placed in service in the *last three months* of the tax year exceed 40% of the year's aggregate. The aggregate excludes:
  - MM property.
  - Property placed in service and disposed of in the same year.

  Basis for the 40% test is reduced by any §179 expense [H]. Whether it is also reduced by bonus — my understanding is that it is *not* — is **[VERIFY]** against Reg. §1.168(d)-1(b)(4) and Pub 946 ch. 4.
- Consolidated groups apply the MQ test on an aggregate basis, and partnerships and S corporations apply it at entity level [M].

**Published-table quirk.** Rev. Proc. 87-57 tables round so that each row sums to 100%. For example, the 39-yr January first year is published as **2.461%**, while the formula gives 2.457%. The engine must support a *table method* that reproduces the published rows exactly, and a *formula method*. Once a taxpayer uses the tables for an asset, it must continue with them, and it cannot use them for a short tax year or for any later year [H] (Pub 946 App. A instructions).

**Worked percentages.** These were verified computationally; published rounding is shown.

| Class / convention | Yr 1 | Yr 2 | Yr 3 | Yr 4 | Yr 5 | Yr 6 | Yr 7 | Yr 8 |
|---|---|---|---|---|---|---|---|---|
| 5-yr HY (200DB) | 20.00 | 32.00 | 19.20 | 11.52 | 11.52 | 5.76 | | |
| 5-yr MQ Q1 | 35.00 | 26.00 | 15.60 | 11.01 | 11.01 | 1.38 | | |
| 5-yr MQ Q2 | 25.00 | 30.00 | 18.00 | 11.37 | 11.37 | 4.26 | | |
| 5-yr MQ Q3 | 15.00 | 34.00 | 20.40 | 12.24 | 11.30 | 7.06 | | |
| 5-yr MQ Q4 | 5.00 | 38.00 | 22.80 | 13.68 | 10.94 | 9.58 | | |
| 7-yr HY (200DB) | 14.29 | 24.49 | 17.49 | 12.49 | 8.93 | 8.92 | 8.93 | 4.46 |
| 7-yr MQ Q1 | 25.00 | 21.43 | 15.31 | 10.93 | 8.75 | 8.74 | 8.75 | 1.09 |
| 7-yr MQ Q2 | 17.85 | 23.47 | 16.76 | 11.97 | 8.87 | 8.87 | 8.87 | 3.34 |
| 7-yr MQ Q3 | 10.71 | 25.51 | 18.22 | 13.02 | 9.30 | 8.85 | 8.86 | 5.53 |
| 7-yr MQ Q4 | 3.57 | 27.55 | 19.68 | 14.06 | 10.04 | 8.73 | 8.73 | 7.64 |

My formula gives 17.86 for 7-yr Q2 year 1 and 3.33 for year 8. The published values of 17.85 and 3.34 shown above should be checked against Pub 946 Table A-3 **[VERIFY]**. Other classes: 3-yr HY is 33.33 / 44.45 / 14.81 / 7.41; 15-yr 150DB HY starts at 5.00 / 9.50 / 8.55; 20-yr 150DB HY starts at 3.750 / 7.219.

**39-yr nonresidential, MM, first-year % by month placed in service** (Table A-7a): Jan 2.461, Feb 2.247, Mar 2.033, Apr 1.819, May 1.605, Jun 1.391, Jul 1.177, Aug 0.963, Sep 0.749, Oct 0.535, Nov 0.321, Dec 0.107. Years 2–39 are 2.564% [H]. **27.5-yr** first year: Jan 3.485 … Jul 1.667 … Dec 0.152; later years 3.636/3.637 [H]. **40-yr ADS MM**: Jan 2.396 [H, computed].

**Short tax years (Rev. Proc. 89-15, 1989-1 C.B. 816).**
- Under HY, property placed in service in a short year is treated as placed in service at the midpoint of the short year.
- Under MQ, the short year is divided into four equal "quarters," and the 40% test looks at the last three *months* of the short year.
- Under MM, the rule is the mid-point of the month as usual.
- Later years use either the allocation method (each recovery year straddles tax years) or the simplified method (the rate is applied to the adjusted basis at the start of the year).

[H for structure; the exact simplified-method formula is M]. A short year can be triggered by:
- incorporation;
- joining or leaving a consolidated group;
- a change of accounting period;
- a final return;
- a partnership termination under §708(b)(1)(B) (repealed for tax years after 2017).

### 2.2 When ADS is mandatory (§168(g)(1)) or elected

ADS is mandatory for:
- (A) tangible property used predominantly outside the U.S., subject to the §168(g)(4) exceptions;
- (B) tax-exempt use property (§168(h));
- (C) tax-exempt-bond-financed property;
- (D) imported property covered by an executive order;
- (E) property for which ADS is elected;
- (F) nonresidential real property, residential rental property, and QIP held by an **electing real property trade or business** under §163(j)(7)(B);
- (G) property with a recovery period of 10 years or more held by an **electing farming business** under §163(j)(7)(C);
- listed property with qualified business use of 50% or less (§280F(b)(1));
- for E&P only, §312(k).

[H]. Property on ADS is ineligible for bonus (§168(k)(2)(D)) [H]. For an electing real property trade or business (RPTB), residential rental property placed in service before 2018 uses a 30-year ADS period (CAA 2021 §202) [M]. Switching to ADS because of a §163(j) election is a *change in use* under Reg. §1.168(i)-4(d), not a method change (Rev. Proc. 2019-8) [M]. The ADS election itself (§168(g)(7)) is made by class, per year, and is irrevocable. For real property it is made property by property [H].

Context: OBBBA §70303 restored EBITDA-based adjusted taxable income (ATI), which adds back depreciation, for tax years beginning after 2024 [H]. Electing out of §163(j) is therefore less attractive, and the ADS cost of the election matters more.

### 2.3 Bonus depreciation — §168(k) before and after P.L. 119-21

**Qualified property** (§168(k)(2)):
- MACRS property with a recovery period of 20 years or less;
- off-the-shelf software under §167(f);
- water utility property;
- QIP (the CARES Act fix, retroactive to 2018);
- qualified film, TV and live-theatrical productions. OBBBA added qualified sound-recording productions [M]. Notice 2026-11 addresses this [H], but the effective date is [VERIFY].

Used property qualifies if the taxpayer and its predecessors did not use it before, it is not acquired from a related party, and its basis is not carried over (Reg. §1.168(k)-2(b)(3)(iii); §179(d)(2)) [H].

Exclusions:
- ADS property;
- regulated public utility property (§168(k)(9)(A));
- property of a business with floor-plan financing interest taken into account under §163(j) (§168(k)(9)(B)) [H].

**Applicable-percentage regimes** (statute as amended; Notice 2026-11):

| Property | Acquired (binding contract) | Placed in service | % |
|---|---|---|---|
| General | after 2017-09-27 and before 2025-01-20 | 2018–2022 | 100 |
| General | same | 2023 | 80 |
| General | same | 2024 | 60 |
| General | same | 2025 | 40 |
| General | same | 2026 | 20 |
| General | same | 2027+ | 0 |
| LPPP / non-commercial aircraft (§168(k)(2)(B),(C)) | before 2025-01-20 | 2023 | 100 |
| LPPP / non-commercial aircraft | same | 2024 | 80 |
| LPPP / non-commercial aircraft | same | 2025 | 60 |
| LPPP / non-commercial aircraft | same | 2026 | 40 |
| LPPP / non-commercial aircraft | same | 2027 | 20 |
| Any qualified property | **after 2025-01-19** | any date (no sunset) | **100** |
| Specified plants (§168(k)(5)) | planted/grafted after 2025-01-19 | n/a | 100 |
| Specified plants | planted/grafted before 2025-01-20 | 2025 / 2026 | 40 / 20 |

The pre-cutoff rows are [H]. For LPPP placed in service in 2027, only pre-2027 progress expenditures qualify [M]. The post-cutoff 100% rate is [H].

**Acquisition date.**
- Purchased property is acquired on the date of a written binding contract (Reg. §1.168(k)-2(b)(5)) [H].
- Self-constructed property is acquired when manufacture, construction or production begins. That is tested by physical work of a significant nature, or by the safe harbor of incurring more than 10% of total cost [H]. Notice 2026-11 carries both tests forward with the new date [H].
- **Component election**: where a larger self-constructed property began before 2025-01-20, components acquired or begun after 2025-01-19 may be treated as eligible for 100% [H].
- Data requirement: contract date, construction-start date and cost-incurred curve, by component.

**Elections.**
- *Elect out* (§168(k)(7)): by class of property, per tax year, on a timely-filed return including extensions. It applies to all property in the class placed in service that year (Reg. §1.168(k)-2(f)(1)) [H].
- *Transition election* (§168(k)(10), as rewritten by OBBBA): for the first tax year ending after 2025-01-19, the taxpayer may apply 40% (60% for LPPP/aircraft) in place of 100% to property acquired after the cutoff [H]. For a calendar-year taxpayer that is tax year 2025. For a fiscal year July 2024–June 2025, it is that fiscal year.
  - The statute frames this as a *taxable-year* election. Whether Notice 2026-11 lets it be made class by class, and what relief exists for returns filed before the notice, is **[VERIFY]**.
- *Specified-plant election* (§168(k)(5)): bonus is taken in the year of planting or grafting rather than the year placed in service [H].

**No bonus** applies when property is placed in service and disposed of in the same year (Reg. §1.168(k)-2(g)(1)) [H].

Sources: [Notice 2026-11](https://www.irs.gov/pub/irs-drop/n-26-11.pdf); EY [2026-0250](https://taxnews.ey.com/news/2026-0250-irs-issues-interim-guidance-on-bonus-depreciation); [BDO](https://www.bdo.com/insights/tax/irs-issues-interim-guidance-on-bonus-depreciation-rules); [EisnerAmper](https://www.eisneramper.com/insights/real-estate/notice-2026-11-confirms-tcja-bonus-depreciation-framework-0126/).

### 2.4 §168(n) — qualified production property (QPP)

The allowance is 100% of the adjusted basis of QPP in the year placed in service, by election designating the property [H]. Requirements for QPP:
- nonresidential real property used by the *taxpayer* as an integral part of a qualified production activity (QPA);
- located in the U.S. or a possession;
- original use begins with the taxpayer, or the property is acquired property not used in a QPA from 2021-01-01 through 2025-05-12 [M];
- construction begins after 2025-01-19 and before 2029-01-01;
- placed in service before 2031-01-01.

[H for the dates]. A QPA is manufacturing, production (limited to agricultural and chemical production [M]), or refining of tangible personal property that results in a *substantial transformation* [H].

Excluded portions [M]:
- offices, administrative areas and lodging;
- parking;
- sales;
- R&D, software and engineering areas;
- finished-goods storage, packaging and labeling.

Also excluded: property used by a lessee, which does not qualify for the lessor [H], and ADS property [M].

**Recapture**: if within 10 years of placement in service the property stops being used as an integral part of a QPA, ordinary-income recapture applies on §1245 principles [H, details M]. QPP appears to be treated as §1245 property on disposition [M — VERIFY].

The AMT, CAMT and E&P treatment of the §168(n) deduction is **[VERIFY]**. Interim guidance: [Notice 2026-16](https://www.irs.gov/pub/irs-drop/n-26-16.pdf) (2026-02-20; comments were due 2026-04-20). See also [KPMG](https://kpmg.com/us/en/taxnewsflash/news/2026/02/notice-2026-16-guidance-special-depreciation-allowance-qualified-production-property.html) and [EY 2026-0577](https://taxnews.ey.com/news/2026-0577-interim-guidance-clarifies-100-percent-special-depreciation-allowance-for-qualified-production-property-under-new-irc-section-168n). California does not conform [M].

### 2.5 §179 expensing

- **Limits.** The dollar limit is reduced dollar for dollar by the cost of §179 property placed in service above the threshold.
  - 2025: $2.5M limit, $4.0M threshold, fully phased out at $6.5M (OBBBA §70306, tax years beginning after 2024) [H].
  - 2026: $2.56M limit, $4.09M threshold, fully phased out at $6.65M (Rev. Proc. 2025-32) [H].
  - Indexing uses calendar year 2024 as the base for years after 2025 [M].
  - Pre-OBBBA, Rev. Proc. 2024-40 had set 2025 at $1.25M/$3.13M. That is superseded and must be end-dated in the data.
- **Qualifying property** (§179(d)(1), (e)):
  - tangible §1245 property;
  - off-the-shelf software;
  - *qualified real property*: QIP, and roofs, HVAC, fire-protection/alarm and security systems on nonresidential real property placed in service after the building.

  The property must be used more than 50% in the active conduct of a trade or business (Reg. §1.179-1(d)) [H].
- **Taxable-income limitation** (§179(b)(3)): §179 expense cannot exceed aggregate active trade-or-business income. For individuals that includes wages. Any excess carries forward indefinitely, ordering per Reg. §1.179-3 [H].
- **SUV cap** (§179(b)(5)) for 6,001–14,000 lb GVWR: $31,300 for 2025, $32,000 for 2026. Excluded from the cap:
  - pickups with a cargo bed of 6 ft or more not readily accessible from the passenger compartment;
  - cargo vans with no seating behind the driver;
  - vehicles seating more than 9 behind the driver.

  [H].
- **Entity rules**:
  - The limit applies at *both* the partnership/S-corp level and the owner level (§179(d)(8)) [H]. The entity reduces basis by the full elected amount even if an owner cannot use it [H].
  - The owner's phase-out does not count entity-level property [M].
  - Pass-through reporting: Form 1065 K-1 box 12 and Form 1120-S K-1 box 11 [H]. When the entity disposes of §179 property, the partner-level gain computation is reported on the 1065 K-1 (box 20, code L [M]).
  - Married filing separately: the limit is split 50/50 unless the spouses elect otherwise (§179(b)(4)).
  - A controlled group shares one limit (§179(d)(6)).
  - **Estates and trusts are not eligible** (§179(d)(4)).
  - Noncorporate lessors face restrictions (§179(d)(5)).

  [H].
- **Election and revocation** are made on Form 4562. The election can be made or revoked on an amended return without consent (§179(c)(2), made permanent by PATH 2015) [H].
- **Recapture** applies if business use falls to 50% or less in any year of the recovery period (§179(d)(10); Form 4797 Part IV) [H].

### 2.6 §280F listed property and luxury autos

**Listed property** (§280F(d)(4)): passenger automobiles, other property used as a means of transportation, and entertainment/recreation property. Computers were removed by TCJA for property placed in service after 2017 [H].

If qualified business use is 50% or less:
- the property must use ADS SL;
- no §179 and no bonus are allowed;
- if business use later drops to 50% or less, excess depreciation is recaptured (§280F(b)) [H].

Investment use counts toward the depreciation percentage but not toward the >50% test. Use by a 5% owner or related person under a compensation arrangement is not qualified business use (§280F(d)(6)) [H].

**Passenger automobiles**: rated at 6,000 lb unloaded gross vehicle weight or less (gross vehicle weight for trucks and vans). Qualified non-personal-use vehicles are excepted [H]. Caps by placed-in-service year are in §4 below.
- The cap is multiplied by the business-use percentage [H].
- The "with bonus" first-year cap equals the base cap plus $8,000 (§168(k)(2)(F)) [H; 2026: $12,300 + $8,000 = $20,300].
- Basis not recovered within the recovery period is deducted at the year-4+ cap per year after the recovery period ends [H].
- **Rev. Proc. 2019-13 safe harbor**: for 100%-bonus autos whose cost exceeds the year-1 cap, the taxpayer depreciates the remaining basis in years 2–6 using table percentages, subject to the caps. It is not available if §179 was elected [M].
- **Lease inclusion** (§280F(c)): FMV thresholds are $62,000 for 2024, $60,000 for 2025 **[VERIFY]** and $62,000 for 2026 [M]. Tables are in Rev. Procs. [2025-16](https://irs.gov/pub/irs-drop/rp-25-16.pdf) and [2026-15](https://www.irs.gov/pub/irs-drop/rp-26-15.pdf).
- Short tax years: the caps are prorated **[VERIFY: mechanism under Rev. Proc. 89-15 / Pub 946]**.

### 2.7 QIP and building improvements

QIP (§168(e)(6)) is an improvement by the taxpayer to an *interior* portion of nonresidential real property, placed in service after the building was first placed in service. Excluded are:
- enlargements;
- elevators and escalators;
- internal structural framework.

QIP is 15-yr SL under GDS and 20-yr under ADS. It is bonus-eligible and §179-eligible [H]. It is §1250 property: bonus taken on it creates *additional depreciation* subject to §1250 ordinary recapture. §179 taken on it is recaptured under §1245(a)(3)(C) [M–H]. Pre-2018 categories (qualified leasehold, restaurant and retail improvement property) are legacy 15-yr classes and must remain in the class table end-dated 2017-12-31 [H].

### 2.8 Basis reductions from credits and deductions

| Item | Basis effect | Notes |
|---|---|---|
| §47 rehabilitation credit | −100% of credit (§50(c)(1)) | 5-yr ITC recapture under §50(a) restores basis |
| §48 energy / §48E clean-electricity ITC | −50% of credit (§50(c)(3)) | §48E inclusion [M]; OBBBA wind/solar phase-outs (begin construction by 2026-07-04 or place in service by end of 2027) [M — VERIFY] |
| §45L new energy-efficient home credit | −credit (§45L(e)) | OBBBA terminates for homes acquired after 2026-06-30 [M — VERIFY] |
| §179D deduction | −deduction (§179D(e)); recapture under §1245(a)(3)(C) | OBBBA terminates for property whose construction begins after 2026-06-30 [M — VERIFY] |
| §30C refueling property; §45W commercial clean vehicle | −credit | OBBBA termination dates (§45W: acquired after 2025-09-30; §30C: placed in service after 2026-06-30) [M — VERIFY] |
| §1.168(k) / §179 | −deduction (§1016(a)(2)) | |

### 2.9 Amortization

- **§197**: 15-year (180-month) SL, starting in the month acquired [H].
  - Covers goodwill, going concern value, workforce, customer- and supplier-based intangibles, licenses and permits, covenants not to compete entered into in connection with an acquisition, and franchises/trademarks/trade names.
  - Excludes self-created intangibles (with exceptions), off-the-shelf software (36-month §167(f)), separately acquired patents and copyrights (§167), mortgage servicing rights (9-yr), and interests in entities.
  - The loss-disallowance rule (§197(f)(1)) moves the basis of a disposed intangible to the retained §197 intangibles from the same acquisition.
  - §197 intangibles are §1245 property (§197(f)(7)).
  - Anti-churning (§197(f)(9)) applies to pre-1993-08-10 goodwill.

  [H].
- **§195 start-up, §248 corporate organizational, and §709 partnership organizational costs**: up to $5,000 is deductible in the year business begins, reduced dollar for dollar by costs above $50,000. The remainder is amortized over 180 months from the month business begins. The election is deemed made (Regs. §1.195-1(b), §1.248-1(c), §1.709-1(b)) [H]. Syndication costs are never deductible (§709) [H]. Unamortized amounts are deducted on liquidation or disposition of the business [H].
  - Example: $52,000 of start-up costs, business begins in October. Immediate deduction = $5,000 − $2,000 = $3,000. Monthly amortization = $49,000 / 180 = $272.22, so year 1 = $3,000 + $816.67.
- **§174 / §174A**:
  - Tax years beginning 2022–2024: specified R&E was capitalized and amortized over 5 years (domestic) or 15 years (foreign) using a mid-year convention.
  - Tax years beginning after 2024: domestic R&E is deductible under §174A, or elected 60-month+ amortization under §174A(c). §280C(c) coordination applies [H].
  - Foreign R&E stays at 15 years and gets no basis recovery on disposition (§174(d)) [H].
  - Transition: unamortized 2022–2024 domestic amounts are deducted in the first tax year beginning after 2024, or ratably over two years [H].
  - Small-business (§448(c), $31M for 2025) retroactive election under Rev. Proc. 2025-28, deadline **2026-07-06** [H].
  - Method changes: DCN 265 (old §174) and DCN 274 (§174A, Rev. Proc. 2026-32 §7.03(1)(a)) [M].
  - Depreciation on research-use property was itself an R&E cost in 2022–2024. The engine needs an "R&E-use %" allocation flag on assets [M].

  Sources: [Rev. Proc. 2025-28](https://www.irs.gov/pub/irs-drop/rp-25-28.pdf); [Rev. Proc. 2026-32](https://www.irs.gov/pub/irs-drop/rp-26-32.pdf); [EY 2026-1977](https://taxnews.ey.com/news/2026-1977-irs-expands-ability-to-make-automatic-accounting-method-changes-for-research-or-experimental-expenditures-and-certain-long-term-contracts); [CFGI](https://www.cfgi.com/2026/05/08/section-174a-retroactive-relief-july-6-deadline/).

### 2.10 Legacy regimes: ACRS, pre-1981, anti-churning

- **ACRS** (property placed in service 1981-01-01 through 1986-12-31; TRA '86 allowed electing MACRS for property placed in service after 1986-07-31) [H].
  - Classes: 3-yr, 5-yr, 10-yr, and 15-yr public utility property. Real property is 15-yr (through 1984-03-15), 18-yr (1984-03-16 to 1985-05-08) or 19-yr (after 1985-05-08), with optional SL over 35 or 45 years.
  - Statutory percentages come from Prop. Reg. §1.168-2. Example: 5-yr is 15/22/21/21/21.
  - Personal property got no depreciation in the year of disposition.
  - *ACRS nonresidential real property on accelerated percentages is "§1245 recovery property"*: **all** depreciation is recaptured as ordinary income (§1245(a)(5) as then in effect) [M].
  - SL-elected 45-yr ACRS real property placed in service in 1985–86 is *still depreciating until about 2030–31* [M]. The engine needs ACRS tables and SL-elected periods.
- **Pre-1981** (§167): useful life (ADR, Reg. §1.167(a)-11 for 1971–80), salvage value, and SL, 200% or 150% DB, or sum-of-years-digits, with §167(j) limits on real property [H]. Pre-1976 §1250 "applicable percentage" phase-outs for additional depreciation are **[VERIFY before supporting]**. Recommendation: support these as frozen "user-specified" schedules with recapture character tags rather than full rule logic.
- **Anti-churning** (§168(f)(5)): property placed in service before 1987 by the taxpayer or a related party and reacquired after 1986 cannot use MACRS. Residential rental and nonresidential real property are excepted [M].

### 2.11 Alternative depreciation books

**Individual AMT** (§56(a)(1); Form 6251 line 2l) [H]:

| Property placed in service | Regular-tax method | AMT method |
|---|---|---|
| After 1998 | 200% DB (3/5/7/10-yr) | 150% DB over the same recovery period |
| After 1998 | 150% DB, SL, or real property | No adjustment |
| 1987–1998 | Personal property | 150% DB over ADS class life |
| 1987–1998 | Real property | 40-yr SL |

- Bonus property, and the regular depreciation on its remaining basis, gets **no AMT adjustment** (§168(k)(2)(G)), unless the taxpayer elected out of bonus.
- §179 gets no adjustment.
- Gain on disposition uses AMT basis.
- Pass-through entities compute the adjustment and report it on K-1s.
- The AMT treatment of §168(n) is **[VERIFY]**.

**Corporate AMT (CAMT)** applies to applicable corporations: three-year average AFSI above $1B, or $100M for certain foreign-parented groups. Under §56A(c)(13), AFSI is adjusted to *remove* AFS depreciation on "section 168 property" and *deduct* tax depreciation instead, including bonus. Book gain or loss on disposition is replaced by a tax-basis computation (Prop. Reg. §1.56A-15, REG-112129-23, Sept. 2024; Notices 2023-7, 2023-64, 2024-10) [M].

Open points, all **[VERIFY]**:
- whether §179 counts as "covered tax depreciation";
- whether §168(n) QPP counts;
- whether OBBBA changed the AFSI treatment of R&E;
- later interim notices (2025-27, 2025-46, 2025-49).

The engine needs a per-asset **CAMT ledger**: tax depreciation on §168 property, the AFS depreciation add-back, and cumulative adjustments for dispositions.

**E&P** (§312(k)): ADS is required for tangible property placed in service after 1986. **§179 is deducted ratably over 5 years** for E&P (§312(k)(3)(B)). Bonus is not allowed for E&P [H]. The E&P treatment of §168(n) is [VERIFY]. This book is needed for C corporations, for S corporations with accumulated E&P, and for foreign-subsidiary E&P (§312(k)(4) exception — [VERIFY]).

### 2.12 Tangible property regulations (Treas. Reg. §§1.162-3, 1.263(a)-1/-2/-3, 1.168(i)-1, 1.168(i)-8)

**De minimis safe harbor** (Reg. §1.263(a)-1(f)) [H]:
- $5,000 per invoice or item for taxpayers with an AFS and a written policy.
- $2,500 for taxpayers without an AFS, for tax years beginning after 2015 (Notice 2015-82).
- The election is annual, by statement. The threshold is not indexed.

**Materials and supplies** (Reg. §1.162-3): items costing $200 or less, items with a useful life of 12 months or less, and certain components [H].

**Unit of property and improvements** (Reg. §1.263(a)-3): capitalize amounts that produce a **betterment**, a **restoration** or an **adaptation** (the BAR tests) [H]. For a building, the tests are applied separately to the building structure and to each of nine structural systems:
- HVAC;
- plumbing;
- electrical;
- escalators;
- elevators;
- fire protection;
- security;
- gas distribution;
- other systems specified in published guidance.

[H].

**Safe harbors**:
- *Routine maintenance*: maintenance expected more than once in 10 years (buildings), or more than once in the ADS class life (other property) [H].
- *Small taxpayer safe harbor for buildings*: average gross receipts of $10M or less, building unadjusted basis of $1M or less, and annual repair/improvement spending no more than the lesser of $10,000 or 2% of basis [H].
- *Election to capitalize repairs* to follow book treatment [H].
- *Remodel-refresh safe harbor* (Rev. Proc. 2015-56) for retail and restaurant: deduct 75%, capitalize 25% [H].

**Dispositions and partial dispositions** (Reg. §1.168(i)-8) [H]:
- A disposition includes a sale, exchange, retirement, physical abandonment, destruction, or transfer to supplies or scrap.
- Converting property to personal use is *not* a disposition.
- The partial-disposition rule is *mandatory* for a sale of a portion, a casualty, a §1031/§1033 transaction, or a step-in-the-shoes transfer of a portion.
- Otherwise it is an *election* on a timely return for the year of disposition, used for example to write off a replaced roof. A late election is possible by Form 3115 only after an IRS capitalization on exam (§1.168(i)-8(d)(2)(iv)) **[VERIFY DCN]**.
- If the disposed portion's basis is unknown, the regulations allow any reasonable method, such as PPI discounting, cost segregation, or the replacement cost discounted.

**General asset accounts** (Reg. §1.168(i)-1) [H]:
- Assets are pooled when they share class, method, period, convention and placed-in-service year.
- On disposition, the amount realized is ordinary income up to (unadjusted depreciable basis + expensed amounts − previously recognized ordinary income).
- No loss is recognized unless the taxpayer makes a qualifying-disposition election or an abusive-transaction rule applies.
- The GAA election is made on Form 4562 line 18.

### 2.13 Change in use, replacement property, carryover-basis transfers

- **Change in use** (Reg. §1.168(i)-4) [H]:
  - Personal to business use: the property is deemed placed in service on the conversion date, with basis equal to the lesser of FMV or adjusted basis (Reg. §1.168(i)-4(b), §1.167(g)-1). Bonus eligibility on conversion is **[VERIFY under Reg. §1.168(k)-2(g)(6)]**.
  - A change to a shorter period or a faster method may either continue the old schedule or be treated as newly placed in service.
  - A change to a longer period or ADS (e.g., moved abroad, tax-exempt use, §163(j) election) depreciates the adjusted basis over the remaining *new* period as if originally placed in service in the new class.
- **Like-kind and involuntary-conversion replacement property** (Reg. §1.168(i)-6) [H]:
  - The *exchanged basis* continues the relinquished property's remaining period, method and convention, where the replacement has the same or shorter period and the same or faster method; otherwise the replacement property's slower/longer attributes govern.
  - *Excess basis* is new property.
  - An election out under §1.168(i)-6(i) treats the whole basis as newly placed in service.
  - Bonus: new (original-use) replacement property is eligible on both basis portions, used property only on excess basis (Reg. §1.168(k)-2(g)(5)) [M].
  - The disposition-year and acquisition-year allocation follows §1.168(i)-6(c)(5).
- **Step-in-the-shoes** (§168(i)(7)): in §§332, 351, 361, 721 and 731 transfers, the transferee continues the transferor's depreciation on carryover basis, and the first-year depreciation is split between them by months [H].
- **Partnership basis adjustments**: a §743(b) step-up is treated as newly purchased property and is bonus-eligible (Reg. §1.743-1(j)(4); §1.168(k)-2(b)(3)(iv)(D)). A §734(b) adjustment is *not* bonus-eligible [H]. §704(c) methods (traditional, curative, remedial) require partner-level tracking.

### 2.14 Cost segregation

Cost segregation reclassifies building costs into §1245 components (5- or 7-yr, e.g. under asset class 57.0) and land improvements (00.3, 15-yr), with the remainder as 39- or 27.5-yr structure. The relevant tests are the *Whiteco* inherent-permanency factors (65 T.C. 664 (1975)) and *Hospital Corp. of America*, 109 T.C. 21 (1997). See the IRS [Cost Segregation Audit Techniques Guide](https://www.irs.gov/businesses/cost-segregation-audit-techniques-guide-table-of-contents) [H].

With 100% bonus permanent, the reclassified components are immediately deductible. QPP now makes even the "structure" portion 100% deductible for qualifying factories. A look-back study for prior years uses DCN 7, with a negative §481(a) adjustment taken in full in the year of change [H].

Risk: a later §1031 exchange of a cost-segregated building into real property with less §1245 property triggers §1245 recapture under §1245(b)(4) [M–H].

### 2.15 Dispositions and character

**Disposition-year conventions** [H]:
- HY: half of the full-year amount.
- MQ: the full-year amount × 12.5%, 37.5%, 62.5% or 87.5%, for a disposition in Q1 to Q4 respectively.
- MM: (months before the disposition month + 0.5) / 12.
- No depreciation for property placed in service and disposed of in the same year.

**Types of disposition** [H]:
- **Sale or exchange**: gain or loss = amount realized − adjusted basis.
- **§1031**: limited to real property for exchanges completed after 2017 (TCJA §13303). Recapture is deferred except under §1245(b)(4) and §1250(d)(4).
- **§1033 involuntary conversion**: the replacement period is 2 years, or 3 years for condemned business/investment real property (longer for certain federally declared disasters); [M] for the disaster variants.
- **Casualty (§165)**: the business loss is the lesser of the decline in FMV and adjusted basis, or adjusted basis if the property is totally destroyed. Casualty gains and losses are netted first under §1231(a)(4)(C).
- **Abandonment or retirement**: an ordinary loss equal to adjusted basis (§165; Reg. §1.168(i)-8).

**Character** [H]:
- **§1245**: ordinary income equal to the lesser of gain or all depreciation and amortization taken. This includes §179, bonus, §197, and §179D on real property under §1245(a)(3)(C).
- **§1250**: ordinary income equal to *additional depreciation* (excess over SL; all depreciation if held 1 year or less).
  - MACRS real property on SL normally has none.
  - **Bonus on QIP does create additional depreciation** [M–H].
- **Unrecaptured §1250 gain** (§1(h)(6)): SL depreciation on real property not recaptured as ordinary, taxed at up to 25%. *Noncorporate taxpayers only.*
- **§291(a)(1)**: C corporations recharacterize 20% of the excess of (hypothetical §1245 amount − §1250 amount) as ordinary income. This also applies to S corporations that were C corporations in any of the prior 3 years (§1363(b)(4)).
- **§1231**: business property held more than 1 year. A net gain is long-term capital gain and a net loss is ordinary. The **5-year lookback** (§1231(c)) recharacterizes net gain as ordinary to the extent of nonrecaptured net §1231 losses from the prior 5 years. It is tracked at the *taxpayer* level, so partners and shareholders apply it on their own returns.
- **§1239**: *all* gain on sale of depreciable property between related persons is ordinary. Related persons include a person and a >50%-controlled entity, and §267(b) relationships. The installment method is denied (§453(g)).
- **Installment sales** (§453(i)): all §1245/§1250/§291 recapture income is recognized in the year of sale, and the gross-profit ratio is computed after adding recapture to basis. Unrecaptured §1250 gain is taken first from payments (Reg. §1.453-12) [H].

**Reporting**: Form 4797 [H]:
- Part I: §1231.
- Part II: ordinary.
- Part III: recapture.
- Part IV: §179/§280F business-use recapture.

Related forms: 8824 (like-kind exchanges), 6252 (installment sales), 4684 (casualties and thefts), 4255 (ITC recapture).

### 2.16 Accounting-method changes for depreciation (Form 3115; §481(a))

**Current list.** [Rev. Proc. 2025-23](https://www.irs.gov/pub/irs-irbs/irb25-24.pdf) (2025-24 I.R.B. 1481) applies to Forms 3115 filed on or after 2025-06-09 for years ending on or after 2024-10-31. It was modified by Rev. Proc. 2025-28 and by [Rev. Proc. 2026-32](https://www.irs.gov/pub/irs-drop/rp-26-32.pdf) (2026-09-04, effective for Forms 3115 filed after that date) [H]. No full replacement list for 2026 was found [M]. The general procedures, including audit protection, are in Rev. Proc. 2015-13.

**Depreciation-related DCNs** [M–H unless noted]:

| DCN | Rev. Proc. 2025-23 section | Change |
|---|---|---|
| 7 | §6.01 | Impermissible to permissible depreciation/amortization, property held at the beginning of the year of change. Requires use of the impermissible method on 2+ returns. If only one return, amend instead. |
| 107 | §6.07 | Impermissible to permissible depreciation for disposed property |
| (unknown) | §6.02 | Permissible to permissible (e.g., to or from GAA; certain method switches) **[VERIFY DCN]** |
| 199 | §6.11 | Leasehold improvement depreciation (§1.167(a)-4) **[VERIFY]** |
| 200 | §6.12 | GAA grouping |
| 205 | §6.13 | Disposition of a building or structural component (§1.168(i)-8) |
| 206 | §6.14 | Disposition of other property (§1.168(i)-8) |
| 207 | §6.15 | Assets disposed of from a GAA |
| 184 / 186 / 192 | §11.08 etc. | Tangible-property-regulation repair and materials-and-supplies changes **[VERIFY]** |
| 244 / 245 (and others) | — | Late QIP, late bonus elections and electing-RPTB ADS (Rev. Proc. 2020-25 family) **[VERIFY]** |
| 265, 274 | — | R&E (§174, §174A) |

**§481(a).** A negative adjustment is taken entirely in the year of change. A positive adjustment is spread over 4 years [H].

**Not method changes** (Reg. §1.446-1(e)(2)(ii)(d)(3)): a change in use, a change in placed-in-service date, and most elections. Elections need §9100 relief unless specific guidance provides otherwise [H].

### 2.17 Entity-type matrix

| Rule | C corp | S corp | Partnership | Individual | Trust/estate |
|---|---|---|---|---|---|
| §179 | Entity limit; controlled-group sharing | Entity + shareholder limit; K-1 box 11 | Entity + partner limit; K-1 box 12 | MFS split; wages count toward income limit | **Not allowed** |
| Bonus / ADS / 150DB elections | Entity (common parent for a consolidated group) | Entity | Entity (§703(b)) | Individual | Fiduciary |
| MQ 40% test | Entity (consolidated group aggregate) | Entity | Entity | Individual | Fiduciary |
| §291 | Yes | Only with C history in prior 3 yrs | No | No | No |
| Unrecaptured §1250 (25%) | No | Flows through | Flows through | Yes | Yes |
| §1231 lookback | Corp level | Shareholder level | Partner level | Yes | Yes |
| Individual AMT | No (repealed) | Computes and passes through | Computes and passes through | Yes | Yes |
| CAMT (§56A) | Applicable corps only | No | Distributive share of AFSI to corporate partners | No | No |
| E&P (§312(k)) | Yes | If accumulated E&P | No | No | No |
| §743(b)/§734(b) | — | — | Yes | — | — |
| §195/§248/§709 | §195 + §248 | §195 + §248 | §195 + §709 | §195 | §195 |
| §174A small-business retro election (expired 2026-07-06) | Eligible if §448(c) test met | Same | Same | Same | Same |

---

## 3. Worked examples

All examples were computed in the scratchpad from the published rates.

**A. Mid-quarter trigger and §179 selection (2026, calendar year, bonus elected out for both classes).** 7-yr equipment costing $100,000 is placed in service in March. 5-yr equipment costing $200,000 is placed in service in November.
- Q4 share = 200/300 = **66.7% > 40%**, so MQ applies. Depreciation = $100,000 × 25.00% + $200,000 × 5.00% = **$35,000**. Under HY it would have been $54,290.
- If $150,000 of §179 is elected on the November asset, Q4 basis falls to $50,000, and 50 / 150 = 33.3%, so HY applies. Depreciation = $14,290 + $10,000 = $24,290, plus §179 of $150,000, for a total of **$174,290**.
- Engine requirement: an optimizer that chooses which assets to expense.

**B. 39-yr MM.** A $2,000,000 nonresidential building portion placed in service in March 2026: year 1 = 2.033% → **$40,660**; year 2 = 2.564% → $51,280.

**C. §1245 recapture.** A 7-yr machine costing $100,000, placed in service in 2023 with bonus elected out, HY, is sold in 2026 (year 4, HY disposition).
- Accumulated depreciation = 14,290 + 24,490 + 17,490 + (12,490 × ½) = **$62,515**. Adjusted basis = $37,485.
- Sold for $70,000: gain of $32,515, all §1245 ordinary.
- Sold for $105,000: gain of $67,515, of which **$62,515 is §1245 ordinary and $5,000 is §1231**.
- With 2023's 80% bonus instead: accumulated = $92,503, adjusted basis = $7,497.

**D. §1250 / §291 / unrecaptured §1250.** A $1,000,000 nonresidential building placed in service in January 2016 is sold in December 2026 for $1,200,000.
- Accumulated SL = $24,610 + 9 × $25,640 + $25,640 × 11.5/12 = **$279,941.67**. Adjusted basis = $720,058.33. Gain = $479,941.67.
- Individual or partner: $279,941.67 unrecaptured §1250 (25% max rate) + $200,000 §1231.
- C corp: §291 ordinary = 20% × $279,941.67 = **$55,988.33**; §1231 = $423,953.33.

**E. Bonus on QIP creates §1250 recapture.** $500,000 of QIP with 100% bonus in 2025 is sold in 2027.
- SL equivalent (15-yr, HY): $66,666.67.
- Additional depreciation of **$433,333.33** is §1250 ordinary, to the extent of gain. The remaining $66,666.67 is unrecaptured §1250 for noncorporate taxpayers.
- **[M–H; VERIFY with Form 4797 instructions]**

**F. §179 phase-out.** 2025, $4.5M of §179 property placed in service: limit = $2.5M − $0.5M = **$2.0M**. 2026, $5.0M placed in service: limit = $2.56M − $0.91M = **$1.65M**.

**G. 2025 transition (calendar year).**
- Asset X: binding contract December 2024, placed in service March 2025, cost $100,000 → 40% bonus = $40,000. The remaining $60,000 × 20% (5-yr HY) = $12,000.
- Asset Y: contract February 2025 → 100%, unless the §168(k)(10) election is made → 40%.

**H. Short year.** A corporation's first tax year runs July–December 2026 (6 months). A 5-yr asset costing $10,000 under HY is deemed placed in service at the midpoint, giving 3 months: $10,000 × 40% × 3/12 = **$1,000** (bonus elected out).

**I. §280F (2026).** A $60,000 car with 100% business use and bonus is capped at **$20,300 / $19,800 / $11,900 / $7,160 per year thereafter** until basis is recovered. At 80% business use, year 1 = $16,240.

**J. Installment sale with recapture.** Price $500,000 (20% down), adjusted basis $100,000, §1245 recapture $300,000. The $300,000 is recognized in year 1. Gross profit = $500,000 − ($100,000 + $300,000) = $100,000, a ratio of 20%.

---

## 4. Current-year amounts (2024 / 2025 / 2026)

| Parameter | 2024 | 2025 | 2026 | Keyed on | Source / confidence |
|---|---|---|---|---|---|
| §179 dollar limit | $1,220,000 | **$2,500,000** | **$2,560,000** | Tax year beginning | Rev. Proc. 2023-34; OBBBA §70306; Rev. Proc. 2025-32 [H] |
| §179 phase-out threshold | $3,050,000 | **$4,000,000** | **$4,090,000** | Tax year beginning | same [H] |
| §179 fully phased out at | $4,270,000 | $6,500,000 | $6,650,000 | derived | [H] |
| §179(b)(5) SUV cap | $30,500 | **$31,300** | **$32,000** | Tax year beginning | Rev. Procs. 2023-34, 2024-40, 2025-32 [H] |
| Bonus, acquired before 2025-01-20 (general) | 60% | 40% | 20% | Placed-in-service year | §168(k)(6) [H] |
| Bonus, acquired before 2025-01-20 (LPPP/aircraft) | 80% | 60% | 40% | Placed-in-service year | [H] |
| Bonus, acquired after 2025-01-19 | n/a | **100%** (elective 40%/60% in the first tax year ending after 2025-01-19) | **100%** | Acquisition date | OBBBA §70301; Notice 2026-11 [H] |
| §168(n) QPP | n/a | 100% (construction begun after 2025-01-19, placed in service after 2025-07-04 [M]) | 100% | Construction start + placed in service | Notice 2026-16 [H] |
| §280F year 1 (with bonus) | $20,400 | **$20,200** | **$20,300** | Placed-in-service calendar year | Rev. Procs. 2024-13, 2025-16, 2026-15 [H] |
| §280F year 1 (no bonus) | $12,400 | **$12,200** | **$12,300** | same | [H] |
| §280F year 2 | $19,800 | $19,600 | $19,800 | same | [H] |
| §280F year 3 | $11,900 | $11,800 | $11,900 | same | [H] |
| §280F years 4+ | $7,160 | $7,060 | $7,160 | same | [H] |
| Lease-inclusion FMV floor | $62,000 | $60,000 | $62,000 | Lease start year | [M; 2025 VERIFY] |
| §448(c) gross-receipts test | $30M | $31M | $32M | Tax year beginning | Rev. Procs. 2023-34, 2024-40, 2025-32 [M; 2026 VERIFY] |
| De minimis safe harbor | $2,500 / $5,000 (AFS) | same | same | Not indexed | Reg. §1.263(a)-1(f); Notice 2015-82 [H] |
| §195/§248/§709 immediate / phase-out start | $5,000 / $50,000 | same | same | Not indexed | [H] |
| Small-taxpayer building safe harbor | $10M gross receipts / $1M basis / lesser of $10k or 2% | same | same | Not indexed | Reg. §1.263(a)-3(h) [H] |
| §179D per sq ft (base–max) | VERIFY | $0.58–$1.16 / $2.90–$5.81 | VERIFY | Placed-in-service year | Rev. Procs. 2023-34, 2024-40, 2025-32 [M; 2024 and 2026 VERIFY] |

*Pre-OBBBA 2025 amounts from Rev. Proc. 2024-40 ($1,250,000 / $3,130,000) must be stored with `superseded_by = 'PL 119-21 §70306'` for audit trail.*

---

## 5. Implications for the product

### 5.1 Effective-dating model

Store every rule row with:
- **`law_valid_from` / `law_valid_to`**;
- **`trigger_date_type`**: one of:
  - `ACQUISITION_DATE`
  - `BINDING_CONTRACT_DATE`
  - `CONSTRUCTION_START_DATE`
  - `PLACED_IN_SERVICE_DATE`
  - `TAX_YEAR_BEGIN`
  - `TAX_YEAR_END`
  - `FIRST_TAX_YEAR_ENDING_AFTER`
  - `DISPOSITION_DATE`
  - `EXCHANGE_DATE`
  - `PLANTING_DATE`
  - `LEASE_START_DATE`
  - `PAID_OR_INCURRED_DATE`
- **`recorded_from` / `recorded_to`**, for knowledge time (bitemporal). This lets a 2025 return be reproduced "as filed," before Notice 2026-11, and "as corrected."
- **`authority_ref`**, **`authority_status`** (STATUTE / FINAL_REG / PROP_REG / NOTICE_INTERIM / REV_PROC), **`confidence`**, and **`superseded_by`**.

Delta tables with Unity Catalog tags carry the citation, and Change Data Feed retains history.

### 5.2 Rule tables to build

| # | Table | Key columns | Main attributes |
|---|---|---|---|
| 1 | `ref_asset_class` | asset_class_code, law_valid_from | description, class_life, gds_period, ads_period, property_character (1245/1250), is_statutory_override, statutory_cite |
| 2 | `ref_statutory_class_override` | property_type_code (QIP, farm_machinery_new, water_utility, qual_leasehold_pre2018…), pis_from/to | gds_period, ads_period, method_default, bonus_eligible, s179_eligible |
| 3 | `ref_macrs_method` | system (GDS/ADS/AMT/EP/CAMT), recovery_period, property_flags, pis_from/to | method (200DB/150DB/SL), convention_default, switch_to_sl |
| 4 | `ref_macrs_rate` | table_id (A-1…A-20, ACRS), recovery_period, convention, period_placed (Q/month), recovery_year | rate (decimal(7,5)), source_table |
| 5 | `ref_convention_rule` | rule_code (MQ_TEST, DISP_HY, DISP_MQ…), valid_from | threshold 0.40, window_months 3, exclusion_list, basis_definition |
| 6 | `ref_short_year_rule` | convention, method_option (allocation/simplified) | formula id |
| 7 | `ref_bonus_rate` | property_category (GENERAL, LPPP, AIRCRAFT, SPECIFIED_PLANT, FILM_TV, SOUND_REC), acq_from/to, pis_from/to (or plant_from/to) | rate, elective_alt_rate, alt_rate_scope (first tax year ending after 2025-01-19) |
| 8 | `ref_bonus_eligibility` | criterion_code | recovery period ≤20, used-property tests, exclusions (ADS, utility, floor plan), cite |
| 9 | `ref_qpp_168n` | rule_code | construction_start window, pis deadline, excluded_use codes, recapture_years = 10 |
| 10 | `ref_s179_limit` | tax_year_begin_year | dollar_limit, phaseout_threshold, suv_cap, superseded_by |
| 11 | `ref_280f_limit` | pis_year, bonus_flag, vehicle_type | yr1, yr2, yr3, yr4_plus |
| 12 | `ref_280f_lease_inclusion` | lease_start_year, fmv_from, fmv_to | amt_yr1…amt_yr5plus |
| 13 | `ref_ads_trigger` | trigger_code (FOREIGN_USE, TAX_EXEMPT_USE, BOND, RPTB_163J, FARM_163J, LISTED_LE50…) | mandatory flag, applies_to property types, cite |
| 14 | `ref_amortization_rule` | code_section (197, 195, 248, 709, 174_DOM, 174_FOR, 174A, 167F_SW, 169, 194), valid_from/to | months, start_convention (month acquired / midpoint / month begins), immediate_cap, phaseout_start |
| 15 | `ref_basis_reduction` | credit_or_deduction (47, 48, 48E, 45L, 179D, 30C, 45W), pis_or_acq_from/to | reduction_pct, recapture_schedule_id, termination_date |
| 16 | `ref_recapture_rule` | property_character (1245, 1250_RES, 1250_NONRES, ACRS_1245_RECOVERY, QIP_1250, QPP), entity_type | formula_id, ordinary_rule, rate_bucket (ordinary / 25% / §1231) |
| 17 | `ref_alt_book_rule` | book (AMT_IND, CAMT, EP, ACE_LEGACY), pis_from/to, regular_method | alt_method, alt_period, bonus_allowed, s179_treatment (none / 5-yr ratable) |
| 18 | `ref_tpr_threshold` | rule_code (DE_MINIMIS_AFS, DE_MINIMIS_NONAFS, MS_200, SMALL_BLDG), tax_year_begin_from | amount, pct |
| 19 | `ref_disposition_type` | type_code (SALE, 1031, 1033, CASUALTY, ABANDON, RETIRE, SCRAP, PARTIAL, GAA, STEP_IN_SHOES, CHANGE_IN_USE) | recognition rules, form mapping (4797 part, 8824, 4684, 6252) |
| 20 | `ref_replacement_period` | provision (1033_GENERAL, 1033_CONDEMN_REALTY, 1033_DISASTER), valid_from | years |
| 21 | `ref_method_change_dcn` | dcn, revproc_id | section, description, reg_cite, eligibility rules, 481a_spread, valid_from/to |
| 22 | `ref_entity_applicability` | rule_code, entity_type | applies, level (entity / owner / both), K-1 line/code |
| 23 | `ref_inflation_param` | param_code, year | amount, rounding_rule, source (a generic store for indexed amounts) |
| 24 | `ref_legacy_acrs` | class, pis_from/to, recovery_year, month | rate (Prop. Reg. §1.168-2 tables) |

**Taxpayer-side fact tables**:

- `asset`, holding:
  - acquisition, contract, construction-start and placed-in-service dates;
  - original-use and used flags, and related-party flag;
  - basis components;
  - business-use percentage by year;
  - QPA-use percentage;
  - R&E-use percentage;
  - parent/child component links.
- `asset_book`, one row per book (FED, AMT, CAMT, EP, each state, GAAP).
- `election`, keyed by (taxpayer, year, election_code, class).
- `disposition`.
- `exchange_link` (§1031/§1033 relinquished-to-replacement).
- `use_history`, recording change-in-use events.
- `s179_carryforward` and `s1231_lookback`, both owner-level.

### 5.3 Calc-engine requirements

1. **Parallel multi-book engine**: one asset, *n* books, each with its own method, convention, bonus, §179 and basis track, and recapture character. Required books: Fed, individual AMT, CAMT tax-depreciation ledger, E&P, ACE (legacy, read-only), state, GAAP.
2. **Deterministic, version-pinned runs**: every result stores rule-row IDs, the knowledge time, and engine version, so prior returns can be reproduced exactly.
3. **Taxpayer-level passes**, beyond per-asset math:
   - the MQ test (entity or consolidated group);
   - the §179 limit, phase-out, income limit and carryforward;
   - §179 asset-selection optimization (MQ avoidance, longest life first);
   - bonus class elections;
   - the §168(k)(10) transition election;
   - §1231 netting and lookback (owner level);
   - the GAA pool.
4. **Both table and formula methods**, including published-table rounding. Automatic switch to formula after a short year. Short-year allocation and simplified methods. A whole-dollar rounding option for forms.
5. **Component-level acquisition logic**: binding-contract and construction-start dates, the 10% cost safe harbor, and the component election for straddle projects. §168(n) basis split by use and 10-year monitoring.
6. **Disposition engine** covering:
   - conventions;
   - partial dispositions with basis-estimation methods;
   - recapture waterfall (§1245 → §1250 additional → §291 → unrecaptured §1250 → §1231);
   - §1239 override;
   - installment recapture in year 1;
   - §1031/§1033 exchanged and excess basis per §1.168(i)-6;
   - §1245(b)(4) recapture on real-for-real exchanges;
   - casualty netting.
7. **Listed-property module**: annual business-use input, the >50% test, ADS fallback and §280F(b)(2) recapture, cap × use %, post-recovery-period deductions, the Rev. Proc. 2019-13 safe harbor, and lease inclusion.
8. **Pass-through flows**: entity-level §179 and owner-level limitation, K-1 codes, partner-level gain on disposition of §179 assets, §743(b) assets as separate bonus-eligible assets, and step-in-the-shoes splits.
9. **Method-change module**: computes the §481(a) adjustment (cumulative allowable vs. allowed) by DCN, and produces Form 3115 schedules. It must distinguish method changes from items requiring an amended return or §9100 relief.
10. **Form outputs**:
    - 4562 (Parts I–VI, including line 18 GAA and Part VI amortization codes);
    - 4797;
    - 8824, 6252, 4684, 4255, 3115;
    - 6251 line 2l;
    - 4626 (CAMT);
    - M-3 depreciation lines;
    - K-1 boxes.

### 5.4 Edge-case test list (minimum regression suite)

1. Calendar 2025: property contracted 2025-01-15 and placed in service 2025-06 → 40%. Contracted 2025-01-21 → 100%.
2. Fiscal year 2024-07-01 to 2025-06-30: the 2024 §179 limit applies ($1.22M); mixed 60%/40%/100% bonus; the transition election is available.
3. A self-constructed plant begun in 2024, finished in 2026, with the component election: pre-cutoff components at 20%, post-cutoff components at 100%.
4. The 10% safe harbor crossing exactly at 2025-01-19 versus 2025-01-20.
5. LPPP placed in service in 2027 at 20%, with only pre-2027 progress expenditures eligible.
6. An MQ test where 100% bonus assets remain in the denominator (VERIFY rule), and where §179 assets are excluded.
7. An MQ test that excludes an asset placed in service and disposed of in the same year.
8. A consolidated group MQ test spanning members with different fiscal years.
9. A short first year of 5 months under HY and MQ (the "quarters" are 1.25 months).
10. Table method used, then a short year occurs → switch to formula.
11. A 39-yr building placed in service December 2026 (0.107%) and disposed of in March 2030 (2.5/12).
12. QIP with bonus, sold → §1250 additional depreciation; same asset under §179 → §1245.
13. A §168(n) building: 70% QPA / 30% office split; the use stops in year 6 → recapture.
14. A §168(n) lessor building → ineligible.
15. An SUV of 6,200 lb GVWR at the 2026 cap of $32,000, with the remainder taking bonus; a pickup with a 6.5-ft bed → no cap.
16. An auto at 45% business use → ADS SL, no bonus/§179; use rises to 60% the next year → still ADS.
17. An auto at 100% use, falling to 40% in year 3 → §280F(b)(2) recapture, Form 4797 Part IV.
18. §179 income limitation carryforward across three years, then a disposition of the asset (carryforward stays with the taxpayer).
19. A partner with $3M of K-1 §179 from two partnerships in 2026 → limited at $2.56M, while the partnership's basis is still reduced.
20. A trust owning equipment → §179 rejected.
21. An S corporation that converted from a C corporation 2 years earlier sells a building → §291 applies.
22. §1231 lookback with losses in years t−5 and t−3, part already recaptured.
23. A related-party sale to a 60%-owned corporation → all ordinary (§1239), no installment method.
24. An installment sale with recapture greater than the down payment.
25. A §1031 exchange of a cost-segregated building → §1245(b)(4) recapture; replacement exchanged basis continues the old schedule and excess basis is new; the election out.
26. A §1033 condemnation with a 3-year replacement and partial reinvestment.
27. Partial disposition of a replaced roof under the election: retirement loss with PPI-discounted basis; and the mandatory partial disposition on a casualty.
28. A GAA disposition → ordinary income up to unadjusted basis; qualifying-disposition election.
29. Change in use: a U.S. asset moved abroad in year 3 → ADS on the remaining period.
30. A §163(j) electing RPTB in 2026 with existing QIP carrying prior bonus (no recompute) and new QIP on ADS at 20 years.
31. A personal-use car converted to business use → basis is the lesser of FMV and adjusted basis; bonus eligibility (VERIFY).
32. A §743(b) step-up on 7-yr property → 100% bonus; a §734(b) adjustment → no bonus.
33. A §351 transfer mid-year → step-in-the-shoes month split.
34. A §197 intangible written off while others from the same deal are retained → loss disallowed and basis reallocated.
35. Start-up costs of $52,000 → $3,000 immediate, $272.22 per month.
36. §174A: 2023 unamortized domestic R&E → 2025 lump sum versus a 2025/2026 two-year election.
37. Individual AMT: 2026 7-yr asset elected out of bonus → 150DB AMT schedule; bonus taken → no adjustment.
38. E&P: 2026 asset with §179 of $500k → E&P deduction of $100k per year for 5 years; bonus asset → ADS.
39. CAMT: a corporation with 100% bonus assets; AFSI removes book depreciation; disposition adjustment.
40. An ACRS 45-yr SL real property placed in service in 1986, still depreciating in 2026; and an ACRS 19-yr accelerated building sold → full §1245 recapture.
41. A DCN 7 catch-up for a cost-segregation look-back study → negative §481(a) in full; a positive adjustment → 4-year spread.
42. Pre-OBBBA 2025 §179 amounts ($1.25M) are present in history but superseded → the engine must pick $2.5M for a TY2025 run as of 2026, and must reproduce $1.25M for an as-of-2025-06 run.

---

## 6. Sources

Primary documents are listed first. irs.gov URLs could not be fetched directly from this sandbox; their contents were confirmed through search-indexed copies and firm summaries.

**Statute and regulations**
- IRC §§168, 179, 280F, 197, 195, 248, 709, 174, 174A, 1245, 1250, 291, 1231, 1239, 453, 1031, 1033, 165, 56, 56A, 312: https://www.law.cornell.edu/uscode/text/26 ; https://uscode.house.gov/
- P.L. 119-21 (OBBBA) §§70301 (bonus), 70302 (§174A), 70303 (§163(j)), 70306 (§179), 70307 (§168(n)): https://www.congress.gov/bill/119th-congress/house-bill/1
- Treas. Regs. §§1.168(d)-1, 1.168(i)-1, -4, -6, -8, 1.168(k)-2, 1.179-1 to -3, 1.263(a)-1/-2/-3, 1.162-3, 1.446-1(e), 1.743-1(j), 1.453-12: https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1

**IRS guidance**
- Notice 2026-11 (bonus interim guidance, 2026-01-14): https://www.irs.gov/pub/irs-drop/n-26-11.pdf
- Notice 2026-16 (§168(n) QPP, 2026-02-20): https://www.irs.gov/pub/irs-drop/n-26-16.pdf
- Rev. Proc. 2025-32 (2026 inflation amounts): https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
- Rev. Proc. 2024-40 (2025 inflation amounts, pre-OBBBA): https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
- Rev. Proc. 2026-15 (2026 auto limits): https://www.irs.gov/pub/irs-drop/rp-26-15.pdf
- Rev. Proc. 2025-16 (2025 auto limits): https://irs.gov/pub/irs-drop/rp-25-16.pdf
- Rev. Proc. 2024-13 (2024 auto limits): https://www.irs.gov/pub/irs-drop/rp-24-13.pdf
- Rev. Proc. 2025-23 (automatic changes), IRB 2025-24: https://www.irs.gov/pub/irs-irbs/irb25-24.pdf ; https://www.irs.gov/irb/2025-24_IRB
- Rev. Proc. 2025-28 (§174A): https://www.irs.gov/pub/irs-drop/rp-25-28.pdf
- Rev. Proc. 2026-32 (§174A / construction method changes): https://www.irs.gov/pub/irs-drop/rp-26-32.pdf
- Rev. Proc. 2019-13 (auto safe harbor): https://www.irs.gov/pub/irs-drop/rp-19-13.pdf
- Notice 2015-82 (de minimis $2,500): https://www.irs.gov/pub/irs-drop/n-15-82.pdf
- Rev. Procs. 87-56 (1987-2 C.B. 674), 87-57 (1987-2 C.B. 687), 89-15 (1989-1 C.B. 816), 2015-13, 2015-56, 2019-8: reproduced in Pub 946 and the IRS Bulletin archive
- Pub 946 (2025): https://www.irs.gov/publications/p946 ; Pub 544: https://www.irs.gov/publications/p544
- Form 4562 instructions: https://www.irs.gov/instructions/i4562 ; Form 4797: https://www.irs.gov/instructions/i4797 ; Form 3115: https://www.irs.gov/instructions/i3115
- Cost Segregation ATG: https://www.irs.gov/businesses/cost-segregation-audit-techniques-guide-table-of-contents
- CAMT: Notices 2023-7, 2023-64, 2024-10; Prop. Regs. REG-112129-23 (Sept. 2024; Prop. Reg. §1.56A-15) — https://www.irs.gov/pub/irs-drop/n-23-64.pdf

**Secondary (used to confirm contents)**
- EY on Notice 2026-11: https://taxnews.ey.com/news/2026-0250-irs-issues-interim-guidance-on-bonus-depreciation
- BDO on Notice 2026-11: https://www.bdo.com/insights/tax/irs-issues-interim-guidance-on-bonus-depreciation-rules
- EisnerAmper on Notice 2026-11: https://www.eisneramper.com/insights/real-estate/notice-2026-11-confirms-tcja-bonus-depreciation-framework-0126/
- Cohen & Co. on the binding-contract rule: https://www.cohenco.com/knowledge-center/insights/february-2026/the-written-binding-contract-rules-impact-on-bonus-depreciation-in-real-estate
- KPMG on Notice 2026-16: https://kpmg.com/us/en/taxnewsflash/news/2026/02/notice-2026-16-guidance-special-depreciation-allowance-qualified-production-property.html
- EY on §168(n): https://taxnews.ey.com/news/2026-0577-interim-guidance-clarifies-100-percent-special-depreciation-allowance-for-qualified-production-property-under-new-irc-section-168n
- PwC on QPP: https://www.pwc.com/us/en/services/tax/library/pwc-notice-provides-framework-for-new-qpp-depreciation-election.html
- Journal of Accountancy on the 2026 auto limits: https://www.journalofaccountancy.com/news/2026/mar/irs-issues-higher-2026-depreciation-limits-for-passenger-automobiles/
- Current Federal Tax Developments on Rev. Proc. 2026-15: https://www.currentfederaltaxdevelopments.com/blog/2026/3/3/analysis-of-revenue-procedure-2026-15-passenger-automobile-depreciation-limitations-and-lease-inclusion-amounts-for-2026
- Grant Thornton on Rev. Proc. 2025-23: https://www.grantthornton.com/insights/newsletters/tax/2025/hot-topics/jun-17/irs-updates-the-list-of-automatic-method-changes
- mycostsegregation.com on Rev. Proc. 2025-23: https://mycostsegregation.com/resources/authorities/rev-proc-2025-23/
- EY on Rev. Proc. 2026-32: https://taxnews.ey.com/news/2026-1977-irs-expands-ability-to-make-automatic-accounting-method-changes-for-research-or-experimental-expenditures-and-certain-long-term-contracts
- KPMG on Rev. Proc. 2026-32: https://kpmg.com/us/en/taxnewsflash/news/2026/09/rev-proc-2026-32-accounting-method-changes-research-construction.html
- CFGI on the §174A deadline: https://www.cfgi.com/2026/05/08/section-174a-retroactive-relief-july-6-deadline/
- nationaltaxtools.com and accountably.com, citing Rev. Proc. 2025-32 §179 amounts: https://nationaltaxtools.com/guides/section-179-deduction/
- Sage FAS help on §179 thresholds: https://help-sfa.na.sage.com/en-us/20261/Depreciation/Network/Content/sec179/section_179_threshold_amounts.htm
- California FTB on §168(n) non-conformity: https://www.ftb.ca.gov/tax-pros/law/legislation/2025-2026/AB2377-031926-032626.pdf

---

## 7. Open questions / VERIFY list

1. **Notice 2026-11 mechanics.** Is the §168(k)(10) 40%/60% election all-property or class-by-class? What is the procedure for fiscal-2024/25 and calendar-2025 returns already filed: an amended return, Form 3115, or automatic 6-month relief? Are there late-election and revocation procedures for the elect-out?
2. **Notice 2026-16 details**: the begin-construction test (physical work / 5% / 10%?); how the election is made (Form 4562 line?); the acquired-property exception dates; whether the deduction is allowed for individual AMT, CAMT and E&P; whether QPP is §1245 property on any disposition or only within 10 years; how a mixed-use building is allocated.
3. **MQ 40% test**: confirm whether bonus reduces "depreciable basis" (Reg. §1.168(d)-1(b)(4)).
4. **Rev. Proc. 2025-23 DCNs** beyond 7/107/200/205/206/207: permissible-to-permissible (§6.02), leasehold improvements (199?), the late partial-disposition election after exam, tangible property regulations (184/186/192), late QIP/bonus (244/245?), and any OBBBA-specific new DCNs for bonus or QPP.
5. **CAMT**: current status of Prop. Reg. §1.56A-15 and later notices (2025-27/-46/-49); whether §179 and §168(n) are "covered tax depreciation"; any OBBBA amendments to §56A.
6. **2025 lease-inclusion floor** ($60,000?), the 2026 §448(c) amount ($32M?), and the 2026 §179D rates.
7. **OBBBA energy terminations** affecting basis reductions: the §45L, §179D, §30C and §45W cutoff dates.
8. **Sound recordings**: the effective date of the bonus eligibility added by OBBBA.
9. **Short-year §280F proration** mechanics.
10. **Legacy §1250 applicable percentages** for pre-1976 real property, and the ACRS 15/18/19-year tables: decide whether to support them natively or as user-supplied schedules.
11. **Form 4562 (2025/2026) line changes** for §168(n) QPP and the transition election, which affect form mapping.
12. **Rev. Proc. 2026 auto/inflation releases**: confirm no mid-2026 corrections to Rev. Procs. 2025-32 or 2026-15.
