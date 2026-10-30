# 07 — Local Tax Compliance Driven by Fixed Assets: Business Personal Property (BPP) Tax and Local Income Taxes

*Research date: 2026-10-30. Scope: BPP returns, renditions and listings filed with county and municipal assessors; local income and net-profits taxes that use depreciation; production and filing channels; what this means for a cloud fixed-asset product whose asset register lives in Databricks.*

**Confidence legend.** **[H]** = confirmed in this session against an official source or several consistent sources (cited). **[M]** = from prior knowledge and widely documented, but not re-checked this session. **VERIFY** = unconfirmed, conflicting or likely to change. Re-check it against the primary source before building content.

**Research limitations (read first).** WebFetch could not reach the external hosts tried (comptroller.texas.gov, ryan.com, grantthornton.com): DNS failed because they are outside this session's network allowlist. The shared WebSearch budget (200 calls per turn for the whole swarm) ran out after about 25 queries. So the 2025–2026 law changes and the deep-dive states listed below are verified [H]. Many cells in the 50-state table are [M] or VERIFY. They should be closed in a follow-up pass with those domains allowed.

---

## Executive summary

1. **BPP is a big, fragmented, shrinking-at-the-low-end compliance market.** About 36–38 states plus DC tax at least some business tangible personal property [M]. In nearly all of them the return goes to a *local* assessor: county appraisal districts in TX, county assessors in CA/GA/AZ, property appraisers in FL, township/city assessors in MI and IN, PVAs in KY, parish assessors in LA, commissioners of the revenue in VA. Maryland (SDAT) and South Carolina (SCDOR for manufacturers) are the main state-level filing exceptions [M].
2. **2025–2026 was a major year for exemptions. Many small filers are dropping out, and multi-location complexity is rising.** All [H] unless marked; details in A.3.
   - **New exemptions from TY2026:** TX $125,000 of appraised value per location (HB 9 / Prop 9; the old $2,500 cliff is gone). IN $2M acquisition cost per county (SEA 1 / HEA 1427; also removes the 30% floor for post-2024 property outside TIF). AZ $500k FCV (enacting bill VERIFY). WY $75k FMV per county (SF0048).
   - **Earlier:** GA $7,500 → $20,000 (HB 808 / Referendum A, Nov 2024; effective date VERIFY). WI full repeal from 2024 (2023 Act 12).
   - **Failed or pending:** Louisiana voters rejected the parish inventory-tax option on 16 May 2026. Michigan HB 5878, a full PP exemption, reportedly passed the House (VERIFY).
3. **Values almost everywhere come from historical cost by year acquired × jurisdiction factor tables.** These are trend/index factors combined with percent-good or depreciation factors, or a composite "multiplier", subject to floors, exemptions and an assessment ratio. Some jurisdictions publish the tables in machine-readable form: **California's BOE has moved its AH 581 factor tables to the BOE Open Data Portal since 2023** [H]. Most others publish PDFs: NC Cost Index manual, MI State Tax Commission bulletins, TX appraisal-district schedules, the LA Tax Commission. Some put the schedule in statute or regulation: TN, MO, KS, IN [M]. Keeping a curated, versioned factor library is a core moat and a core cost.
4. **The fixed-asset register is necessary but not sufficient.** BPP needs data income-tax depreciation does not:
   - lien-date situs (location on 1 Jan or the local lien date);
   - assets expensed for tax but still reportable (de minimis safe harbor, §179/bonus, fully depreciated assets);
   - supplies, CIP and inventory;
   - leased-in and leased-out property, using the tax concept of true lease vs. conditional sale rather than ASC 842 classification;
   - disposals as of the lien date.
5. **Filing channels vary widely.**
   - **California:** a true statewide e-file standard, the SDR (Standard Data Record) XML via calbpsfile.org, plus web e-SDR [H].
   - **Texas:** substitute or computer-generated renditions are allowed if they "substantially comply" with the Comptroller's form (Tax Code §22.24). Electronic filing requires an agreement with the chief appraiser under §1.085, and each appraisal district runs its own portal (e.g., HCAD iFile) [H].
   - **Elsewhere:** mostly paper or PDF, or one-off county portals.
6. **Local income taxes that use depreciation are a narrower but real need:**
   - NYC (BCT/GCT/UBT) is decoupled from federal bonus depreciation, with the NYC-399/399Z adjustment schedules [M].
   - Ohio municipal net-profit tax starts from federal taxable income [M].
   - Philadelphia BIRT, Kentucky occupational license taxes, Portland/Multnomah, Michigan city income taxes (Detroit) and the St. Louis/Kansas City earnings taxes all start from federal figures; how far each conforms is VERIFY.
   - The product needs extra depreciation books (e.g., "NYC = NYS non-bonus"), not a separate engine.

---

## Part A — Business personal property tax

### A.1 How BPP returns work (common model)

- **Assessment (lien) date.** Usually 1 January. Exceptions: AL 1 Oct; CT 1 Oct; MI 31 Dec "tax day"; RI 31 Dec; DC and WV 1 Jul. Taxable situs is where the property physically sits on that date (e.g., KY: "the county where the property is physically located on January 1" [H]).
- **Return.** A list of assets by category and year of acquisition at *historical installed cost*: purchase price plus freight, sales tax and installation (NC: "historical installed cost" [H]). Also schedules for supplies, CIP, leased property and, in inventory states, inventory.
- **Assessor value.** Cost × index/trend factor gives reproduction cost new (RCN). RCN × percent good gives market value. Then floors and minimums apply. CA BOE describes index factors as converting original cost to RCN, and percent-good factors as "the complement of depreciation factors" [H].
- **Assessed value.** Market value × assessment ratio, e.g., GA 40% [M], LA 15% [M], TN 30% (commercial/industrial) [M], MI 50% SEV [M], TX/CA/FL 100% [M]. Then exemptions. Then the combined millage of every taxing unit at the situs: tax rate area or tax-code combination.
- **Lifecycle.** Notice of value, then an appeal window, then the bill. Late filing triggers penalties, e.g., TX 10% (§22.28) [H]; CA 10% if not filed by 7 May [H]; FL 5%/month up to 25%, plus 15% for omitted property [H]. Audits and "escape" assessments follow.

### A.2 50-state + DC summary table

Abbreviations: "Cost×factors" = trended historical cost × depreciation/percent good. Exemption amounts apply to business TPP unless noted. The **Conf.** column gives confidence for the row; individual cells carrying VERIFY override it.

