# 05 — Financial-Reporting (Book) Accounting for Fixed Assets: US GAAP, IFRS, Reporting and Controls

*Research date: 2026-10-30. Scope: book (financial-reporting) accounting only. Tax books (MACRS, AMT, E&P, state conformity) are covered by other swarm reports and appear here only where they meet book (ASC 740 / IAS 12).*

**Confidence key:** **[H]** high: settled codification or standard text, consistent across sources. **[M]** medium: confirmed by secondary Big 4 or firm summaries, wording not checked against the primary text. **[L]** low: inferred or only one source. **VERIFY**: confirm against the primary source (FASB ASC/ASU PDF, IFRS Foundation text, AICPA guide) before building logic on it.

**Research limitations.** WebFetch was blocked for several domains in this session (rsmus.com, crowe.com), and the shared web-search budget ran out partway through. Most 2024–2026 items below were confirmed through search-result excerpts from Big 4 and firm publications, not full-text reads. Codification paragraph references come from long-standing ASC/IFRS structure and should be spot-checked against asc.fasb.org.

---

## 1. Executive summary

1. **US GAAP fixed-asset accounting is mostly stable, but several standards around it changed in 2024–2026, and they change what the product must capture:**
   - **ASU 2025-06** (internal-use software, ASC 350-40; issued Sept 18, 2025). Removes the project-stage model and replaces it with a "management authorized and committed to funding + probable-to-complete" threshold, with a "significant development uncertainty" assessment. Supersedes ASC 350-50 (website costs). Says capitalized internal-use software follows **Topic 360 PP&E disclosures**. Effective for all entities for annual periods beginning after **Dec 15, 2027**; early adoption is permitted; prospective, modified, or retrospective transition. **[H]** for the date and core model, **[M]** for transition detail.
   - **ASU 2025-10** (government grants, ASC 832; issued Dec 4, 2025). The first US GAAP recognition and measurement model for business-entity grants. Grants related to assets use a policy election: **cost accumulation** (reduce the asset's basis, lowering depreciation) or **deferred income** (a liability amortized to income). Recognition when it is *probable* the entity will comply and the grant will be received. Effective for PBEs for annual periods beginning after **Dec 15, 2028**, one year later for others; early adoption permitted. **[H]/[M]**
   - **ASU 2024-03 as clarified by ASU 2025-01** (DISE, the disaggregation of income statement expenses). PBEs must disclose depreciation, intangible amortization and other natural expenses inside each relevant expense caption, in a tabular footnote. Effective for annual periods beginning after **Dec 15, 2026** and interim periods beginning after Dec 15, 2027. **For calendar-year PBEs, FY2027 is the first year, so the depreciation-by-caption mapping must be in production before 2027 year-end close.** **[H]**
   - **ASU 2026-02** (environmental credits, new Topic 818; issued May 19, 2026). Intangible rather than PP&E, but relevant if the platform tracks credits tied to capital projects. **[M]**, effective date VERIFY.
   - No FASB ASU issued in 2024–2026 amends ASC 360-10's core impairment, held-for-sale or depreciation model. **[M]**: searches found only ASU 2026-01 and 2026-02 in 2026, with nothing PP&E-specific on the agenda.
2. **On the IFRS side, IFRS 18** (effective Jan 1, 2027, applied retrospectively) requires entities that present expenses by function to disclose depreciation, amortization and impairment **by function line item**. This parallels DISE and should share one "expense caption" mapping model. **[H]/[M]** The IAS 37 targeted improvements (decommissioning discount rates) and the IAS 36 / IFRS 3 goodwill and impairment amendments were **still in redeliberation as of the Sept 2026 IASB papers**, so neither is final. **[M]**
3. **Where the frameworks diverge determines how the books are designed.** IFRS requires componentization, offers a revaluation model, uses one-step impairment at the cash-generating-unit (CGU) level with reversals, remeasures decommissioning liabilities at the current rate each period, and capitalizes borrowing costs net of investment income. A GAAP book cannot be copied into an IFRS book by changing only the depreciation parameters. **An IFRS book needs its own component tree, its own carrying-amount history (for reversal ceilings and revaluation surplus) and its own provision measurement.** **[H]**
4. **For SOX customers the controls carry as much weight as the calculations.** These include period locking, maker-checker approvals, immutable audit trails, subledger-to-GL reconciliation, reliability of information produced by the entity (IPE), and a SOC 1 Type II covering the calc engine and the rule-content pipeline. The PCAOB's technology-assisted-analysis amendments (AS 1105/AS 2301, effective for audits of fiscal years beginning on or after Dec 15, 2025) increase auditor scrutiny of the electronic data the system produces. **[H]**
5. **Recommended architecture.** Use a book-agnostic asset master; per-book asset-book records; an immutable, effective-dated event ledger; a deterministic, versioned calc engine; per-(entity, book, period) close states; and a posting-rules layer that turns events into balanced GL journals. Each GL-posting book posts to its own ledger (or posts only the GAAP-to-IFRS differences). Tax books are memo books that feed the provision.

---

## 2. Standards by topic: US GAAP

### 2.1 ASC 360-10: initial measurement and capitalization
- **Cost** is every expenditure needed to bring the asset to the condition and location for its intended use: purchase price, freight, installation, site preparation, professional fees, capitalized interest (ASC 835-20) and the asset retirement cost (ASC 410-20). Abnormal costs, training and general overhead are expensed. **[H]**
- **Capitalization thresholds.** GAAP sets no bright-line threshold. The policy is a materiality judgment, documented and applied consistently, often $1k–$5k per item, higher for large filers, sometimes with "group asset" rules for bulk purchases. Many companies align the book threshold with the tax de minimis safe harbor (Treas. Reg. §1.263(a)-1(f): $5,000 per item with an applicable financial statement, $2,500 without). The safe harbor requires a matching written book expensing policy. **[H]** The product needs per-entity, per-asset-class, effective-dated thresholds, plus an "expensed-under-threshold" register so auditors can test completeness.
- **Subsequent costs.** Betterments that extend life, increase capacity or improve efficiency are capitalized. Repairs and maintenance are expensed. **[H]**
- **Planned major maintenance** (e.g., aircraft heavy checks). The accrue-in-advance method is prohibited (ASC 360-10-25-5). The direct-expensing, built-in-overhaul and deferral methods are acceptable. **[H]** The built-in-overhaul method is in effect componentization under GAAP.

### 2.2 Componentization (GAAP practice)
GAAP **permits but does not require** component depreciation. Many US companies depreciate at the asset level with a composite or group life. Utilities and telecoms use group/composite depreciation with retirements charged to accumulated depreciation and no gain or loss. Component accounting is common for real estate (building shell, roof, HVAC), airlines and some manufacturers. **[H]** The product needs to support (a) a parent–component hierarchy, (b) group/composite pools where retirements carry no gain or loss, and (c) asset-level SL.

### 2.3 Depreciation methods, lives, salvage and conventions
Depreciation must be "systematic and rational" over the estimated useful life. Commonly used methods are below. **[H]**

| Method | Formula (annual) | Notes |
|---|---|---|
| Straight-line (SL) | (Cost − Salvage) / Life | Most common for book. |
| Declining balance (DDB = 200%, also 150%) | NBV_begin × (Factor / Life) | Ignores salvage in the rate but never depreciates below salvage. Usually switches to SL when SL on remaining NBV exceeds DB. The switch must be configurable. |
| Sum-of-the-years'-digits (SYD) | (Cost − Salvage) × RemainingLife / [n(n+1)/2] | Fractional years are handled by blending successive SYD years. |
| Units-of-production (UOP) | (Cost − Salvage) × UnitsThisPeriod / TotalEstimatedUnits | Needs usage feeds (hours, miles, tonnes). Revising total units is a change in estimate. |
| Group / composite | Rate × Pool gross cost | Used by regulated utilities. |
| Depletion (cost) | UOP on reserves | Oil and gas, mining (ASC 932). Out of core scope. |

- **Useful life and salvage** are entity-specific estimates (expected use, physical wear, obsolescence, legal or contractual limits). They should be reviewed when events indicate change. GAAP has no "at least annually" mandate, unlike IAS 16.51. **[H]**
- **Conventions** for book (full-month, mid-month, half-year, actual days, next-month) are not prescribed by GAAP. They are policy choices that must not be materially different from precise calculation. **[H]** The convention is a per-book parameter.
- **Leasehold improvements** are amortized over the shorter of useful life and remaining lease term, unless ownership transfers or a purchase option is reasonably certain to be exercised (ASC 842-20-35-12). Under **ASU 2023-01**, common-control leases use the improvement's useful life to the common-control group while the lessee controls use of the asset. Effective for fiscal years beginning after Dec 15, 2023. **[H]**

### 2.4 Changes in estimate and errors (ASC 250)
- Changes in useful life, salvage or UOP total units are **changes in accounting estimate: prospective only**. The remaining NBV less salvage is spread over the revised remaining life, with no catch-up. **[H]**
- A **change in depreciation method** is a "change in accounting estimate effected by a change in accounting principle" (ASC 250-10-45-18). It is applied prospectively but needs a preferability justification. SEC registrants need an auditor preferability letter (Reg S-K Item 601(b)(18)). **[H]**
- **Error corrections** are retrospective restatements (ASC 250-10-45-23). Immaterial items may be corrected as out-of-period adjustments under SAB 108 analysis. **[H]** The engine must keep "prospective change" separate from "recompute history" and must never silently rewrite locked periods (§7.4).

### 2.5 Impairment of held-and-used assets (ASC 360-10-35-17 to 35-35)
- **Trigger-based, not periodic.** Test when indicators exist (ASC 360-10-35-21): a significant decline in market price, adverse change in use or physical condition, adverse legal or business climate, cost overruns, operating or cash-flow losses, or an expectation that the asset will more likely than not be disposed of significantly before the end of its life. **[H]**
- **Asset group:** the lowest level with identifiable cash flows largely independent of other assets (35-23). **[H]**
- **Step 1, recoverability.** Compare the carrying amount with the **undiscounted** cash flows from use and eventual disposition, using entity-specific assumptions over the remaining life of the group's *primary asset*. Cash flows of one group cannot offset another. **[H]** ([Deloitte Roadmap 2.4](https://dart.deloitte.com/USDART/home/codification/presentation/asc205-20/roadmap-disposals-long-lived-assets-discontinued-operations/chapter-2-long-lived-assets-classified/2-4-testing-long-lived-assets))
- **Step 2, measurement.** The loss is the carrying amount minus **fair value** (ASC 820). A recoverable group records no loss even if fair value is below carrying amount. **[H]** ([Deloitte Roadmap 2.5](https://dart.deloitte.com/USDART/home/codification/presentation/asc205-20/roadmap-disposals-long-lived-assets-discontinued-operations/chapter-2-long-lived-assets-classified/2-5-measurement-an-impairment-loss))
- **Allocation** is pro rata across the group's long-lived assets by carrying amount. No individual asset may go below its own fair value if that fair value can be determined without undue cost and effort (35-28). **[H]**
- **The adjusted carrying amount becomes the new cost basis.** Reversal is **prohibited** for held-and-used assets (35-20). Remaining life and method should be reassessed. **[H]**
- **Order of testing.** Other assets (inventory, receivables) and indefinite-lived intangibles first, then ASC 360 asset groups, then goodwill. **[H]**
- ROU assets (operating and finance) are in scope of the ASC 360 impairment guidance and are tested inside asset groups. **[H]** ([Deloitte Roadmap 1.3](https://dart.deloitte.com/USDART/home/codification/presentation/asc205-20/roadmap-disposals-long-lived-assets-discontinued-operations/chapter-1-overview-scope/1-3-scope-asc-360-10))

### 2.6 Held for sale, abandonment, disposals
- **HFS criteria (ASC 360-10-45-9), all six:** management with authority commits to a plan; the asset is available for immediate sale in its present condition; an active program to find a buyer has started; the sale is probable and expected to complete within one year (limited exceptions); it is actively marketed at a reasonable price; changes to the plan are unlikely. **[H]**
- **Measurement.** The lower of carrying amount or fair value less costs to sell. **Depreciation stops.** A later increase in fair value less costs to sell is recognized as a gain only up to cumulative losses previously recognized (35-40). **[H]**
- **Reclassification back to held and used** (35-44). Measure at the lower of (a) carrying amount before HFS classification, adjusted for depreciation that would have been recognized, or (b) fair value at the date of the decision not to sell. **[H]** The engine must be able to compute a "shadow depreciation" amount.
- **Discontinued operations** (ASC 205-20): a disposal group that is a strategic shift with a major effect. The FA system supplies the disposal-group balances. **[H]**
- **Abandonment.** An asset to be abandoned is held and used until it is abandoned. Depreciation estimates are revised to reflect the shortened life. A *temporarily idle* asset is not abandoned and continues to be depreciated (35-47 to 35-49). **[H]**
- **Sales to non-customers.** Gain or loss on derecognition of nonfinancial assets follows **ASC 610-20** (control-transfer principle, consideration measured using ASC 606 principles). Sales to customers in the ordinary course follow ASC 606. **[H]**

### 2.7 Nonmonetary exchanges (ASC 845)
- Default: measure at fair value (of the asset surrendered, unless the asset received is more clearly evident) and recognize a gain or loss. Use carryover basis when fair value is not determinable, the exchange lacks commercial substance, or it is an exchange of products or property held for sale to facilitate sales to customers. **[H]**
- If monetary boot is 25% or more of fair value, the transaction is monetary (ASC 845-10-25-6). **[H]**
- Scope interplay: exchanges of nonfinancial assets with customers go to ASC 606, and many with non-customers go to ASC 610-20 (noncash consideration at fair value). The residual ASC 845 scope is narrower than before ASU 2014-09/2017-05. **[M]**, VERIFY the scope exclusions in ASC 845-10-15-4.
- Product: an `EXCHANGE` event carries the fair value of what is given and received, the boot, a commercial-substance flag and the governing guidance (606/610-20/845).

### 2.8 Capitalized interest (ASC 835-20)
- Applies to **qualifying assets**: assets constructed for own use, or for sale or lease as discrete projects, that take a period of time to get ready. Not assets in use or ready for use, routine inventory, or (generally) assets funded by restricted gifts or grants. **[H]**
- **Amount** = avoidable interest. Weighted-average accumulated expenditures × the specific-borrowing rate (for the portion funded by specific debt), then × the weighted-average rate on other borrowings. **Capped at total interest actually incurred.** **[H]**
- **Period** starts when expenditures have been made, activities are in progress and interest is being incurred. It is suspended during substantial suspensions of activity and ends when the asset is substantially complete. **[H]**
- Unlike IAS 23, US GAAP generally does **not** net investment income on unspent proceeds of tax-exempt borrowings since ASU 2014-? removed... **(VERIFY:** under ASC 835-20-30-11 legacy guidance, the offset applied only to certain restricted tax-exempt borrowings. Confirm current text). **[L]**
- Product: a capitalized-interest module computes AWAE (average accumulated expenditures) per CIP project per period from CIP cost postings, takes debt and rate inputs from treasury, applies the cap at entity level, and posts to CIP.

### 2.9 Asset retirement obligations (ASC 410-20)
- **Recognition.** Recognize the fair value of a legal obligation (including a conditional ARO) when incurred, if reasonably estimable. Capitalize an equal asset retirement cost (ARC) to the related asset and depreciate it over the asset's life. **[H]**
- **Measurement.** Expected present value using the **credit-adjusted risk-free rate (CARFR)**, built from the Treasury curve matched to settlement timing plus the entity's credit spread. **[H]** ([Deloitte Roadmap 4.5](https://dart.deloitte.com/USDART/home/codification/liabilities/asc410-10/roadmap-environmental-obligations-aro/chapter-4-accounting-for-asset-retirement/4-5-initial-measurement-aros-arcs))
- **Accretion.** Each layer accretes with the interest method at the rate it was first measured at. Accretion is an **operating expense, not interest expense**, and is not eligible for interest capitalization. **[H]**
- **Revisions in layers.** Upward revisions in undiscounted cash flows are a **new layer at the current CARFR**. Downward revisions are discounted at the **original layer's rate** (or a weighted average if the layer cannot be identified). Revisions adjust both the ARO and the ARC. **[H]** ([Deloitte Roadmap 4.6](https://dart.deloitte.com/USDART/home/codification/liabilities/asc410-10/roadmap-environmental-obligations-aro/chapter-4-accounting-for-asset-retirement/4-6-subsequent-measurement-aros-arcs))
- **Settlement.** A difference between the liability and the actual cost is a gain or loss. Disclose a rollforward (incurred, settled, accretion, revisions). **[H]**
- Product: ARO is a **liability ledger with layers** (layer_id, inception date, undiscounted cash flows by year, rate, accretion schedule) linked to one or more ARC asset-book records. GAAP and IFRS ARO behavior differ (§3.6), so the layer model belongs to the book.

### 2.10 Leases: right-of-use assets (ASC 842)
- **Finance lease (lessee).** The ROU asset is amortized, generally straight-line, over the shorter of useful life and lease term (useful life if ownership transfers or a purchase option is reasonably certain). Interest on the liability is recognized separately, giving a front-loaded total expense. **[H]**
- **Operating lease (lessee).** A single straight-line lease cost. ROU amortization is the plug: straight-line cost minus liability accretion. **[H]**
- **ROU impairment** follows ASC 360 at the asset-group level. The lease liability is unaffected. After impairment of an **operating** ROU, the remaining ROU is amortized straight-line over the remaining term (ASC 842-20-35-10). Total expense is no longer straight-line: ROU amortization plus interest accretion. **[H]** ([RSM on ROU impairment](https://rsmus.com/content/dam/rsm/insights/financial-reporting/1pdf/impairments-of-right-of-use-assets.pdf); [Deloitte Spotlight](https://dart.deloitte.com/USDART/home/publications/deloitte/accounting-spotlight/2021/lease-accounting-real-estate-rationalization))
- **Presentation.** Finance and operating ROU assets may not share a balance-sheet line. If they are not presented separately, disclose which lines include them (ASC 842-20-45-1). Finance ROU is often presented within PP&E. **[H]**
- **Lessor operating leases.** The underlying asset stays on the lessor's books and is depreciated. This matters for equipment lessors and rental fleets. **[H]**
- **How ROU sits in an FA register.** Most FA platforms either (a) integrate with a separate lease-accounting subledger, which holds the liability, schedules and remeasurements, and receive the ROU asset as an asset-book record with its own amortization method, or (b) hold the ROU asset in the FA register as a distinct asset type with a link to the lease contract. Either way, ROU records need: lease_id, lease classification per book (GAAP finance/operating vs IFRS always finance-like), commencement date, term, ROU initial measurement components (liability, initial direct costs, prepaid rent, incentives), remeasurement events and impairment history. The asset-group membership flag matters because ROU assets enter ASC 360 tests together with owned PP&E. **[H]** for the accounting, product design is a recommendation.

### 2.11 Internal-use software and cloud computing arrangements (ASC 350-40, post-ASU 2025-06)
- **New capitalization threshold.** Capitalize when (1) management has authorized and committed to funding the project, and (2) it is **probable the project will be completed** and the software used for its intended function. Under the probable-to-complete assessment, an entity considers whether **significant development uncertainty** exists. Per FASB, indicators include novel, unique or unproven functions or features not yet resolved through coding and testing, and significant performance requirements not yet determined or being significantly revised. **[H]** for the structure, **[M]**/VERIFY for the exact indicator wording. ([Crowe](https://www.crowe.com/insights/take-into-account/fasb-revises-internal-use-software-cost-guidance); [BDO](https://arch.bdo.com/new-asu-on-internal-use-software-costs-guidance); [Deloitte Heads Up](https://dart.deloitte.com/USDART/home/publications/deloitte/heads-up/2025/fasb-asu-amends-software-costs-guidance))
- **Project stages removed** (preliminary, application-development and post-implementation). The FASB expects capitalized amounts to change little for most software. **[H]**
- **Website development (ASC 350-50) superseded** and folded into 350-40. **[H]**
- **Disclosure.** All capitalized internal-use software costs follow **Topic 360 PP&E disclosure requirements**, whatever their balance-sheet presentation. ASC 350-30 intangible disclosures are not required. Per Crowe, the final ASU adds no new disclosure requirements, only clarification. **[M]** The October 2024 exposure draft proposed separate cash-flow presentation of software costs; whether the final ASU kept it is **VERIFY**. ([RSM](https://rsmus.com/insights/financial-reporting/fasb-modernizes-accounting-internal-software-costs.html))
- **Effective date.** All entities, annual periods beginning after Dec 15, 2027, including interim periods. Early adoption permitted. Transition is prospective, modified (based on the status of in-process projects), or retrospective. **[H]**/[M]
- **Cloud computing arrangements (hosting = service contract).** Implementation costs are still capitalized under the 350-40 model (now the new threshold), amortized over the term of the hosting arrangement including reasonably certain renewals, **presented in the same balance-sheet line as prepaid hosting fees** (not PP&E), expensed in the same income-statement line as the hosting fees, and tested for impairment under ASC 360 as if long-lived assets. **[H]** ([EY Technical Line](https://www.ey.com/content/dam/ey-unified-site/ey-com/en-us/technical/accountinglink/documents/ey-tl29259-251us-12-11-2025.pdf))
- Product: support an `IUS_PROJECT` asset type with capitalization-gate evidence fields (authorization date, funding approval, uncertainty assessment, date uncertainty resolved), and a **CCA implementation-cost asset class whose GL mapping points to prepaid or other assets, not PP&E**. Store the ASU 2025-06 adoption date and transition method per tenant.

### 2.12 Business combinations and purchase price allocation (ASC 805)
- Acquired PP&E is measured at **acquisition-date fair value** (ASC 820), commonly by the cost approach (replacement or reproduction cost new less physical depreciation and functional/economic obsolescence), the market approach for vehicles and general equipment, or the income approach for specialized assets. **[H]**
- **No carryover of the seller's accumulated depreciation.** The acquired asset starts at fair value with zero accumulated depreciation and a new remaining useful life. Tax often keeps carryover basis (stock deals), or a step-up (asset deals, §338(h)(10)/§336(e)), which creates book-tax differences. **[H]**
- **Measurement-period adjustments** (up to one year) are recognized in the period identified, including the cumulative depreciation effect as if recorded at the acquisition date (ASU 2015-16). **[H]** The engine needs a "catch-up from acquisition date" computation posted in the current open period.
- **Asset acquisitions** (ASC 805-50) allocate cost by relative fair value with no goodwill. **[H]** **JV formations** (ASU 2023-05) apply new-basis fair value to contributed net assets, prospectively, for JVs formed on or after Jan 1, 2025. **[M]**/VERIFY
- Product: a `PPA_LOAD` bulk event that creates asset-book records (GAAP and IFRS at fair value, tax at carryover or stepped-up basis) with the valuation-report reference, plus `MEASUREMENT_PERIOD_ADJ` events.

### 2.13 Income taxes: deferred taxes from book-tax basis differences (ASC 740)
- Temporary difference = book carrying amount − tax basis, **per asset (or pool) per taxing jurisdiction**, multiplied by the enacted rate expected to apply when it reverses. **[H]**
- The FA system is usually the **single source of book and tax NBV**. A provision feed (to Bloomberg Tax Provision, ONESOURCE, Longview, Corptax or in-house tools) needs, per legal entity × jurisdiction × asset class (ideally per asset):
  - Book and tax cost, accumulated depreciation and NBV at the start and end of the period, with the current-period depreciation difference.
  - Disposals with book gain or loss versus tax gain or loss, including §1245/§1250 recapture character where available.
  - Book-only items: impairment, ARO/ARC, revaluation (IFRS), grant deferral, capitalized interest differences, ROU assets (book) versus tax lease deductions.
  - Bonus or §179 amounts and state decoupling adjustments by state.
  - Projected reversal schedules (future book depreciation versus future tax depreciation by year), for scheduling and valuation allowance analysis and for state apportionment or rate-change remeasurement.
  - PPA basis differences at acquisition (for the acquisition-accounting DTL).
  - The tax-only and book-only asset population, for completeness reconciliation.
- **ASU 2023-09** (rate reconciliation and disaggregated income taxes paid) is effective for PBEs for annual periods beginning after Dec 15, 2024 and for others one year later. It raises the bar for jurisdictional data quality. **[H]** ([KPMG](https://kpmg.com/us/en/frv/reference-library/2023/fasb-issues-asu-to-disaggregate-income-tax-disclosures.html))
- **The OBBBA** (enacted July 4, 2025) permanently restored **100% bonus depreciation** for property acquired after Jan 19, 2025. It added §168(n) **qualified production property** (100% for qualifying nonresidential real property; IRS Notice 2026-16 interim guidance, Feb 2026). Many states have not addressed §168(n) decoupling. **[H]**/[M] ([PwC](https://www.pwc.com/us/en/services/tax/library/pwc-ob3-provides-bonus-depreciation-qualified-production-property.html); [BDO](https://www.bdo.com/insights/tax/one-big-beautiful-bill-act-expands-100-depreciation-expensing-opportunities)) The book effect is a larger DTL and more temporary differences to track by state, and the enactment-date remeasurement already happened in Q3 2025.

### 2.14 Government and not-for-profit variants (brief)
- **GASB 34.** Capital assets reported at historical cost net of accumulated depreciation in government-wide statements. Infrastructure may use the **modified approach** (no depreciation if assets are kept at an assessed condition level). Fund statements expense capital outlays. **[H]** **GASB 42:** capital-asset impairment (significant, unexpected decline in service utility). **[H]** **GASB 89:** interest during construction is expensed, not capitalized. **[H]** **GASB 83:** AROs measured at current value (not discounted), offset by a *deferred outflow of resources* rather than an asset, and remeasured for inflation annually. **[H]**
- **GASB 87** (leases): the lessee records an intangible right-to-use lease asset amortized over the shorter of lease term and useful life. **GASB 96** (SBITAs): a subscription asset; capitalization thresholds are set locally (examples from $5k to $500k). **GASB 94:** PPPs/APAs. **[H]**
- **GASB 104** (Disclosure of Certain Capital Assets; issued Sept 2024): separate disclosure of **lease assets, SBITA assets, other intangible assets and capital assets held for sale** in the capital-asset note. Effective for fiscal years beginning after **June 15, 2025** (FY2026 for June year-ends). Disclosure only. **[H]** ([Deloitte](https://dart.deloitte.com/USDART/home/news/all-news/2024/oct/gasb-disclosing-capital-assets); [BDO](https://bdo.com/insights/industries/government-public-sector/gasb-104-disclosure-of-certain-capital-assets))
- **NFPs (ASC 958-360).** Depreciation is required. Contributed PP&E is recorded at fair value. Donor restrictions on long-lived assets, and their release when placed in service, must be tracked. Collections may stay uncapitalized under a policy election. **[H]**
- **Federal agencies:** FASAB SFFAS 6/10 (general PP&E, internal-use software). Out of scope beyond noting a separate book type. **[M]**

---

## 3. Standards by topic: IFRS

### 3.1 IAS 16 Property, Plant and Equipment
- **Component approach is mandatory.** Each part with a cost significant relative to the total is depreciated separately (IAS 16.43). Replaced parts are derecognized. Major inspections are capitalized as a component and the prior inspection component is derecognized. **[H]**
- **Cost model or revaluation model, chosen by class** (16.29). Revaluations must be regular enough that carrying amount does not differ materially from fair value, and an entire class is revalued (16.31, 16.36). Increases go to **OCI (revaluation surplus)** unless they reverse a prior P&L decrease. Decreases go to P&L after any surplus for that asset is used up. The surplus may be transferred to retained earnings as the asset is used (the excess-depreciation transfer) or on derecognition. It is never recycled through P&L. Accumulated depreciation at revaluation is either restated proportionately or eliminated against gross carrying amount (16.35). **[H]**
- **Residual value, useful life and method are reviewed at least each financial year end** (16.51, 16.61). Changes are estimates under IAS 8 (prospective). **Revenue-based depreciation is presumptively inappropriate** (16.62A). **[H]**
- **Proceeds before intended use** (2022 amendment): sales proceeds and related costs go to P&L, not deducted from cost. **[H]**
- Disclosure: reconciliation of carrying amount by class (16.73), including additions, disposals, HFS, business combinations, revaluations, impairments and reversals, depreciation and FX. **[H]**

### 3.2 IAS 36 Impairment of Assets
- **Assess indicators at each reporting date** (36.9). Test goodwill, indefinite-life intangibles and intangibles not yet available for use annually. **[H]**
- **One-step test.** Carrying amount versus **recoverable amount** = higher of fair value less costs of disposal and **value in use** (discounted, pre-tax rate) (36.18, 36.55). Assets are tested individually or within a **CGU**, the smallest identifiable group generating largely independent cash *inflows* (36.66). Corporate assets are allocated to CGUs. **[H]**
- **Reversals** are required when indicators show the impairment has decreased, **except for goodwill**. They are capped at the carrying amount that would have resulted (net of depreciation) had no impairment been recognized (36.117). For revalued assets, a reversal is treated as a revaluation increase. **[H]**
- **IASB project status.** The Exposure Draft *Business Combinations—Disclosures, Goodwill and Impairment* (Mar 2024) proposes IAS 36 changes (goodwill allocation to CGUs, VIU simplifications). The IASB was still redeliberating at its **July and Sept 2026** meetings, so nothing is final. **[M]** ([IASB project page](https://www.ifrs.org/content/ifrs/home/projects/work-plan/goodwill-and-impairment.html); [IASB AP18 Jul 2026](https://www.ifrs.org/content/dam/ifrs/meetings/2026/july/iasb/ap18-cover-paper.pdf))

### 3.3 IFRS 16 Leases (lessee)
- A **single lessee model**: all leases (except short-term ≤12 months and low-value, both optional exemptions) produce an ROU asset depreciated under IAS 16 (usually straight-line) and a liability with interest. There is no operating-lease straight-line cost. **[H]**
- ROU impairment under IAS 36. ROU assets may be revalued if they relate to a revalued PP&E class (16.35). ROU assets meeting the investment property definition follow IAS 40's fair value model if that model is applied (16.34). **[H]**
- Sale-and-leaseback lease-liability amendment effective 2024. **[H]**
- **Multi-book impact.** One lease can be operating for the GAAP book (straight-line cost, ROU plug amortization) and IFRS 16 (depreciation plus interest) in the IFRS book. Different ROU balances arise from the same contract, so ROU is a per-book asset-book record.

### 3.4 IAS 40 Investment Property
- A policy choice between the **fair value model** (no depreciation; FV changes in P&L) and the **cost model** (IAS 16 cost, with FV disclosed). Transfers in and out happen on evidence of a change in use. **[H]** US GAAP has no equivalent: investment property is PP&E at cost, except for investment companies. The FA system needs a "no depreciation, FV remeasurement" method for IFRS books.

### 3.5 IFRS 5 Non-current Assets Held for Sale
- Criteria: available for immediate sale in present condition and **highly probable** (committed plan, active program, marketed at a reasonable price, expected within 12 months, unlikely to be withdrawn). The criteria are close to GAAP's but not identical. **[H]**
- Measure at the lower of carrying amount and FV less costs to sell. **No depreciation.** Gains are limited to cumulative impairment previously recognized (under IFRS 5 or IAS 36). Present separately. **[H]**

### 3.6 Decommissioning (IAS 37 / IAS 16 / IFRIC 1)
- Measure at the best estimate, discounted at a **pre-tax rate reflecting current market time value and liability-specific risks**. Under the *cost model*, IFRIC 1 adds or deducts changes from estimated cash flows **and from discount rate changes** to the asset each period. The whole liability is remeasured at the current rate, with **no layering**. Unwinding of discount is a **finance cost**. **[H]**
- **IAS 37 Targeted Improvements** (ED Nov 2024): tentative decision to discount at a risk-free rate without non-performance risk adjustment. **Still in redeliberations per the Sept 2026 IASB agenda paper. Not final.** **[M]** ([IASB AP22 Sept 2026](https://www.ifrs.org/content/dam/ifrs/meetings/2026/september/iasb/ap22-cover-paper.pdf))

### 3.7 IAS 20 Government Grants and IAS 23 Borrowing Costs
- **IAS 20.** Recognize when there is **reasonable assurance** of compliance and receipt. Grants related to assets are presented either as **deferred income** (recognized in P&L over useful life) or as a **deduction from the asset's carrying amount** (24–27). Repayment is a change in estimate. **[H]** ASU 2025-10's US model is now broadly convergent: cost accumulation corresponds to "deduct from asset", but the US recognition threshold is "probable" rather than "reasonable assurance". **[M]** ([BDO GAAP/IFRS comparison](https://www.bdo.com/insights/assurance/bdos-us-gaap-and-ifrs-comparison-series-government-grants))
- **IAS 23.** Capitalizing borrowing costs on qualifying assets is **mandatory**. For specific borrowings, actual costs **less investment income on temporary investment** of those funds are capitalized. General borrowings use a capitalization rate. Capitalization ceases when the asset is substantially ready. **[H]**

### 3.8 IFRS 18 Presentation and Disclosure (effective Jan 1, 2027)
- An entity presenting operating expenses by function must disclose, in a single note, the amounts of **depreciation, amortization, employee benefits, impairment losses and reversals, and inventory write-downs** included in each function line item. Retrospective application. **[H]**/[M] ([BDO Australia](https://www.bdo.com.au/en-au/blogs/corporate-reporting/more-disclosure-when-presenting-operating-expenses-by-function-under-ifrs-18); [Forvis Mazars](https://www.forvismazars.com/uk/en/insights/financial-and-corporate-reporting-updates/ifrs-18-the-devil-is-in-the-detail-again)) Practical issue: depreciation that is first capitalized into inventory or other assets and later expensed through cost of sales has to be traced. The FA system can report depreciation by "first destination" but needs a flag for amounts capitalized into inventory or CIP.

### 3.9 Other IFRS points
- **SaaS configuration and customization** (IFRIC agenda decision, Apr 2021): generally expensed unless the costs create a separately controlled intangible asset. This is stricter than US GAAP CCA capitalization. **[H]**
- **IFRS 3** PPA: fair value, broadly as under GAAP, with different measurement-period mechanics in practice. **IAS 12** deferred taxes: similar balance-sheet approach, with an initial-recognition exemption (narrowed by the 2021 amendment for leases and decommissioning). **[H]**

---

## 4. GAAP vs IFRS: key differences for a fixed-asset system

| Topic | US GAAP | IFRS | Product consequence |
|---|---|---|---|
| Measurement after recognition | Historical cost only | Cost or **revaluation** by class (IAS 16); FV model for investment property (IAS 40) | IFRS book needs revaluation events, a surplus sub-ledger and an excess-depreciation transfer |
| Componentization | Permitted, not required | **Required** for significant parts | IFRS book needs its own component tree; GAAP may be a single asset |
| Review of life, residual and method | When events indicate | **At least every year end** | Annual review workflow with attestations for IFRS books |
| Method change | Estimate effected by principle change; preferability | Change in estimate (IAS 8) | Different approval requirements |
| Revenue-based depreciation | Not addressed specifically | Presumption against (16.62A) | Validation rule per framework |
| Impairment indicators | Event-driven | Assessed **every reporting date** | Period-close checklist item for IFRS books |
| Impairment unit | Asset group (independent cash *flows*) | CGU (independent cash *inflows*) | Separate grouping tables per book |
| Impairment test | Two-step: undiscounted recoverability, then FV | One-step: recoverable amount (higher of FVLCOD and VIU) | Different calc paths; IFRS impairs earlier/more often |
| Reversal of impairment | **Prohibited** (held and used) | **Required** if indicators (not goodwill), capped | IFRS book must keep "would-have-been" carrying amount |
| Held for sale | 6 criteria; lower of CA/FVLCTS; no depreciation | Similar; "highly probable" | Similar event; per-book flags |
| Borrowing costs | Capitalize avoidable interest; generally no investment income offset (VERIFY) | Mandatory; **net of investment income** on specific borrowings | Separate cap-interest calc per book |
| ARO / decommissioning rate | CARFR; layers; downward revisions at original rate; accretion = operating expense | Current pre-tax rate; whole liability remeasured each period; unwinding = finance cost | Layered vs single-measure provision models per book |
| Government grants (assets) | ASU 2025-10 (eff. 2029 PBE): cost accumulation or deferred income; "probable" | IAS 20: deduct from asset or deferred income; "reasonable assurance" | Policy election per book; may differ until adoption |
| Lessee accounting | Finance vs operating (straight-line cost) | Single model (depreciation + interest) | Same contract, different ROU balances per book |
| ROU after impairment | Operating ROU → straight-line amortization | IAS 36; depreciation continues on reduced base | Different post-impairment schedules |
| Internal-use software | ASC 350-40 (probable-to-complete, ASU 2025-06), Topic 360 disclosures | IAS 38 (development-phase criteria) | Separate capitalization gates per book |
| SaaS implementation | Capitalize qualifying costs (prepaid-type asset) | Generally expense (IFRIC 2021) | IFRS book often has no asset |
| Planned major maintenance | Expense, built-in overhaul or deferral; no accrual | Component approach (inspection as component) | Component tree differences |
| Expense disaggregation | ASU 2024-03 (PBE, FY starting after Dec 15, 2026) | IFRS 18 (Jan 1, 2027) | One "expense caption" mapping serving both |

---

## 5. Reports and disclosures

### 5.1 Required disclosures the system must source
- **ASC 360-10-50-1:** depreciation expense for the period; balances of major classes of depreciable assets by nature or function; accumulated depreciation by major class or in total; a general description of methods. **[H]**
- **ASC 360-10-50-2/50-3:** impairment (description, facts, amount, caption, method of determining FV, segment) and HFS or disposals (facts, expected manner and timing, gain or loss, caption, segment). **[H]**
- **ASC 835-20-50-1:** total interest incurred and amount capitalized. **[H]**
- **ASC 410-20-50-1:** ARO description and reconciliation (incurred, settled, accretion, revisions). **[H]**
- **ASC 842-20-50:** ROU and lease cost components, weighted-average terms and rates, and maturity analysis. Usually from the lease subledger, but ROU balances must agree. **[H]**
- **ASU 2025-06:** Topic 360 disclosures for capitalized internal-use software. **ASU 2025-10:** grant policy election and affected line items (cost accumulation). **ASU 2024-03:** depreciation within each relevant expense caption. **[H]/[M]**
- **SEC Regulation S-X:** Rule 5-02 PP&E and accumulated depreciation on the balance sheet. **Schedule III** (Rule 12-28, real estate and accumulated depreciation) for real-estate registrants. **[H]**
- **IFRS:** IAS 16.73–79 reconciliation by class; IAS 36.126–137 (impairment and reversal by class, CGU descriptions, key assumptions); IFRS 16.53; IAS 40.76/79; IAS 20.39; IAS 23.26; IFRS 18 specified-expense note. **[H]**
- **GASB 34/104:** capital-asset note with beginning balance, increases, decreases and ending balance by major class; separate lines for lease, SBITA, intangible and HFS assets. **[H]**

### 5.2 Standard report catalog (minimum viable for SOX customers)
1. **Asset rollforward**, per book × entity × class: beginning cost, additions, CIP transfers, acquisitions (PPA), disposals, transfers, impairments, revaluations (IFRS), FX, ending cost. Accumulated depreciation is rolled forward in parallel. **It must tie to the GL by account.**
2. **CIP rollforward and aging**: beginning, spend, capitalized interest, transfers to in-service, write-offs, ending. Aging flags stale CIP (a common audit finding about late placed-in-service dates).
3. **Depreciation expense by GL account, cost center, segment and expense caption** (DISE / IFRS 18), with **"capitalized into inventory or CIP" flags**.
4. **Additions and disposals detail**, with approvals, documents, gain or loss, proceeds and the governing guidance (610-20/606/845).
5. **Impairment-testing support pack**: asset-group or CGU listing, carrying amounts (including ROU and working-capital adjuncts where policy includes them), primary asset and remaining life, inputs to undiscounted cash flows (uploaded from FP&A), fair value or recoverable amount, allocation workpaper, and the 35-28 floor check.
6. **HFS and disposal-group schedule**, with the "shadow depreciation" amount for potential reclassification.
7. **ARO rollforward by layer**; **capitalized interest computation** (AWAE, rates, cap test).
8. **Depreciation projection** (5+ years, by book). Used for budgeting and for ASC 740 reversal scheduling.
9. **Book-tax difference report** by jurisdiction (the provision feed).
10. **IFRS revaluation surplus rollforward** and the impairment-reversal-ceiling report.
11. **Lease ROU reconciliation** to the lease subledger.
12. **Physical inventory reconciliation**: tagged or scanned versus register, with exceptions (found, not found, location mismatch).
13. **Audit-trail and change reports**: transaction log, master-data changes (life, method, salvage, GL mapping), rule-content version changes, user access changes, period reopen log.
14. **Subledger-to-GL reconciliation**: per account per period, with unreconciled differences and a sign-off.

---

## 6. Controls: SOX/ICFR, ITGCs and SOC 1

### 6.1 Framework
SOX 404 management assessment uses the COSO 2013 framework. Auditors of accelerated filers integrate the ICFR audit under **PCAOB AS 2201**. **[H]** Fixed-asset assertions: **existence** (assets are real and in use), **completeness** (all capital spend captured, CIP placed in service on time), **valuation** (cost, depreciation, impairment, ARO), **rights**, and **presentation** (classes, HFS, DISE captions). **[H]**

### 6.2 Typical key controls the product must enable

| Risk | Control | Type | Product feature |
|---|---|---|---|
| Unauthorized or incorrect additions | Capex/AFE approval before capitalization; review of additions above a threshold | Manual + workflow | Maker-checker approval workflow, attachments, approval thresholds by role |
| Capital vs expense misclassification | Capitalization-policy check; under-threshold register review | Automated + manual | Threshold rules per class and entity; exceptions report |
| CIP not placed in service timely | Monthly CIP aging review | Manual | CIP aging report; alerts; placed-in-service workflow |
| Wrong life, method or salvage | Asset-class templates; review of overrides | Automated config + manual review | Locked templates; override reason codes; override report |
| Depreciation calc error | Automated calc (tested once in a baseline, then change-managed); monthly analytic review | Automated | Deterministic engine; version stamp on every run; variance analytics |
| Estimate changes not approved | Approval of life/salvage/method changes; preferability documentation | Manual | `CHANGE_ESTIMATE` event requires approval and memo |
| Impairment indicators missed | Quarterly indicator checklist; impairment test review | Manual | Indicator questionnaire per asset group, evidence capture |
| Disposals unrecorded | Disposal approval; physical verification; tie-out to proceeds | Manual | Disposal workflow; physical inventory module |
| Subledger ≠ GL | Monthly reconciliation of FA subledger to GL with sign-off | Manual + automated | Auto-recon report, variance thresholds, sign-off capture |
| Posting to closed periods | Period lock | Automated (application control) | Per (entity, book, period) lock; reopen needs dual approval |
| Unreliable reports (IPE) | Completeness and accuracy checks on reports used in controls | Manual + automated | Report parameters and row counts and hash totals printed on output; reproducible as-of runs |

### 6.3 IT general controls (ITGCs) for the platform and for customers
- **Logical access.** SSO/SAML plus MFA; role-based access with **segregation of duties** (e.g., a user who creates assets cannot approve them or close the period; administrators cannot post transactions); periodic access recertification exports; privileged-access logging; tenant isolation. **[H]**
- **Change management.** Code and **rule-content** changes (methods, conventions, tax tables in Databricks) go through ticketed change, peer review, testing (regression suites with golden results) and segregated deployment. Every calc result is stamped with the code version and rule-set version. **[H]** for the principle. Treating effective-dated rule data as "configuration under change control" is the recommendation.
- **Computer operations.** Monitoring and failure alerts for scheduled depreciation and close jobs; idempotent re-runs; backups and restore tests; DR with RPO/RTO. **[H]**
- **Data integrity.** Immutable event log; append-only corrections; hash chain or ledger checksums per close snapshot. Databricks Delta time travel is **not** an audit-retention mechanism, because VACUUM and log retention defaults are days or weeks. Materialize period-end snapshots as immutable tables and keep them for the customer's retention period (typically 7+ years). **[M]**, VERIFY current Delta retention defaults.
- **PCAOB AS 1105/AS 2301 amendments** (technology-assisted analysis), effective for audits of fiscal years beginning on or after **Dec 15, 2025**: auditors must evaluate the reliability of company-provided electronic information and investigate items flagged by their analytics. Expect auditors to request full-population extracts with reproducibility evidence. **[H]** ([PCAOB](https://pcaobus.org/oversight/standards/implementation-resources-PCAOB-standards-rules/amendments-related-to-aspects-of-designing-and-performing-audit-procedures-that-involve-technology-assisted-analysis-of-information-in-electronic-form); [Deloitte](https://dart.deloitte.com/USDART/home/news/all-news/2024/aug/sec-approves-pcaob-standards))

### 6.4 SOC 1 Type II (customer auditor reliance)
- SOC 1 examinations are performed under **AT-C 320** (SSAE 18 as amended). A **Type II** report covers design *and operating effectiveness* over a period (typically 12 months, ending at or near most customers' fiscal year-end). User auditors evaluate it under AU-C 402 / PCAOB AS 2601. **[H]**
- **Suggested control objectives** for this SaaS: (1) logical access to the application and data; (2) change management for application code **and for regulatory rule content**; (3) completeness and accuracy of calculations (depreciation, impairment allocations, ARO accretion, gain/loss); (4) data input validation and interface processing (ERP feeds in, journal exports out); (5) job scheduling and processing; (6) data backup and recovery; (7) period-close and lock enforcement; (8) tenant segregation. **[M]**, a recommendation consistent with common FA/ERP SOC 1 scopes.
- **Complementary user entity controls (CUECs)** must be listed. Examples: customers approve additions and disposals; review depreciation and estimate changes; reconcile the subledger to the GL; administer their own user roles and recertify access; review rule overrides; confirm that journal exports were posted completely in the ERP. **[H]**
- **Subservice organizations** (Databricks, the cloud provider, the identity provider) are usually handled by the **carve-out method** with **complementary subservice organization controls (CSOCs)** and their own SOC reports. **[H]** ([Compass IT](https://www.compassitc.com/blog/subservice-organizations-in-soc-reports-carve-out-vs.-inclusive-method))
- **Bridge letters** cover the gap between the report period end and the customer's year-end. They are management representations, not CPA opinions. **[H]**
- Plan a SOC 2 Type II (security/availability/confidentiality) as well. Enterprise buyers ask for both. **[H]**

### 6.5 Physical verification and tagging
Existence controls need periodic counts (annual full count or rotating cycle counts), barcode or RFID tags, a mobile scan app, location/custodian master data, and an exception workflow (not-found → investigate → retire/write-off with approval; found-not-on-register → add). **[H]** Results feed the existence assertion and the abandonment/disposal events.

### 6.6 Journal-entry generation to the ERP GL
- The FA subledger generates journals for: additions (Dr asset / Cr AP clearing or CIP), CIP transfers, depreciation (Dr expense by cost center / Cr accumulated depreciation), impairment, disposals (proceeds, cost and accumulated depreciation removal, gain/loss), ARO accretion, revaluation (Dr asset / Cr OCI surplus), grant amortization, capitalized interest (Dr CIP / Cr interest expense), and reclassifications. **[H]**
- **Requirements:** balanced by entity, book and currency; account derivation through effective-dated posting rules; summarization levels (detail vs summary by account/cost center); **idempotent export with batch IDs**; reversal-not-delete; ERP acknowledgments (posted, rejected) fed back; reconciliation of exported versus posted totals. **[H]** for the principles.
- **Multi-GAAP ledgers:** the GAAP book posts to the primary ledger. The IFRS book posts either to a secondary/parallel ledger (SAP parallel ledgers, Oracle secondary ledgers) or as **adjustment-only deltas** (IFRS − GAAP) to an adjustment ledger. Tax books are generally **memo, not posted**. **[H]** for ERP patterns, **[M]** for prevalence.
- **Foreign currency:** under ASC 830/IAS 21 remeasurement into functional currency, PP&E and depreciation are nonmonetary and use **historical rates**. Translation into the reporting currency uses the current rate for the balance sheet and the average rate for depreciation, with a CTA. The FA system must store functional-currency amounts and the historical rate per layer, and produce an FX line in the rollforward. **[H]**

---

## 7. Implications for the product

### 7.1 Book-definition model
```
Book
  book_id, tenant_id, legal_entity_id
  book_type: GAAP_PRIMARY | IFRS | LOCAL_STATUTORY | MGMT | FED_TAX | AMT | ACE | E&P | STATE:<code> | LOCAL_PROPERTY_TAX | GASB_GOVWIDE | NFP
  framework: US_GAAP | IFRS | LOCAL_GAAP:<code> | IRC | STATE | GASB | FASAB
  posting_mode: GL_PRIMARY | GL_SECONDARY | GL_DELTA_TO:<book_id> | MEMO
  functional_currency, reporting_currency
  fiscal_calendar_id (4-4-5, 52/53 week, calendar)
  default_convention, rounding_policy (per asset / per period / plug-to-last-period)
  derive_from_book_id + derivation_policy (which events auto-propagate, which need per-book input)
  policy_elections (effective-dated): e.g. ASU_2025_06 {adopted_on, transition}, ASU_2025_10 {approach: COST_ACCUM|DEFERRED_INCOME},
       IAS16_class_model {class -> COST|REVALUATION}, IAS40 {FV|COST}, ROU_in_FA {true/false}, componentization {required|optional}
  rule_set_version_pin (Databricks rule-content release) + effective_from
  gl_mapping_set_id (effective-dated)
```
Store "standard adoption" as effective-dated data per tenant per book (adoption date and transition method). The calc engine then branches on *policy as of the transaction date*, not on code paths per customer.

### 7.2 Per-book asset attributes (asset-book record)
Asset master (shared): asset_id, description, class/category, tag, serial, location, custodian, vendor, PO/invoice refs, parent/component links, legal entity, acquisition date, placed-in-service date, project/CIP link, lease_id, grant_id, ARO links.

Asset-book (per book): `in_service_date_override`, `cost_basis` (by component: purchase, capitalized interest, ARC, grant reduction, PPA FV adjustment), `salvage`, `method`, `life_months` / `total_units`, `convention`, `depreciation_start_date`, `status` (CIP, IN_SERVICE, IDLE, HFS, ABANDONED, DISPOSED, FULLY_DEPRECIATED), `accumulated_depreciation`, `accumulated_impairment`, `impairment_reversal_ceiling_shadow` (IFRS), `revaluation_surplus` (IFRS), `last_revaluation_date`, `asset_group_id` / `cgu_id`, `hfs_shadow_carrying_amount`, `expense_caption_map` (DISE/IFRS 18), `cost_center_allocation` (split %), `fx_historical_rate`, plus tax-only fields (bonus %, §179, recovery period, MACRS class) owned by the tax-book researchers. **Component trees are per book**: IFRS may hold three components where GAAP holds one asset.

### 7.3 Event types the engine must support (book side)

| Event | GAAP | IFRS | Notes |
|---|---|---|---|
| `ADD` / `ACQUIRE` | ✓ | ✓ | Cost elements itemized |
| `CIP_COST`, `CIP_PLACE_IN_SERVICE`, `CIP_WRITE_OFF` | ✓ | ✓ | Drives AWAE for capitalized interest |
| `CAPITALIZE_INTEREST` | ASC 835-20 | IAS 23 (net investment income) | Calc differs per book |
| `ADJUST_COST` (true-up, rebate) | ✓ | ✓ | |
| `DEPRECIATE` (system) | ✓ | ✓ | Period run; version-stamped |
| `CHANGE_ESTIMATE` (life, salvage, units, method) | Prospective; preferability for method | Prospective (IAS 8) | Approval required |
| `IMPAIR` | Two-step, group allocation, new basis | IAS 36 one-step, CGU | |
| `IMPAIR_REVERSE` | ✗ (only HFS gains) | ✓ capped | |
| `REVALUE`, `REVAL_SURPLUS_TRANSFER` | ✗ | ✓ | Proportionate vs elimination method |
| `FV_REMEASURE` (investment property) | ✗ | IAS 40 FV model | |
| `CLASSIFY_HFS`, `HFS_REMEASURE`, `RECLASSIFY_FROM_HFS` | ✓ (shadow depreciation) | ✓ | Stop/restart depreciation |
| `IDLE`, `RESUME`, `ABANDON` | ✓ | ✓ | |
| `DISPOSE_SALE`, `RETIRE_SCRAP`, `PARTIAL_DISPOSE`, `REPLACE_COMPONENT` | 610-20/606 | IAS 16.67 | Group/composite: no gain/loss |
| `EXCHANGE` | ASC 845/610-20 | IAS 16.24 | Commercial-substance flag |
| `TRANSFER` (entity, cost center, location, GL) | ✓ | ✓ | Intercompany needs both sides |
| `SPLIT`, `MERGE` | ✓ | ✓ | Preserve lineage |
| `ARO_INITIAL`, `ARO_ACCRETE`, `ARO_REVISE_UP` (new layer at current rate), `ARO_REVISE_DOWN` (original rate), `ARO_SETTLE` | ASC 410-20 | IAS 37/IFRIC 1 (single remeasure, rate change) | Per-book liability model |
| `GRANT_APPLY` (cost accumulation), `GRANT_DEFER`, `GRANT_AMORTIZE`, `GRANT_REPAY` | ASC 832 (post-ASU 2025-10) | IAS 20 | Policy per book |
| `LEASE_COMMENCE`, `LEASE_REMEASURE`, `LEASE_MODIFY`, `LEASE_TERMINATE`, `ROU_IMPAIR` | ASC 842 (finance/operating) | IFRS 16 | Probably fed from the lease subledger |
| `PPA_LOAD`, `MEASUREMENT_PERIOD_ADJ` | ASC 805 | IFRS 3 | Catch-up from acquisition date |
| `IUS_CAPITALIZATION_GATE` | ASU 2025-06 | IAS 38 criteria | Evidence fields |
| `FX_REMEASURE` / `FX_TRANSLATE` | ASC 830 | IAS 21 | |
| `PHYSICAL_COUNT_EXCEPTION` | ✓ | ✓ | Triggers investigate/retire |
| `ERROR_CORRECTION` (restate vs out-of-period) | ASC 250 | IAS 8 | Never mutates locked snapshots |

### 7.4 Period-close and lock model
- Period state per (tenant, legal entity, book, fiscal period): `OPEN → PRE_CLOSE (depreciation run, review) → CLOSED (locked) → REOPENED (exception)`. **[Recommendation]**
- On close: freeze an immutable **period snapshot** (balances per asset-book, rollforward, JE batch IDs, code and rule versions, hash). Reports for closed periods read the snapshot, so they reproduce exactly (an IPE requirement).
- Back-dated events (e.g., an in-service date in a closed period) are accepted with `effective_date` in the past and `posting_period` = the current open period. The engine computes a **catch-up** and posts it in the open period. Locked balances stay unchanged. Report both the "as originally reported" and "as-of current knowledge" views.
- Reopen requires dual approval, a reason code and an automatic audit-log entry. Re-close generates **delta JEs**, never replacement JEs.
- Close can be per book: tax books may stay open until the return is filed (return-to-provision true-ups) while the GAAP book is locked.

### 7.5 GL journal model
```
PostingRule (effective-dated): book_type × event_type × asset_class × (component) → debit/credit account templates, segment derivation (entity, cost center, project, intercompany), summarization level
JournalBatch: batch_id (idempotency key), entity, book, period, status (DRAFT/APPROVED/EXPORTED/POSTED/REJECTED), erp_doc_ref, totals hash
JournalLine: account, segments, dr/cr amount in transaction/functional/reporting currencies, source event_ids[], expense_caption (DISE / IFRS 18)
```
Keep the `expense_caption` dimension on every depreciation line. Then ASU 2024-03 and IFRS 18 tables come straight from the subledger, not from spreadsheets.

### 7.6 Test cases (golden results)

| # | Scenario | Expected result |
|---|---|---|
| 1 | SL: cost 100,000, salvage 10,000, 5 yrs, in service Jan 1, monthly | 1,500/month; 18,000/yr |
| 2 | DDB with SL switch, same asset | Y1 40,000; Y2 24,000; Y3 14,400; Y4 8,640; Y5 2,960 (salvage floor); total 90,000 |
| 3 | SYD, same asset | 30,000 / 24,000 / 18,000 / 12,000 / 6,000 |
| 4 | UOP: cost 500,000, salvage 50,000, 1,000,000 units; 30,000 used | 0.45/unit → 13,500 |
| 5 | Change in estimate: 120,000, 10-yr SL from Jan 1, 2024; on Jan 1, 2026 total life revised to 6 yrs | NBV 96,000 / 4 remaining = 24,000/yr; **no catch-up** |
| 6 | GAAP impairment: group CA 1,000,000 (A 600k, B 400k), undiscounted CF 900k, FV 700k, B's FV 300k | Loss 300k; pro rata A 180k / B 120k → B floored at 100k; A takes 200k; new bases A 400k, B 300k; no reversal later |
| 7 | Same facts, recoverable (undiscounted 1.1m) | **No loss** under GAAP even though FV is 700k; under IFRS, recoverable amount < CA gives a loss |
| 8 | HFS: CA 250,000; FV 220,000; cost to sell 10,000 | Loss 40,000; depreciation stops; later FVLCTS 235,000 → gain 25,000; later 260,000 → further gain 15,000 only (cap 40k) |
| 9 | Capitalized interest: AWAE 2,000,000; specific debt 1,000,000 @6%; other debt 5% | 60,000 + 50,000 = 110,000, capped at total interest incurred |
| 10 | ARO: 1,000,000 due in 10 yrs, CARFR 6% | Initial 558,395; Y1 accretion 33,504; ARC depreciated over 10 yrs |
| 11 | ARO upward revision in Y3: +200,000 due in 8 yrs at current 7% | New layer 116,402 accreting at 7%; downward revisions use the layer's original rate |
| 12 | IFRS decommissioning, same facts, rate drops to 5% | Whole provision remeasured at 5%; change adjusts asset (IFRIC 1); unwinding in finance cost |
| 13 | Operating lease ROU impairment: ROU 900k, liability 1,000k, impairment 300k, 5 yrs left | ROU 600k amortized 120k/yr SL plus liability interest; lease cost no longer straight-line |
| 14 | Same lease under IFRS 16 | ROU depreciated SL plus interest from commencement; different ROU balance from GAAP |
| 15 | IFRS revaluation: cost 1,000k, AD 200k, FV 1,000k, 8 yrs remaining | Surplus 200k (OCI); depreciation 125k/yr; optional transfer 25k/yr to retained earnings |
| 16 | IAS 36 reversal: impairment 100k at end of Y2 on a 10-yr 1,000k asset; at end of Y4 recoverable amount is 700k | Ceiling = 600k (no-impairment CA); CA after impairment path = 800k − 100k − 2×87.5k = 525k → reversal 75k (to 600k cap) |
| 17 | Asset grant: asset 1,000k, grant 300k, 10 yrs | Cost accumulation: depreciation 70k/yr. Deferred income: depreciation 100k plus grant income 30k/yr |
| 18 | Mid-year disposal, mid-month convention, proceeds 30k, NBV 25k | Depreciation through disposal per convention; gain 5k; cost and AD removed |
| 19 | Back-dated addition (in-service date in a locked period) | Catch-up depreciation posted in the current open period; locked snapshot unchanged; audit log entry |
| 20 | PPA: acquired equipment FV 500k, seller cost 900k / AD 600k, stock deal | GAAP cost 500k, AD 0; tax NBV 300k carryover; temporary difference 200k → DTL at enacted rate |
| 21 | Nonmonetary exchange, commercial substance: give CA 40k (FV 50k) plus 10k cash | New asset 60k; gain 10k; boot 10k/60k < 25% → nonmonetary |
| 22 | IFRS component replacement: aircraft 50m (engine 10m/8 yrs, airframe 40m/25 yrs); engine replaced in Y5 | Derecognize old engine NBV 3.75m as loss; capitalize new engine |
| 23 | Book-tax: GAAP NBV 800k, federal tax NBV 0 (100% bonus), state decoupled with tax NBV 640k | Federal TD 800k; state TD 160k; each at its own rate |
| 24 | DISE: depreciation 1,000k split cost of sales 700k / SG&A 200k / R&D 100k; 50k capitalized into inventory | Caption table ties to total; capitalized amount flagged |
| 25 | Period reopen | Requires two approvers; delta JE batch; original batch untouched |

---

## 8. Sources

**FASB / US GAAP (secondary summaries of primary ASUs)**
- ASU 2025-06 (internal-use software): [Crowe](https://www.crowe.com/insights/take-into-account/fasb-revises-internal-use-software-cost-guidance); [BDO](https://arch.bdo.com/new-asu-on-internal-use-software-costs-guidance); [RSM](https://rsmus.com/insights/financial-reporting/fasb-modernizes-accounting-internal-software-costs.html); [Deloitte Heads Up](https://dart.deloitte.com/USDART/home/publications/deloitte/heads-up/2025/fasb-asu-amends-software-costs-guidance); [KPMG Defining Issues](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2025/fasb-asu-software-cost-accounting.pdf); [KPMG Handbook 2026](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2026/us-dpp-book-software-website-costs-frv.pdf); [EY Technical Line](https://www.ey.com/content/dam/ey-unified-site/ey-com/en-us/technical/accountinglink/documents/ey-tl29259-251us-12-11-2025.pdf)
- ASU 2025-10 (government grants): [Deloitte Heads Up](https://dart.deloitte.com/USDART/home/publications/deloitte/heads-up/2025/asc-832-fasb-guidance-accounting-for-government-grants); [KPMG](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2025/FN_DI25_10_FASB_Issues_Government_Grants%20FRV.pdf); [Journal of Accountancy](https://www.journalofaccountancy.com/news/2025/dec/fasb-publishes-guidance-on-accounting-for-government-grants); [BDO GAAP/IFRS comparison](https://www.bdo.com/insights/assurance/bdos-us-gaap-and-ifrs-comparison-series-government-grants); [BDO](https://arch.bdo.com/new-government-grant-accounting-for-businesses); [Stout](https://www.stout.com/en/insights/commentary/asu-2025-10-government-grants)
- ASU 2024-03 / 2025-01 (DISE): [Deloitte](https://dart.deloitte.com/USDART/home/news/all-news/2025/jan/fasb-effective-date-asu-disaggregation-income-statement)
- ASU 2026-01/2026-02 and 2026 activity: [Deloitte Key Dates](https://dart.deloitte.com/USDART/home/publications/deloitte/key-dates/key-dates); [KPMG on ASU 2026-02](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2026/FN_DI26_02_FASB_Issues_ECP%20-%20FRV.pdf); [BDO on ASC 818](https://arch.bdo.com/environmental-credit-guidance-established-under-asc-818); [Forvis Mazars Q2 2026](https://www.forvismazars.us/forsights/2026/07/quarterly-financial-reporting-update-q2-2026); [KPMG ASU effective dates 2026](https://kpmg.com/kpmg-us/content/dam/kpmg/frv/pdf/2026/asu-effective-dates.pdf); [FASB 1Q 2026 Chair Report](https://storage.fasb.org/1Q%202026%20Chair%20Report.pdf)
- ASC 360 impairment: [Deloitte Roadmap 2.4](https://dart.deloitte.com/USDART/home/codification/presentation/asc205-20/roadmap-disposals-long-lived-assets-discontinued-operations/chapter-2-long-lived-assets-classified/2-4-testing-long-lived-assets); [2.5](https://dart.deloitte.com/USDART/home/codification/presentation/asc205-20/roadmap-disposals-long-lived-assets-discontinued-operations/chapter-2-long-lived-assets-classified/2-5-measurement-an-impairment-loss); [1.3 scope](https://dart.deloitte.com/USDART/home/codification/presentation/asc205-20/roadmap-disposals-long-lived-assets-discontinued-operations/chapter-1-overview-scope/1-3-scope-asc-360-10); [Stout](https://www.stout.com/en/insights/article/asc-360-impairment-testing-long-lived-assets-classified-held-and-used)
- ASC 410-20: [Deloitte Roadmap 4.5](https://dart.deloitte.com/USDART/home/codification/liabilities/asc410-10/roadmap-environmental-obligations-aro/chapter-4-accounting-for-asset-retirement/4-5-initial-measurement-aros-arcs); [4.6](https://dart.deloitte.com/USDART/home/codification/liabilities/asc410-10/roadmap-environmental-obligations-aro/chapter-4-accounting-for-asset-retirement/4-6-subsequent-measurement-aros-arcs)
- ASC 842 ROU impairment and ASU 2023-01: [RSM](https://rsmus.com/content/dam/rsm/insights/financial-reporting/1pdf/impairments-of-right-of-use-assets.pdf); [Deloitte Spotlight](https://dart.deloitte.com/USDART/home/publications/deloitte/accounting-spotlight/2021/lease-accounting-real-estate-rationalization); [Deloitte Heads Up ASU 2023-01](https://dart.deloitte.com/USDART/home/publications/deloitte/heads-up/2023/fasb-asu-guidance-common-control-lease); [ASU 2023-01 full text (PwC Viewpoint)](https://viewpoint.pwc.com/dt/us/en/fasb_financial_accou/asus_fulltext/2023/asu202301/asu202301/asu202301.html)
- ASC 740 / ASU 2023-09: [KPMG](https://kpmg.com/us/en/frv/reference-library/2023/fasb-issues-asu-to-disaggregate-income-tax-disclosures.html)
- OBBBA: [PwC](https://www.pwc.com/us/en/services/tax/library/pwc-ob3-provides-bonus-depreciation-qualified-production-property.html); [BDO](https://www.bdo.com/insights/tax/one-big-beautiful-bill-act-expands-100-depreciation-expensing-opportunities); [Grant Thornton](https://www.grantthornton.com/insights/alerts/tax/2025/insights/obbba-offers-new-ways-to-accelerate-depreciation)
- Codification (authoritative, login): [FASB ASC](https://asc.fasb.org/); [FASB standards page](https://www.fasb.org/standards)

**IFRS / IASB**
- IFRS 18: [BDO Australia](https://www.bdo.com.au/en-au/blogs/corporate-reporting/more-disclosure-when-presenting-operating-expenses-by-function-under-ifrs-18); [Forvis Mazars](https://www.forvismazars.com/uk/en/insights/financial-and-corporate-reporting-updates/ifrs-18-the-devil-is-in-the-detail-again); [ESMA public statement (Feb 2026)](https://www.esma.europa.eu/sites/default/files/2026-02/ESMA32-193237008-9180_Public_Statement_IFRS_18.pdf)
- IAS 37 targeted improvements: [IASB AP22 Sept 2026](https://www.ifrs.org/content/dam/ifrs/meetings/2026/september/iasb/ap22-cover-paper.pdf); [BDO](https://www.bdo.global/en-gb/news/ifrs-news/iasb-proposes-amendments-to-ias-37)
- Goodwill and impairment (IAS 36): [IASB project page](https://www.ifrs.org/content/ifrs/home/projects/work-plan/goodwill-and-impairment.html); [IASB AP18 Jul 2026](https://www.ifrs.org/content/dam/ifrs/meetings/2026/july/iasb/ap18-cover-paper.pdf)
- Standard texts (canonical pages; not fetched this session): [IAS 16](https://www.ifrs.org/issued-standards/list-of-standards/ias-16-property-plant-and-equipment/), [IAS 36](https://www.ifrs.org/issued-standards/list-of-standards/ias-36-impairment-of-assets/), [IFRS 16](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-16-leases/), [IAS 40](https://www.ifrs.org/issued-standards/list-of-standards/ias-40-investment-property/), [IFRS 5](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-5-non-current-assets-held-for-sale-and-discontinued-operations/), [IAS 20](https://www.ifrs.org/issued-standards/list-of-standards/ias-20-accounting-for-government-grants-and-disclosure-of-government-assistance/), [IAS 23](https://www.ifrs.org/issued-standards/list-of-standards/ias-23-borrowing-costs/), [IFRS 18](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/)

**GASB**
- GASB 104: [Deloitte](https://dart.deloitte.com/USDART/home/news/all-news/2024/oct/gasb-disclosing-capital-assets); [BDO](https://bdo.com/insights/industries/government-public-sector/gasb-104-disclosure-of-certain-capital-assets); [Forvis Mazars](https://www.forvismazars.us/forsights/2024/11/gasb-statement-104-new-capital-asset-disclosures)
- GASB 96 thresholds (practice): [WA OFM GASB 96 overview](https://ofm.wa.gov/sites/default/files/public/resources/leases/GASB96_Overview_and_Checklist.pdf); [GASB](https://www.gasb.org/)

**Audit / controls**
- PCAOB technology-assisted analysis: [PCAOB](https://pcaobus.org/oversight/standards/implementation-resources-PCAOB-standards-rules/amendments-related-to-aspects-of-designing-and-performing-audit-procedures-that-involve-technology-assisted-analysis-of-information-in-electronic-form); [Deloitte](https://dart.deloitte.com/USDART/home/news/all-news/2024/aug/sec-approves-pcaob-standards)
- SOC 1 / subservice organizations: [Compass IT](https://www.compassitc.com/blog/subservice-organizations-in-soc-reports-carve-out-vs.-inclusive-method); AICPA SOC 1 guide (VERIFY current edition and URL at aicpa-cima.com)

---

## 9. Open questions

1. **ASU 2025-06 details (VERIFY against the ASU PDF):** the exact wording of the "significant development uncertainty" indicators; whether the final ASU kept the ED's separate cash-flow presentation of software costs; the mechanics of the "modified" transition for in-process projects.
2. **ASU 2025-10:** the exact ASC 832 paragraph references, how grants for CIP projects that are later capitalized are treated, the presentation of deferred grant income (gross vs offset in expense), and interaction with capitalized interest (interest on grant-funded spend). VERIFY in the Deloitte Heads Up full text.
3. **ASU 2026-02 effective date:** sources conflict (PBE annual periods beginning after Dec 15, 2027 vs 2026). VERIFY.
4. **ASC 845 scope after ASU 2014-09/2017-05**, and whether any investment-income offset survives in ASC 835-20. VERIFY codification text.
5. **IASB timing:** when the IAS 37 targeted improvements and the IAS 36/IFRS 3 amendments will be finalized, and their effective dates. Neither was final as of Sept 2026. Watch the IASB work plan.
6. **ROU ownership:** should ROU assets live natively in the FA register or come from a separate lease subledger (build vs integrate)? This depends on the lease-accounting research stream and on Bloomberg Tax Fixed Assets' own approach (VERIFY competitor capability).
7. **IFRS book derivation:** how much of an IFRS book can be auto-derived from GAAP (life, salvage) versus must be maintained independently (components, revaluation, impairment)? This needs customer interviews (dual reporters: foreign-parented US subs, US-parented groups with IFRS statutory subsidiaries).
8. **SOC 1 scope boundary for rule content:** do customers' auditors expect the vendor's SOC 1 to cover the *accuracy of regulatory content* (e.g., MACRS tables, state conformity), or only change control over it? This needs an auditor sounding (Big 4 IT audit).
9. **DISE/IFRS 18 "capitalized depreciation":** what tracing level do auditors expect for depreciation capitalized into inventory or self-constructed assets? Is reporting by first-destination flag enough?
10. **Delta Lake retention and immutability:** confirm Databricks retention defaults and the recommended pattern for WORM-like audit snapshots (e.g., separate append-only tables, object-lock storage). VERIFY with Databricks documentation.
11. **Research coverage gap:** this session's search budget ran out before the AICPA SOC 1 guide, GASB 87/96 primary text and some ASC paragraph citations could be confirmed directly. Schedule a follow-up verification pass.