| State | Taxes general BPP? | Statewide exemption / threshold | Return form / filed with | Due date (lien date) | Valuation approach; assessment ratio | Conf. |
|---|---|---|---|---|---|---|
| AL | Yes | Small-business exemption enacted ~2021; amount VERIFY | Business Personal Property Return (form no. VERIFY) / county revenue commissioner or assessor | Dec 31 (Oct 1) | ADOR appraisal manual cost×factors; commercial Class II 20% | M / VERIFY |
| AK | Local option only (e.g., Anchorage, some boroughs) | Local | Local return | Local (VERIFY) | Local | VERIFY |
| AZ | Yes | **$500,000 FCV from TY2026** (A.R.S. 42-11127); prior indexed cap $207,366 or $269,905 (sources conflict) | Business Personal Property Statement / county assessor | Apr 1 (Jan 1) | ADOR valuation tables; Class 1 ratio ~16→15% (VERIFY) | H (exemption) / M |
| AR | Yes (incl. inventory) | VERIFY | Assessment list / county assessor | May 31 (Jan 1) | Cost×factors; 20% | M |
| CA | Yes | No value exemption; must file if aggregate cost ≥ $100,000 or on request; county low-value option (RTC 155.20, up to $10k; VERIFY) | **BOE-571-L** / county assessor; SDR/e-SDR | Apr 1; penalty if not filed by **May 7** (Jan 1) | Cost × **AH 581** index × percent good; 100% FMV, ~1% + voter debt | H |
| CO | Yes | Per-county exemption, indexed biennially (2025–26 amount VERIFY, ~$56k) | **DS 056** Personal Property Declaration Schedule / county assessor | Apr 15 (Jan 1) | DPT Assessors' Reference Library Vol. 5 cost factors & depreciation; nonresidential ratio ~25–27% (VERIFY) | M / VERIFY |
| CT | Yes (municipal) | Manufacturing M&E exempt; local small-value options (VERIFY) | Declaration of Personal Property / town assessor | Nov 1 (Oct 1) | Local schedules; 70% | M |
| DE | No | — | — | — | — | M |
| DC | Yes | First $225,000 taxable value excluded | **FP-31** / OTR | Jul 31 (Jul 1) | Cost less depreciation; 100% | M |
| FL | Yes | **$25,000** assessed value per return | **DR-405** / county property appraiser | **Apr 1**; 30-day extension (§193.063) (Jan 1) | Just value; appraiser schedules (DOR TPP guidelines); 100% | H |
| GA | Yes (inventory subject to local freeport) | **$20,000** FMV per county (HB 808 / Ref. A 2024; eff. date VERIFY) | **PT-50P** (+PT-50PF freeport) / county board of assessors | **Apr 1** (Jan 1) | DOR Appraisal Procedures Manual cost×factors; 40% | H / M |
| HI | No | — | — | — | — | M |
| ID | Yes | $250,000 per county (VERIFY) | Personal property declaration / county assessor | Mar 15 (Jan 1) | State Tax Commission schedules; 100% | M / VERIFY |
| IL | No (abolished 1979; PPRT replacement) | — | — | — | — | M |
| IN | Yes | **$80,000 (2025) → $2,000,000 acquisition cost per county (from Jan 1 2026)** | **Form 103-Short / 103-Long + Form 104** / township or county assessor | **May 15** (+30 days on request) (Jan 1) | 50 IAC 4.2 pools; 30% floor (removed for post-2024 property outside TIF) | H |
| IA | No (general business) | — | — | — | — | M |
| KS | Partly: M&E acquired after 6/30/2006 exempt | — | Personal property statement / county appraiser | Mar 15 (Jan 1) | Statutory schedule (K.S.A. 79-1439, VERIFY); ratio VERIFY | M |
| KY | Yes (state + local rates) | No filing if ≤ $1,000 FCV per location | **62A500** (+ schedules, e.g., 62A500-A) / county PVA | **May 15**, no extensions (Jan 1) | DOR depreciation tables in 62A500 instructions; 100% FCV | H |
| LA | Yes (incl. inventory) | None; parish inventory option **rejected 5/16/2026** | **LAT 5** / parish assessor | Apr 1 (Jan 1) | LTC composite multiplier tables (LAC 61:V); 15% | M (H on amendment) |
| ME | Yes, but BETE exempts most equipment placed in service after 4/1/2007 | BETE (Form 801) | Local declaration + BETE application / town assessor | BETE by May 1 (Apr 1) | Local | M |
| MD | Yes (counties set rates; many exempt manufacturing) | Small-business exemption (orig. cost < ~$20k; VERIFY) | **Form 1** Annual Report & BPP Return / SDAT (state) | Apr 15 (Jan 1) | SDAT depreciation categories with floor; 100% | M / VERIFY |
| MA | Yes (local); corporations largely exempt except certain property | Local option ≤ $10,000 | Form of List (State Tax Form 2) / local assessors | Mar 1 (Jan 1) | Local | M |
| MI | Yes, with large carve-outs | Small business taxpayer exemption **< $180,000 TCV** per local unit (Form 5076); EMPP (Form 5278); full exemption bill HB 5878 (VERIFY) | **Form 632 (L-4175)** / local assessor | **Feb 20** (Dec 31) | STC multiplier tables; 50% SEV / taxable value | H |
| MN | No (general business) | — | — | — | — | M |
| MS | Yes | VERIFY | Personal property rendition / county tax assessor | Apr 1 (Jan 1) (VERIFY) | DOR schedules; 15% | M / VERIFY |
| MO | Yes | VERIFY | Declaration of personal property / county assessor | Mar 1 (Jan 1) | RSMo 137.122 standardized schedule keyed to **federal MACRS recovery periods**; 33⅓% | M |
| MT | Yes (Class 8) | ~$300,000 per taxpayer (VERIFY 2025 changes) | Personal property reporting form / MT DOR | Mar 15 (Jan 1) | DOR trend/depreciation; low class rates (VERIFY) | M / VERIFY |
| NE | Yes | $10,000 per county (VERIFY) | **Form 775P** / county assessor | May 1 (Jan 1) | Net book value on MACRS-type recovery periods without bonus (VERIFY); 100% | M |
| NV | Yes | VERIFY | Personal property declaration / county assessor | VERIFY | Dept. of Taxation cost & depreciation tables; 35% | VERIFY |
| NH | No | — | — | — | — | M |
| NJ | No (only certain telecom/utility) | — | — | — | — | M |
| NM | Yes (depreciable business property) | VERIFY | Business PP report / county assessor | VERIFY (end of Feb) | Statutory method (VERIFY); 33⅓% | VERIFY |
| NY | No | — | — | — | — | M |
| NC | Yes | None statewide | Business Personal Property Listing (NCDOR form) / county assessor | **Jan 31** (moved to **Feb 2, 2026** for weekend) (Jan 1) | **NCDOR Cost Index & Depreciation Schedules**; 100% | H |
| ND | No | — | — | — | — | M |
| OH | No (phased out 2005–2009; utilities excepted) | — | — | — | — | M |
| OK | Yes | 5-yr manufacturing exemption | **OTC 901** BPP Rendition / county assessor | Mar 15 (Jan 1) | County schedules; 10–15% | M |
| OR | Yes | Small-account cancellation, indexed (VERIFY) | Confidential Personal Property Return (150-553-004) / county assessor | Mar 15 (Jan 1) | DOR depreciation/trend tables; 100% (Measure 50 limits) | M / VERIFY |
| PA | No | — | — | — | — | M |
| RI | Yes (municipal) | First $50,000 exempt (2023 law; VERIFY) | Declaration / local assessor | Jan 31 (Dec 31) | Local | M / VERIFY |
| SC | Yes | VERIFY | SCDOR PT-100 (manufacturers/DOR-assessed); other business PP to county or SCDOR (PT-300; VERIFY) | Last day of 4th month after FYE (Apr 30 calendar-year) | SCDOR % depreciation with floor; 10.5% (manufacturing ratio reductions, VERIFY) | VERIFY |
| SD | No | — | — | — | — | M |
| TN | Yes | VERIFY | Tangible Personal Property Schedule ("Schedule B") / county assessor | Mar 1 (Jan 1) | **Statutory** schedule TCA 67-5-903 (groups 1–6, residual floors); 30% | M |
| TX | Yes (incl. inventory) | **$125,000** of appraised value per location / taxing unit from TY2026 (HB 9, Prop 9; Tax Code §11.145) | **Form 50-144** (or CAD form such as HCAD 22.15) / county appraisal district | **Apr 15**; extension to May 15 on request; +15 days good cause (Jan 1) | CAD cost schedules (often Marshall & Swift-based); 100% | H |
| UT | Yes | Indexed small exemption (VERIFY) | Signed statement / county assessor | May 15 or 30 days after request (VERIFY) | Tax Commission schedules (Rule R884-24P-33); 100% | M / VERIFY |
| VT | Local option | Local | Local | Local | Local | VERIFY |
| VA | Yes (localities; machinery & tools separate class) | Local | Business tangible PP return; M&T return / Commissioner of the Revenue | Locality-set (Fairfax Co.: **May 1**) (Jan 1) | % of original cost by age (Fairfax Co.: 80% yr 1, −10%/yr, 20% floor) | H (Fairfax) / M |
| WA | Yes | None for businesses (VERIFY) | Personal property listing / county assessor | Apr 30 (Jan 1) | DOR guidance; 100% | M |
| WV | Yes | Refundable rebate credits (2023) rather than exemption (VERIFY) | Business PP return / county assessor | VERIFY (lien Jul 1) | Tax Commissioner schedules; 60% | VERIFY |
| WI | **No — repealed from Jan 1 2024** (2023 Act 12) | — | (Manufacturing real property forms only) | — | — | H |
| WY | Yes | **$75,000 FMV per county from Jan 1 2026** (SF0048) | Personal property declaration / county assessor | Mar 1 (VERIFY) (Jan 1) | DOR Ch. 9 rules; 11.5% (VERIFY) | H (exemption) / M |

**Reading the table.** In roughly 13 states and DC, BPP is effectively absent for ordinary businesses: DE, HI, IL, IA, MN, NH, NJ, NY, ND, OH, PA, SD and, since 2024, WI [M/H]. Partial or local-option regimes are AK, KS, ME, MA, VT and CT (manufacturing exempt) [M]. All remaining states tax BPP generally.

### A.3 Deep dives

#### Texas [H unless noted]
- **Forms.**
  - *Form 50-144*, the Comptroller's Business Personal Property Rendition of Taxable Property, goes to the county **appraisal district**, not the Comptroller.
  - Large CADs use their own substantially compliant versions, e.g., HCAD **22.15**, 22.15VEH for vehicles and 22.15CBL for multiple accounts.
  - Separate dealer inventory declarations exist [M]. HB 3424 changes reporting frequency and record-keeping for heavy-equipment dealers from 1 Jan 2026.
  - Freeport application: Form 50-113 [M].
- **Deadlines.** 15 April. A written request extends to 15 May. The chief appraiser may grant 15 more days for good cause. Penalty is 10% of taxes for late or no rendition (§22.28) and 50% for fraud (§22.29) [M]. SB 1352 (2025) reworked freeport filing deadlines and late penalties: the penalty is the lesser of 10% of the tax difference with and without the exemption, or 10% of the tax on the freeport property. Bill passage was confirmed only via BCAD guidance (VERIFY).
- **HB 9 (2025), ratified as Prop 9 on 4 Nov 2025.**
  - Tax Code §11.145 now exempts **$125,000 of the appraised value** of income-producing TPP, effective TY2026. Before, any property worth less than $2,500 was exempt (a cliff). The new rule is a deduction from value. An introduced version proposed $250,000.
  - It applies per location. The chief appraiser may investigate related businesses that aggregate property. Bracewell reports limits on lessors claiming multiple exemptions for property leased to others.
  - Rendition is generally required only where value at a location exceeds the exemption. Districts are issuing "under-$125k" certification inserts (e.g., Dallas CAD's HB 9 insert), so filers below the threshold may still be asked to file a statement. The exact rule and form number are VERIFY.
- **Contents of 50-144** [M]:
  - Taxpayers under $20,000 aggregate value may render only general information.
  - Others list inventory, supplies, furniture & fixtures, machinery & equipment, computers and vehicles. For each they give either historical cost when new plus year acquired, or a good-faith estimate of market value (§22.01). Owners may, but need not, state that estimate (§22.24).
  - Property owned by others (leased or consigned) is listed with the owner's name and address.
  - An affirmation checkbox lets a filer confirm a prior-year rendition is unchanged.
- **Valuation.** Each of the ~250 CADs adopts its own BPP cost schedules: percent good by category and life, with residual floors, often Marshall & Swift-derived. The Comptroller hosts example schedules developed by districts. 100% market value.
- **Exemptions and abatements.**
  - Freeport (§11.251): goods leaving Texas within 175 days; taxing units opt in.
  - Goods-in-transit (§11.253): local option [M].
  - Pollution control (§11.31) [M].
  - Chapter 312 abatements and Chapter 403 (JETI) agreements [M].
- **Appeals.** Protest to the Appraisal Review Board (Form 50-132), generally by 15 May or 30 days after the notice of value [M].

#### California [H unless noted]
- **Form and threshold.** *BOE-571-L, Business Property Statement*, plus BOE-571-D for distribution centres [M]. Filing is mandatory if aggregate cost of taxable business PP is ≥ $100,000, or when the assessor requests it.
- **Deadline.** Due 1 April. Delinquent with a 10% penalty if not filed by **7 May** (a Thursday in 2026). Some counties publish later e-file cut-offs (Kings: 14 May 2026, 11:59 pm), so per-county calendars are needed.
- **Structure** [M]:
  - Schedule A: equipment cost by year of acquisition for each class (machinery & equipment, office furniture, computers, tools, etc.).
  - Schedule B: buildings, building and leasehold improvements, land improvements.
  - Part II: supplies, property belonging to others (leased), CIP, and fully depreciated or expensed assets still in use.
  - Removals and disposals are reflected by reporting current cost by year.
- **Valuation.** Cost × **AH 581 equipment index factor** (gives RCN) × **percent good** (by estimated useful life), usually combined as a valuation factor, with minimum percent good.
  - The **2026 revision (LTA 2025/046, 30 Dec 2025)** also covers non-production computers, semiconductor equipment, biopharmaceutical equipment, document processors and offset presses; several of these come from RTC §401.20 studies.
  - **Since 2023 the factor tables are published on the BOE Open Data Portal.** AH 581 text is no longer updated annually, but the tables are, which makes California the best machine-readable source.
- **E-file.** SDR and e-SDR (Part C).
- **Audit and appeals** [M]. Mandatory audits for larger accounts (RTC §469). Escape assessments. Assessment Appeals Board applications generally run 2 July to 15 September, or to 30 November in counties that mail value notices later.

#### Florida [H unless noted]
- **Form.** *DR-405*, the Tangible Personal Property Tax Return (Rule 12D-16.002 index of forms). It doubles as the application for the **$25,000 exemption** (§196.183), which requires a timely return or approved extension.
- **Deadline.** 1 April. Property appraisers must grant a 30-day extension (§193.063), which moves the due date to 1 May. A further 15 days is discretionary.
- **Extension request cut-offs vary.** Sarasota requires requests by 31 March. Collier takes them by email after 1 March. Manatee has an online extension application.
- **Penalties.** 5% per month up to 25% for late returns. 15% for omitted property. 25% for no return.
- **Rules** [M]:
  - One return per site where business is transacted.
  - "Freestanding" property at other sites, e.g., vending machines, goes on a single return.
  - After the first return, owners under $25,000 need not refile unless notified.
- **Valuation.** Property appraisers use DOR TPP guidelines and their own life tables [M].
- **2026 ballot.** Amendment 3 on Florida's November 2026 ballot is a homestead measure, not BPP [H via secondary source].

#### Georgia
- **Form.** *PT-50P*, filed with the county Board of Tax Assessors between 1 January and 1 April, with a 10% penalty for not returning [H].
- **Freeport.** Inventory freeport (PT-50PF) is a local option at levels from 20% to 100% [M]. The application is filed with the return [H via secondary source].
- **Exemption.** Raised from $7,500 to $20,000 FMV per county (HB 808, signed 6 May 2024; Referendum A approved Nov 2024) [H]. No special form is needed for the exemption, but annual filing is still required [H via Grant Thornton]. Effective date VERIFY.
- **Valuation and ratio.** Assessed at 40% of FMV [M], using the DOR Appraisal Procedures Manual: trended original cost with economic-life depreciation [M].
- **Appeals.** 45 days from the assessment notice [M].

#### Michigan [H unless noted]
- **Form and deadline.** *Form 632 (L-4175)*, the Personal Property Statement. Assessors send it by 10 January (STC 2026 calendar), and it is due **20 February**. The STC approved 2027 forms on 20 October 2026.
- **Small business taxpayer exemption (MCL 211.9o)** requires combined commercial or industrial TCV **< $180,000** in the local unit:
  - under $80,000: no longer need to file Form 5076 annually;
  - $80,000–$180,000: file **Form 5076** (and, per some assessors, Form 632) by 20 February. Local guidance conflicts on the Form 632 part (VERIFY with the STC);
  - Form 5618 rescinds the exemption.
- **Eligible manufacturing personal property (EMPP).** Form 5278 is due 20 February, with an Essential Services Assessment paid to the state [M].
- **Valuation** [M]. Cost by year acquired, grouped on Form 632 by type, × **STC multiplier tables** (combined trend and depreciation). Assessed at 50% (SEV). Taxable value is capped.
- **Appeals.** March Board of Review, then the Michigan Tax Tribunal [M].
- **Watch.** HB 5878, a full personal property exemption for levies after 31 Dec 2026, reportedly passed the House. VERIFY Senate status before 2027 product planning.

#### Indiana [H unless noted]
- **Forms and deadline.**
  - *Form 103-Short*, or *Form 103-Long* for manufacturers and processors and some other filers.
  - Plus *Form 104*, the summary that includes the checkbox declaring the **$2,000,000 exemption**.
  - Form 102 for farmers.
  - All due **15 May** to the township or county assessor. The assessor may grant up to 30 days' extension in writing.
- **Supplemental schedules** (special tooling, leased or owned-by-others, new property for abatement, pooling) exist under 103-x designations [M]. Exact codes are VERIFY.
- **Exemption.** SEA 1 (2025) raised it to $1M for 2025, but HEA 1427 repealed that. Result: $80,000 for 2025; $2M of **acquisition cost per county** from 1 Jan 2026.
  - Once claimed, a continuing qualifier does not need to refile.
  - Anyone who claimed more than $80k for 2025 under the short-lived SEA 1 rule had to amend by 31 May 2025.
- **Valuation.** 50 IAC 4.2 pools by life (pools 1–4) with percent-good tables and a **30% floor** on total adjusted cost. SEA 1 removes the floor for property placed in service after 1 Jan 2025, except in TIF areas. The DLGF memo also describes floors for CIP and retired property.
- **Abatements and appeals** [M]. SB-1/PP statement of benefits and CF-1/PP compliance forms. Appeals go to the county PTABOA (Form 130), then the Indiana Board of Tax Review.

#### Virginia
- **Structure.** Local administration by the Commissioner of the Revenue in each of ~133 counties and cities, plus town levies [M].
- **Classes.** Business tangible PP (furniture, fixtures, computers) is separate from **Machinery & Tools** (manufacturing), and the two carry different rates [M].
- **Fairfax County example** [H]:
  - Returns due 1 May, rolling to the next business day.
  - Value is 80% of original cost in year 1, declining 10% a year to a 20% floor.
  - The return covers property in the towns of Herndon, Vienna and Clifton.
  - The City of Fairfax, a separate jurisdiction, uses different percentages (70% for 2023 acquisitions, 60% for 2022).
  - This is a clear example of per-locality factor tables inside a single state.

#### North Carolina [H]
- **Listing.** Owners list during January at historical installed cost. 31 Jan 2026 fell on a Saturday, so filings were accepted through **2 Feb 2026** (G.S. 105-395.1). Extension requests can be made online in some counties, e.g., Guilford [M on the extension-to date].
- **Factors.** Counties apply the **NCDOR Cost Index and Depreciation Schedules** (2026 edition dated 21 Nov 2025) as a guide to RCN and depreciation.
- **Penalties.** 10% per listing period late, up to 50% [M].

#### Kentucky [H]
- **Form and deadline.** *62A500*, the Tangible Personal Property Tax Return, with schedules such as 62A500-A. File with the **PVA of the county of taxable situs by 15 May 2026**. No extensions. Late returns are assessed by DOR with penalties and interest and lose the discount.
- **Location rules.** A separate return for each location. No consolidated or joint returns. No filing for ≤ $1,000 FCV per location, but records must still be kept.
- **Who files.** Owners, lessees and holders of beneficial interests on 1 January.
- **Valuation.** DOR depreciation guidance in the instructions [M].

#### Louisiana
- **Form and ratio.** *LAT 5*, the Business Personal Property Tax Report, filed with the parish assessor by 1 April [M]. Assessed at 15% of FMV using **Louisiana Tax Commission** composite-multiplier tables (LAC 61:V) [M].
- **Inventory.** Inventory is taxable. Act 221 (2025) would have let parishes exempt business inventory, with Act 357 as the implementing statute. It was **rejected on 16 May 2026** (Amendment 4: 34% yes, 66% no) [H].
- **Credit.** KPMG reports the inventory-tax credit for C-corporations was repealed effective 1 July 2026, and sources differ on timing (VERIFY). The interplay of the state income-tax credit and the inventory schedule matters to customers.
- **Abatements.** The ITEP industrial abatement [M].

#### Tennessee [M]
- **Form and deadline.** Tangible Personal Property Schedule ("Schedule B") to the county assessor by 1 March. Commercial and industrial property assessed at 30%.
- **Factors.** Depreciation is **statutory** (TCA 67-5-903): groups 1–6 by life, each with a residual floor.
- **Default.** If no schedule is filed, the assessor may "forced assess" a value.
- Exact floor percentages: VERIFY.

#### South Carolina (VERIFY)
- **Filing split.** Manufacturers, utilities and some other businesses file with **SCDOR** (PT-100 for manufacturers), due the last day of the 4th month after fiscal year-end. Other businesses file with county auditors or assessors, or SCDOR (PT-300) depending on business type.
- **Valuation.** SCDOR prescribes percentage depreciation by class, with floors.
- **Ratios.** 10.5% assessment, with statutory reductions for manufacturing phased in after 2018.
- All of this needs primary-source verification.

#### Arizona
- **Exemption.** From TY2026 it is **$500,000 FCV** (A.R.S. 42-11127) [H]. The vehicle bill is VERIFY: SB 1069 or the SB 1749 budget. Mohave County says statements are still required by 1 April from businesses above the threshold [H].
- **Valuation.** County assessors apply ADOR valuation tables [M]. The Class 1 assessment ratio has been stepping down toward 15% (VERIFY).

#### Colorado [M / VERIFY]
- **Form and deadline.** *DS 056*, the Personal Property Declaration Schedule, due 15 April.
- **Exemption.** Per-county de minimis exemption, indexed every two years (VERIFY the 2025–26 amount).
- **Factors.** Valuation uses the Division of Property Taxation's ARL Vol. 5 cost-factor and depreciation tables.
- **Ratio.** Nonresidential assessment rates have changed several times in 2023–2025 legislation (VERIFY the current rate).
- **Default.** Failing to file leads to a "best information available" (BIA) assessment.

#### Washington [M / VERIFY]
- **Listing.** Personal property listing to the county assessor by 30 April. 100% value.
- **Factors.** The DOR issues valuation guidance and trend/depreciation information.
- **Exemption.** The $15,000 "head of family" exemption mainly helps individuals and sole proprietors (VERIFY).

#### States that recently eliminated or sharply reduced BPP
- **Wisconsin** [H]. Full repeal from the 1 Jan 2024 assessment (2023 Act 12, signed 20 June 2023), covering locally assessed and state-assessed manufacturing and rail PP. Some items move to real property (e.g., buildings on leased land). Local governments get $173.8M in hold-harmless aid. Liabilities for 2023 and earlier, and omitted-property assessments, survive.
- **Large 2025–2026 increases:** IN, TX, AZ, WY and GA, covered above [H]. Older repeals: OH (2005–2009), IL (1979); PA, NY and NJ exempt general BPP [M].
- **Pending:** Michigan HB 5878 (VERIFY). MultiState flags more property-tax ballot measures for 3 Nov 2026; re-check the results after the election, four days from the research date.

### A.4 Cross-cutting rules the product must model

- **Lessor and lessee reporting.**
  - The *owner* (lessor) normally reports leased-out equipment at the lessee's situs.
  - The *lessee* lists leased-in property with owner name, address, lease number and cost so the assessor can cross-check. Examples: TX 50-144 "property owned by others", CA 571-L Part II, KY lessee rules, MI 632 leased-equipment sections [M; KY/TX H].
  - Conditional sales, $1-buyout leases and many capital leases are reported by the *lessee as owner* [M].
  - **ASC 842 classification is not the test.** A tax-law "true lease vs. conditional sale" flag is needed per lease.
- **Fully depreciated, expensed or de minimis assets.** Reported at historical cost wherever they are still in use. Valuation floors or residuals keep value above zero (CA minimum percent good, VA 20% floor, IN 30% pre-2025 floor, TN residuals).
  - Items expensed under the federal de minimis safe harbor, §179 or bonus depreciation are frequently **missing from the fixed-asset register**. This is the classic source of audit escapes.
  - The product needs a "property-tax capitalization" policy and a way to import AP-expensed equipment.
- **CIP.** Reportable in most states at cost-to-date as of the lien date. CA, IN and KY have specific lines or schedules [M]. Taxability of real-property versus personal-property CIP differs.
- **Supplies and inventory.** Supplies are taxable in most BPP states. Inventory is taxable in TX, LA, GA, KY, MS, AR, OK, WV and others, often with freeport or goods-in-transit options [M].
- **Disposals and transfers.**
  - Report removals dated before the lien date.
  - Track inter-county transfers: the original acquisition year and cost carry over, so acquisition date must not be reset on transfer.
  - IN and some MI assessors expect reconciliation to prior-year filings (VERIFY).
- **Situs data.**
  - Street address, parcel or account number, and the assessor's account ID (TX CAD account / iFile number, CA BIN, MI parcel, KY PVA).
  - Taxing-district code (CA tax rate area, TX jurisdiction combination, IN taxing district).
  - Lien-date location for mobile assets.
  - KY demands one return per location; FL one return per site.
- **Freeport, goods-in-transit and manufacturing exemptions.**
  - Freeport: TX §11.251, GA PT-50PF.
  - Goods-in-transit: TX §11.253.
  - Manufacturing: MI EMPP, CT MM&E, ME BETE, MD county manufacturing exemptions, KS post-2006 M&E.
  - Each has its own application form, deadline and asset-level eligibility.
- **Abatements and incentives.** TX Ch. 312 / JETI, IN SB-1/CF-1, LA ITEP, MI PA 198 / industrial facilities [M]. These need per-asset tagging to an abatement agreement with a schedule of percentages.
- **Appeals.** Windows tied to notice dates: TX by 15 May or 30 days after the notice; CA 2 Jul–15 Sep or 30 Nov; FL 25 days after the TRIM notice [M]; GA 45 days; MI March Board of Review; IN 45 days [M]. The product should store the assessor's noticed value per account and compare it with the rendered value to flag appeal candidates.

---

## Part B — Other local taxes touched by depreciation

| Jurisdiction / tax | Base | Depreciation conformity | Conf. |
|---|---|---|---|
| **NYC** Business Corporation Tax (C corps), General Corporation Tax (S corps), Unincorporated Business Tax | Starts from federal taxable income | **Decoupled from IRC §168(k) bonus** for property placed in service after 2002, except Resurgence Zone and NY Liberty Zone property. Recomputed with non-bonus MACRS on **NYC-399 / NYC-399Z**. Follows NYS-style decoupling, so expect continued decoupling from 2025 federal 100% bonus restoration (VERIFY). Some §179 limits for SUVs. | M |
| **Philadelphia** BIRT (net-income portion + gross receipts) | Net income from federal return (Method I/II) | Whether Philadelphia adds back federal bonus or follows PA's add-back is **VERIFY**. Must confirm against Philadelphia Revenue BIRT regulations. | VERIFY |
| **Ohio municipal net profit tax** (~600 municipalities; optional centralized filing via Ohio Business Gateway, ORC 718.80+) | "Adjusted federal taxable income" (ORC 718.01) | Generally **follows federal depreciation, including bonus**. Unlike Ohio's state individual income tax, which adds back bonus and recovers it over subsequent years. Ohio school-district income taxes follow the state rules for individuals. | M |
| **Kentucky occupational license (net profits) taxes** (Louisville Metro, Lexington-Fayette, counties and cities) | Federal-based net profit under KRS 67.750 | KRS 67.750 uses its own IRC reference date, which may differ from KY's state conformity date. Kentucky state tax is decoupled from bonus. Each locality's handling of bonus and §179: **VERIFY**. | VERIFY |
| **Portland Business License Tax / Multnomah County Business Income Tax** (combined return administered by City of Portland) | Federal taxable income with Oregon-style modifications | Believed to follow federal depreciation, consistent with Oregon's general depreciation conformity. Exact IRC reference: VERIFY. | VERIFY |
| **Detroit and other Michigan city income taxes** (~24 cities, City Income Tax Act / uniform ordinance; Detroit corporate returns administered by MI Treasury) | Federal taxable income, apportioned | Generally follows federal; bonus treatment VERIFY. | VERIFY |
| **St. Louis / Kansas City earnings taxes** (1% net profits on business activity in the city) | Federal net profit, apportioned | Generally follows federal; VERIFY. | VERIFY |
| Piggy-back local income taxes on individuals (MD counties, IN counties, PA Act 32 EIT, OH school districts) | State AGI or local definitions | Inherit **state** decoupling (e.g., MD and IN decouple from bonus) for pass-through owners. | M |
| Gross-receipts / payroll local taxes (San Francisco, LA city, Denver OPT, PA local business privilege) | Receipts or payroll | No depreciation dependency. | M |

**Product takeaway.** Local income taxes need extra *depreciation books*, not a separate engine:
- "NYC" can usually alias "NYS" (non-bonus MACRS).
- "Ohio municipal" can alias "Federal".
- "Philadelphia" and "KY OLT" need configurable bonus and §179 conformity flags.

The register must support per-book overrides of bonus percentage, §179 limits and conformity dates, plus generated adjustment schedules such as NYC-399Z-style detail.

---

## Part C — Production and filing

### C.1 E-filing channels and standards

- **California: SDR / e-SDR (statewide standard)** [H]
  - Filers register at **calbpsfile.org**. They obtain the **XML schema** by submitting a schema request form; reference documents are at public.calbpsfile.org.
  - **SDR** lets multi-county businesses file BOE-571-L for many counties in one standardised XML format. Special software is required to produce the files.
  - **e-SDR** is a no-cost web form for small filers. Each account gets a **BIN that changes annually**.
  - Exclusions exist on some e-SDR paths. Alameda says apartment, aircraft and agricultural filers must file on paper.
  - Electronic filing rests on RTC §441.5: the assessor specifies authentication methods and the BOE approves them. LTA 2025/018 (June 2025) addresses electronically filed BOE forms after AB 1879 (2024); details VERIFY.
- **Texas: appraisal-district portals, by agreement** [H]
  - Tax Code §1.085 allows electronic communication under an agreement with the chief appraiser, in Comptroller-approved formats.
  - Electronic renditions must "substantially comply". HCAD publishes *Electronic Filing Renditions 2026* (file-format and process guidance; contents VERIFY).
  - HCAD **iFile** works for accounts with an iFile number printed on the form.
  - Other large CADs (Dallas, Tarrant, Travis, Bexar) run their own portals. Bulk or API capabilities: VERIFY.
- **Elsewhere** [M / VERIFY]
  - **Florida:** many property appraisers offer online DR-405 filing and online extension requests (Manatee, Palm Beach) [H for extensions].
  - **Indiana:** DLGF has a statewide personal-property online portal (VERIFY name and coverage).
  - **Maryland:** SDAT Form 1 is filed through the state's Business Express portal.
  - **Kentucky, Arizona, Michigan, North Carolina and Virginia:** a mix of county or local portals, email and paper.
  - Treat every jurisdiction's channel as data: `{paper, pdf_email, portal_manual, portal_bulk_upload, xml_standard, api}`.

### C.2 Substitute and computer-generated forms

- **Texas.** §22.24(a) requires a form that "substantially complies" with the Comptroller's form. This is the legal basis for software-generated renditions; CAD-specific forms like HCAD 22.15 also qualify [H].
- **California.** Property Tax Rule 171: assessors must use BOE-prescribed forms and cannot change their content, though layout may vary [H].
  - Practice differs by county. Shasta accepts software-generated statements only as **attachments to a signed original** [H].
  - The practical route for vendors is SDR XML, or official forms with asset-detail attachments.
- **Florida.** DR-405 is a DOR-adopted form (Rule 12D-16.002) [H]. Acceptance of substitute layouts depends on the property appraiser (VERIFY).
- **Design implication.** Store a `substitute_policy` per jurisdiction-form-year: `{official_only, official_plus_attachment, substantially_compliant, assessor_approval_required}`. Default to filling the official PDF (AcroForm), with an asset-listing attachment.

### C.3 Machine-readable factor tables

| Source | Format | Notes |
|---|---|---|
| CA BOE AH 581 factors | **Open Data Portal (machine-readable)** since 2023, updated annually | Best in class [H] |
| NC NCDOR Cost Index & Depreciation Schedules | PDF manual, annual (2026 ed. 21 Nov 2025) | [H] |
| MI STC multipliers | Bulletin PDFs | [M] |
| TX CAD schedules | Per-CAD PDFs; Comptroller hosts examples | ~250 districts [H/M] |
| IN 50 IAC 4.2 pools; TN TCA 67-5-903; MO RSMo 137.122; KS statute | Statute or regulation text | Stable, rarely change [M] |
| LA LTC, GA DOR, CO ARL Vol. 5, AZ ADOR, KY DOR, OR/WA DOR | PDF manuals or tables | [M] |
| VA localities | Printed on each locality's return | Hundreds of variants [H/M] |

Conclusion: apart from California, factor content must be **extracted from PDFs and curated by people**, with versioning by tax year and a source URL and document hash for audit.

### C.4 How incumbents maintain thousands of jurisdictions

Everything in this section is [M] / VERIFY; vendor claims were not re-checked this session.

- **Vendors.**
  - **Thomson Reuters ONESOURCE Property Tax** (enterprise): jurisdiction content (forms, due dates, factors, assessor addresses), return generation, assessment and bill tracking, appeals workflow.
  - **Thomson Reuters Fixed Assets CS → UltraTax CS**: personal property tax integrations for TX, GA, KY and MI. TR's help pages for these integrations exist [H for their existence].
  - **Avalara Property Tax**: managed BPP return preparation and filing plus bill payment, marketed for multi-location enterprises. Avalara publishes content on 2026 exemption changes [H for the blog].
  - **Ryan PTMS** (Property Tax Management System): software plus Ryan's outsourced compliance and appeals practice.
- **Common model.**
  1. A content research team runs an annual cycle (Oct–Mar) monitoring legislation, assessor sites and STC/BOE letters.
  2. A form library is rebuilt each year, with substitute-form approvals where required.
  3. A factor-table library maps client asset classes to each jurisdiction's categories.
  4. An assessor directory holds addresses, account numbers and e-file credentials.
  5. Bill and notice tracking feeds payment and appeals.
  6. Human preparers or reviewers handle exceptions.
- **Scale.** The U.S. has roughly 3,000 counties and tens of thousands of property-taxing local governments (VERIFY Census of Governments counts). Assessing jurisdictions number in the thousands: Michigan alone has ~1,500 local units and New England adds town-level assessors [M].

---

## Implications for the product

### 1. Jurisdiction hierarchy model

```
state
 └─ assessing_jurisdiction      (county assessor | CAD | PVA | parish | township/city assessor | SDAT | town)
     ├─ filing_account          (taxpayer account id, BIN/iFile no., PIN; one per location or consolidated)
     └─ taxing_unit*            (county, city, school district/ISD, special/fire/water districts)
         └─ tax_rate_area       (unique combination of taxing units = CA TRA, TX jurisdiction combo, IN taxing district)
```
- Exemptions, filings and rates attach at *different levels*, so each rule needs an `aggregation_scope`: `{asset, location, account, taxing_unit, assessing_jurisdiction, county, local_unit, state, related_party_group}`. Examples:
  - TX $125k: per location within a taxing unit; related-party aggregation.
  - IN $2M: per county, acquisition cost.
  - WY $75k: per county, FMV.
  - MI $180k: per local unit, TCV.
  - FL $25k: per return/site.
  - AZ $500k: per taxpayer.
  - KY $1,000: per-location filing threshold.
- Each rule also needs `exemption_type`: `{filing_threshold, cliff_de_minimis, deduction_amount, percentage, asset_class_exemption}`. And it needs `value_basis`: `{acquisition_cost, market_value, true_cash_value, full_cash_value, assessed_value}`.
- Store the *taxing-unit opt-ins* that vary locally: TX freeport and GIT, GA freeport level, LA ITEP, VA local rates and schedules.

### 2. Asset situs and location data

- **Point-in-time snapshots.** Use Delta Lake time travel or SCD2 tables in Databricks to reconstruct each asset's **location, status, cost, owner/lessee and lease type as of each lien date** (1 Jan; 1 Oct AL/CT; 31 Dec MI/RI; 1 Jul DC/WV).
- **Location master.** Geocoded address → parcel / TRA / taxing district, plus the assessor account per location (KY requires one return per location; FL one per site).
- **Mobile assets.** Handle rental fleets, construction equipment and vehicles. Add in-transit and storage statuses, plus freeport tracking of inventory dwell time (175 days in TX).
- **Lease subledger.** Leased-in and leased-out assets with the tax-law ownership flag, owner name and address, and lessee location.
- **Expensed-asset capture.** Import AP lines expensed under the de minimis safe harbor or §179/bonus. Keep fully depreciated assets in a "property tax book" until physically disposed. Add a supplies-balance input.

### 3. Assessor factor tables

- **Factor table entity:** `factor_table(jurisdiction_id, tax_year, table_kind{index|percent_good|composite|statutory}, category_code, life_or_group, age_or_acq_year, factor, floor, min_value, source_url, doc_hash, published_on, reviewed_by)`.
- **Mapping layer:** company asset class, GL account or MACRS class → jurisdiction category. Examples: CA AH 581 tables, MI Form 632 groups, IN pools, TN groups, NC schedules, TX CAD categories, MO MACRS-recovery-period schedules.
- **Valuation engine:**
  - Σ cost × factor, then floors (asset-level and return-level, e.g., the IN 30% floor scoped by placed-in-service date and TIF status).
  - Then exemptions, assessment ratio and rate. This yields an **estimated assessed value and tax** for accruals.
  - Compare against the assessor's notice to flag appeals.
- **Ingestion:** CA from the BOE Open Data Portal via API or CSV. Everything else through PDF extraction plus human review, with diff-based change detection each year.

### 4. Form templates

- **Template entity** per `jurisdiction × form × tax_year`, holding:
  - field map: AcroForm field IDs, or XML XPath for CA SDR;
  - schedule layouts: year-acquired buckets, category rows, pagination limits;
  - signature and attestation rules;
  - `substitute_policy`;
  - attachment rules: detailed asset listings, lessee schedules.
- Version every template and keep golden-file regression tests.
- Support CAD-specific Texas forms (HCAD 22.15 variants) that are alternatives to 50-144.
- Exemption and application forms are first-class templates: TX freeport 50-113, GA PT-50PF, MI 5076/5278/5618, IN Form 104 exemption checkbox, ME BETE 801.

### 5. Filing calendar

- **Calendar entity:** `{lien_date, return_due, extension{auto|on_request, request_deadline, extended_due, discretionary_extra}, penalty_schedule, weekend_holiday_roll_rule, notice_of_value_window, appeal_window(relative_to_notice), bill_dates, installment_dates}`.
- Dates must be computed per year with roll rules, for example NC 31 Jan → 2 Feb 2026, CA 7 May penalty date, CA county-specific e-file cut-offs, FL county extension-request cut-offs.
- 2026 key dates:

  | Date | Filing |
  |---|---|
  | Jan 31 / Feb 2 | NC listings |
  | Feb 20 | MI Form 632 / 5076 / 5278 |
  | Mar 1 | TN, MO |
  | Mar 15 | OK, OR, ID, KS |
  | Apr 1 | CA, FL, GA, AZ, LA |
  | Apr 15 | TX, CO, MD |
  | Apr 30 | WA |
  | May 1 | Fairfax Co. VA, NE |
  | May 7 | CA penalty date |
  | May 15 | IN, KY; TX extended |
  | Jul 31 | DC FP-31 |
  | Nov 1 | CT |
  | Dec 31 | AL |

### 6. Exemptions engine

- **Statewide thresholds** with history (rule valid-from and valid-to): TX 2025 $2,500 cliff → 2026 $125k deduction; IN $80k → $2M; AZ ~$270k → $500k; WY $2,400 → $75k; GA $7,500 → $20k; WI repeal 2024.
- **Asset-level exemptions:** manufacturing (MI EMPP, CT, ME BETE, KS), inventory (freeport, GIT), pollution control, abatement agreements with year-by-year percentages.
- **"Below threshold" workflows.** Certify that no filing is needed, or file a short statement (TX HB 9 inserts, IN first-year claim then no refiling, FL no refiling under $25k). This is valuable for the many filers that dropped below the 2026 thresholds.

### 7. Local income tax books

Add configurable depreciation books with per-book bonus, §179 and conformity flags: NYC, Philadelphia, OH-municipal, KY-OLT, Portland/Multnomah, MI-city, St. Louis/KC. Generate adjustment schedules (NYC-399Z-style detail).

### Suggested launch-state shortlist

1. **California.** Statewide uniform BOE-571-L, the SDR XML e-file standard, and BOE factor tables on the Open Data Portal: the lowest content cost per filing. Very high BPP volume.
2. **Texas.** The largest BPP market, including inventory. The 50-144 substantial-compliance rule permits generated renditions. HB 9 creates new demand for per-location exemption analysis and related-party aggregation. Content burden: ~250 CAD schedules. Start with the top ~20 CADs.
3. **Florida.** Uniform DR-405 across 67 counties and a simple $25k rule.
4. **Georgia.** Uniform PT-50P across 159 counties, a DOR manual, and freeport options.
5. **North Carolina.** Uniform listing plus a single NCDOR factor manual.

**Phase 2:** MI (uniform Form 632 and STC multipliers, but ~1,500 local units and possible repeal), VA (high per-locality variation), KY, LA, TN, AZ, CO, WA, MO, SC.

**De-prioritise:** IN, where the $2M exemption removes most mid-market filers, and WI (repealed).

---

## Sources

**Texas**
- Bexar Appraisal District, "What's New in BPP: HB 9, HB 3424 and SB 1352": https://help.bcad.org/hc/en-us/articles/46875482348691-What-s-New-in-Business-Personal-Property-BPP-HB-9-HB-3424-and-SB-1352
- Dallas CAD HB 9 $125K rendition insert: https://www.dallascad.org/Admin/125K_Exemption_Rendition_Insert_HB9.pdf ; 2026 rendition: https://www.dallascad.org/Admin/DMN_BPP_Rend_2026.pdf
- Comptroller Form 50-144: https://comptroller.texas.gov/forms/50-144.pdf ; BPP cost schedules page: https://comptroller.texas.gov/taxes/property-tax/personal-schedules/
- HB 9 House Research Organization analysis: https://hro.house.texas.gov/pdf/ba89R/HB0009.PDF ; fiscal note: https://capitol.texas.gov/tlodocs/89R/fiscalnotes/html/HB00009E.htm
- SB 1352 analysis: https://capitol.texas.gov/tlodocs/89R/analysis/pdf/SB01352I.pdf
- Bandera CAD 2026 BPP legislative changes: https://bancad.org/wp-content/uploads/2026/01/2026-BPP-Legislative-Changes-Info.pdf ; Fort Bend CAD: https://www.fbcad.org/wp-content/uploads/2026/01/New-BPP-Law-2026.pdf ; Grayson CAD: https://graysonappraisal.org/welcome-to-grayson-cad-website/
- Tax Code ch. 22: https://statutes.capitol.texas.gov/Docs/TX/pdf/TX.22.pdf ; §22.24: https://texas.public.law/statutes/tex._tax_code_section_22.24 ; 34 TAC §9.3031: https://www.law.cornell.edu/regulations/texas/34-Tex-Admin-Code-SS-9-3031
- HCAD Electronic Filing Renditions 2026: https://hcad.org/assets/uploads/pdf/forms/2026/Electronic_Filing_Renditions_2026.pdf ; Form 22.15 (2026): https://hcad.org/assets/uploads/pdf/forms/2026/Rendition/22.15.pdf ; rendition guide: https://hcad.org/hcad-resources/hcad-industrial-personal-property/hcad-guide-to-personal-property-renditions
- Bracewell 89th Legislature summary: https://www.bracewell.com/resources/texas-tax-update-key-changes-enacted-during-the-89th-legislature/

**California**
- BOE LTA 2025/046 (2026 AH 581): https://boe.ca.gov/proptaxes/pdf/lta25046.pdf ; AH 581 memo: https://boe.ca.gov/meetings/pdf/2025/202512-AH581-Memo.pdf
- Property Tax Rule 171: https://boe.ca.gov/proptaxes/pdf/rules/Rule171.pdf ; LTA 2025/018: https://www.boe.ca.gov/proptaxes/pdf/lta25018.pdf ; BPS program resources: https://www.boe.ca.gov/proptaxes/business-property-statement-program/resources.htm
- SDR: https://sfassessor.org/node/1276 ; Sacramento e-file: https://assessor.saccounty.gov/content/assessor/us/en/sdr-and-esdr/efile-your-business-property-statement.html ; Shasta e-filing: https://shastacounty.gov/node/2714 and FAQ https://www.shastacounty.gov/sites/default/files/fileattachments/assessor/page/3104/2019-faq-for-efiling.pdf
- Fresno: https://www.fresnocountyca.gov/Departments/Assessor/Business-Property ; San Mateo FAQ: https://smcacre.gov/assessor/business-property-statement-form-571-l-faqs ; Santa Clara: https://www.sccassessor.org/property-information/business-owner/business-property-statement-filing ; Kings: https://www.countyofkingsca.gov/departments/general-services/assessor-clerk-recorder/assessor/business-property-information

**Florida**
- §193.063: https://www.flsenate.gov/Laws/Statutes/2020/193.063 ; Rule 12D-16.002: https://law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-12D-16-002
- Manatee TPP brochure: https://manateepao.gov/data/downloads/TPP%20Brochure%20R012025.pdf ; Palm Beach extension: https://pbcpao.gov/Property/DR405Extension ; Sarasota: https://www.sarasotapropertyappraiser.gov/appraisal-info/tangible-personal-property/ ; Collier: https://www.collierappraiser.com/Main_TPP/TangiblePersonalProperty.html

**Georgia**
- Gwinnett exemptions: https://gwinnettcounty.com/departments/financialservices/taxassessorsoffice/personalpropertyappraisal/exemptions ; Fayette PT-50P: https://fayettecountyga.gov/assessors_office/pdf/PT50P_Business.pdf ; Carroll returns: https://www.qpublic.net/ga/carroll/returns.html
- Ballotpedia on HB 808 / Referendum A: https://news.ballotpedia.org/2024/03/28/georgia-voters-to-decide-on-measure-increasing-personal-property-tax-exemption-from-7500-to-20000/ ; WABE results: https://www.wabe.org/georgia-voters-approve-two-statewide-ballot-measures-one-too-close-to-call/

**Michigan**
- Treasury PPT exemptions: https://www.michigan.gov/en/taxes/property/ppt/personal-property-tax-exemptions ; Small business exemption guide: https://www.michigan.gov/documents/treasury/Guide_to_the_Small_Business_Taxpayer_Exemption_with_Appendix_1-17_551793_7.pdf
- Grand Rapids: https://www.grandrapidsmi.gov/departments/assessor/assessment-forms/apply-for-a-small-business-property-tax-exemption/ ; Walker: https://www.walker.city/DocumentCenter/View/4697 ; Fenton Twp: https://www.fentontownship.org/media/7936
- STC 2026 calendar (Bulletin 11 of 2025): https://elytownship.com/assessor/bulletin-11-of-2025-property-tax-and-equalization-calendar-for-2026 ; STC 20 Oct 2026 agenda: https://www.michigan.gov/treasury/local/stc/state-tax-commission-meetings/2026-state-tax-commission-meeting-schedule/stc-meeting-agenda-october-20-2026
- HB 5878 (press release, VERIFY): https://gophouse.org/posts/my-bill-passed-eliminating-state-property-tax

**Indiana**
- DLGF memo, legislation affecting assessment (23 May 2025): https://www.in.gov/dlgf/files/2025-memos/250523-Cockerill-Memo-Legislation-Affecting-Assessment-Matters.pdf ; DLGF 2025 legislative overview: https://www.in.gov/dlgf/files/2025-presentations/250618-Crisler-Lucas-Marusarz-Presentation-2025-Legislative-Overview-10-am.pdf
- 2026 Form 103-Short: https://www.in.gov/counties/martin/files/SF-11274-R46-103-Short-2026-Business-Tangible-Personal-Property-Return-SECURED.pdf ; Form 104: https://www.in.gov/counties/martin/files/SF-10068-R31-Form-104-Business-Tangible-Personal-Property-Return-SECURED.pdf
- Baker Tilly on SEA 1 / HEA 1427: https://www.bakertilly.com/insights/understanding-the-impact-of-sea-1-and-hea-1427-on-business-personal-property ; INCPAS hub: https://www.incpas.org/home/advocacy/government-relations/sea-1-local-government-finance-(business-personal-property)-hub

**Kentucky, Louisiana, North Carolina, Virginia**
- KY 62A500 packet (2026): https://revenue.ky.gov/Forms/62A500(P)%20(2026).pdf ; KY DOR BPP: https://revenue.ky.gov/Property/Business-Personal-Property/Pages/default.aspx ; FAQ: https://revenue.ky.gov/Property/Business-Personal-Property/Pages/Frequently-Asked-Questions.aspx ; Jefferson PVA: https://jeffersonpva.ky.gov/property-assessment/personal-property/
- LA Const. art. VII §20.1: https://www.legis.la.gov/legis/Law.aspx?d=1428948 ; WWNO 16 May 2026 results: https://www.wwno.org/politics/2026-05-16/may-16-election-results-louisiana-voters-reject-all-5-amendments-see-full-results ; Bloomberg Tax: https://news.bgov.com/daily-tax-report-state/louisiana-voters-reject-constitutional-change-to-inventory-taxes ; KPMG: https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/twist-040725-louisiana.pdf
- NCDOR cost index & depreciation schedules: https://www.ncdor.gov/cost-index-and-depreciation-schedules ; 2025 manual: https://ncdor.gov/2025-cost-index-manual-finalpdf/open ; Davie Co.: https://www.daviecountync.gov/374/Business-Personal-Property ; Guilford Co.: https://www.guilfordcountync.gov/government/departments-and-agencies/tax-department/business-property-and-listing-information ; Bloomberg Tax on 2026 manual: https://news.bloombergtax.com/daily-tax-report-state/north-carolina-dor-updates-2026-cost-index-manual
- Fairfax County: https://www.fairfaxcounty.gov/taxes/business/understanding-tangible-property-vehicles ; City of Fairfax 2024 return: https://fairfaxva.gov/home/showpublisheddocument/552/638386635865230000

**Arizona, Wyoming, Wisconsin, multistate**
- A.R.S. 42-11127: https://www.azleg.gov/ars/42/11127.htm ; SB 1749 summary: https://www.azleg.gov/legtext/57leg/1R/summary/S.1749APPROP.DOCX.htm ; SB 1069: https://www.azleg.gov/legtext/57leg/1r/bills/sb1069s.htm ; Mohave Co.: https://www.mohave.gov/departments/assessor/personal-property/business-personal-property/
- WY SF0048 summary: https://www.wyoleg.gov/2025/Summaries/SF0048.pdf ; enrolled act: https://wyoleg.gov/2025/Enroll/SF0048.pdf ; Uinta Co.: https://uintacountywy.gov/1116/SF0048-Business-Property-Exemption
- WICPA on 2023 Act 12: https://www.wicpa.org/news/articles/2078:wisconsin-repeals-personal-property-tax ; Husch Blackwell: https://www.huschblackwell.com/newsandinsights/wisconsin-repeals-tax-on-personal-property
- Tax Foundation 2026 changes: https://taxfoundation.org/research/all/state/2026-state-tax-changes/ ; Grant Thornton (Feb 2026): https://www.grantthornton.com/insights/alerts/tax/2026/salt/general/states-focus-on-personal-property-tax-relief-02-16 ; MultiState 2026 ballot: https://www.multistate.us/insider/2026/7/17/tax-policy-is-on-the-ballot-this-fall-property-tax-exemptions-and-more ; Avalara: https://www.avalara.com/us/en/blog/more-property-tax-relief-more-rules-navigating-enterprise-compliance.html
- TR Fixed Assets CS PPT integrations: https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/integration/texas-personal-property-tax.html ; https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/integration/georgia-personal-property-tax ; https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/integration/kentucky-personal-property-tax.html ; https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/integration/michigan-personal-property-tax.html

---

## Open questions

1. **TX HB 9 mechanics.** Is the $125k per location, per taxing unit, or per account? What are the lessor limits? Is a rendition required below the threshold, and on which Comptroller form number and 2026 revision? Is §11.146 (mineral interests) unchanged? Verify against the enrolled text and Comptroller guidance once comptroller.texas.gov is reachable.
2. **TX bill passage.** Confirm SB 1352 and HB 3424 enactment and their effect on freeport and dealer filings.
3. **AZ.** Which bill enacted the $500k exemption (SB 1069 vs. SB 1749)? What is the current Class 1 assessment ratio?
4. **MI HB 5878.** Senate and gubernatorial status. If enacted, 2027 Form 632 demand collapses. Also resolve the Form 632 + Form 5076 filing rule for the $80k–$180k tier.
5. **GA $20k.** Effective date and how counties administer it.
6. **Unverified table cells.** AL, AK, CO, ID, MD, MS, MT, NE, NV, NM, OR, RI, SC, UT, VT, WV and WY need primary-source verification of form names, deadlines, thresholds and ratios.
7. **Part B conformity.** Philadelphia BIRT, KY OLT (KRS 67.750 IRC date), Portland/Multnomah, Detroit/MI cities and St. Louis/KC handling of bonus depreciation and §179, including the 2025 federal 100% bonus restoration.
8. **E-file capabilities.** Contents of HCAD's 2026 electronic-filing guideline (bulk formats?). Bulk or API options at Dallas, Tarrant, Travis and Bexar CADs. Indiana's statewide portal. Michigan and Kentucky e-file options.
9. **CA SDR schema.** Current schema version, how to obtain it (request process), and whether vendor certification or testing is required.
10. **Licensing of factor data.** Whether CAD schedules derived from Marshall & Swift/CoreLogic can be redistributed in a SaaS product.
11. **3 Nov 2026 ballots.** Re-check property-tax measures, four days after this research date.
12. **Vendor coverage.** Jurisdiction counts and e-file coverage claimed by Avalara, ONESOURCE and Ryan PTMS, for competitive positioning.
