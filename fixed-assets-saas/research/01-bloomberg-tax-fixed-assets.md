# 01 — Bloomberg Tax Fixed Assets: competitive deep dive

**Prepared:** 2026-10-30 · **Scope:** Bloomberg Tax Fixed Assets (formerly BNA Fixed Assets / Bloomberg BNA Fixed Assets) and the adjacent Bloomberg Tax products (Provision, Workpapers, Research / AI Assistant)
**Purpose:** Input for a cloud fixed-asset + book/tax/state/local depreciation + compliance-forms SaaS (GitHub / Cloudflare / Databricks stack)

> **Method and limits (read first).** This session could not open pages directly: pro.bloombergtax.com, capterra.com and most other hosts were blocked by the session's network policy (DNS/egress denial). The shared web-search budget also ran out partway through. Every claim below therefore comes from search-engine extracts of the cited pages, not from reading them in full. Bloomberg's help center, release notes and product docs sit behind a customer login and were not reachable in any case. Confidence markers: **[H]** high (vendor primary source or several sources agree), **[M]** medium (one secondary source, or an older source that probably still holds), **[L]** low (inference or thin evidence). **VERIFY** marks claims that need a demo, a customer contact or direct document access. To fill the gaps, allow `pro.bloombergtax.com`, `trust.bloombergindustry.com`, `capterra.com` and `g2.com` in the session's network settings and re-run.

---

## 1. Executive summary

1. **What it is.** Bloomberg Tax Fixed Assets is a cloud-native fixed-asset subledger and depreciation engine that Bloomberg sells mainly to corporate tax departments, mid-market and enterprise finance teams, and larger CPA firms. It descends from BNA Software's desktop product (BNA Fixed Assets Desktop / DesktopPro / Network / Enterprise-Web), which Bloomberg acquired with BNA in 2011. Today it is marketed as cloud/SaaS. Reviewers report that Bloomberg no longer sells the desktop versions, and some of them complain about migrating to the cloud product. [H for cloud positioning; M for the desktop end-of-sale]
2. **Core strength is multi-book tax depreciation.** Standard books include GAAP/internal, Federal Tax, AMT, ACE and E&P, and earlier reviews also list California, New York and Pennsylvania state books. A book wizard adds up to **99 custom books** (states, IFRS-style or planning books). Federal tax-form outputs reported include **Forms 4562, 4797, 4626, 3468, 4255 and 8824**, plus Schedule M-1/M-3 support, state modification reports and a QBAI report (GILTI). [H for books and the 4562/4797; M for the rest of the form list, which dates from 2020]
3. **Law-change agility is the main selling point.** Bloomberg says the product "automatically updates when a federal or state tax law changes" and cites a customer survey figure of 4.5 hours per week saved. Its OBBBA materials frame 100% bonus depreciation as permanent for property **acquired after Jan 19, 2025**, and point users to a **Tax Depreciation Modeling** feature. That feature runs bonus vs. non-bonus scenarios side by side without touching production data, allows elections at the asset-class-life level, layers in planned capex and applies custom discount rates. [H for the claims; L for what actually shipped and when: **no public release notes**, VERIFY]
4. **Integration is file- and module-based; there is no public API.** Bloomberg names SAP S/4HANA, Oracle NetSuite, Microsoft Dynamics, Workday, PeopleSoft, Costpoint, Infor M3 and JD Edwards as ERPs it works with. The mechanism is the **Data Manager** mass import (on demand or on a schedule), custom implementations and, since June 2024, an ERP data-cleansing path through **Bloomberg Tax Workpapers**. No official REST API turned up. A third party (Supergood) sells an *unofficial* API built by reverse-engineering authenticated browser sessions, which strongly suggests no public API exists. [M]
5. **The suite matters.** Fixed Assets sits inside a Bloomberg Tax suite: Research, with an AI Assistant launched in March 2025 and expanded in July 2025 and at TEI 2026; Workpapers, launched March 2024 with an AI formula generator added in July 2024; and Provision (ASC 740). Bloomberg sells these as one integrated workflow, with projected tax rates flowing into Fixed Assets, Provision and Workpapers. A standalone competitor has to beat this bundle on depth or price, or it has to integrate with the products Bloomberg's customers already own. [H]
6. **Reviews are middling.** G2 shows **3.8/5 from 19 reviews**. Capterra US shows **4.2 from 31 reviews** (ease of use 4.1, customer service 4.0, value 4.0) as of March 2026. SoftwareConnect shows **3/5 from 6 reviews**. Praise centers on multi-book, multi-method tracking, AMT handling and reporting. Complaints center on price (asset-count-based), **partial dispositions**, **multi-company effort**, **prior-period entries and basis changes producing wrong reports**, and **the web UI being worse than desktop for bulk editing**. [M; small samples]
7. **Pricing is opaque and quote-based**, driven by modules and **number of assets** (one reviewer calls asset-count pricing "the biggest issue"). Historical anchors: the 2008 SBE single-user edition cost $745, the 2009 DesktopPro edition started at $2,615 with CIP, and the 2016 Web version was about $1,500. No current list price is public. [M for the drivers; L for any current number]
8. **Security posture is unverified.** Bloomberg Industry Group runs a Trust Center (trust.bloombergindustry.com) with gated "sensitive information", most likely SOC reports. This research could not confirm a SOC 1 Type II, SOC 2 Type II or ISO 27001 report scoped to Fixed Assets. **VERIFY** (this is a buyer-checklist item for us as well).

**Bottom line for us:** parity means a correct multi-book MACRS/ADS/AMT/E&P/state engine, OBBBA-current bonus/§179/§168(n) handling, a 4562/4797/state-modification output set, a full lifecycle (CIP, transfers, partial and full dispositions, LKE, casualty), mass import/change, an audit trail and side-by-side scenario modeling. The clearest openings are a **public API and webhooks**, **transparent and versioned rules with citations and effective dates**, **spreadsheet-grade bulk editing**, **correct retroactive and prior-period recalculation (with §481(a))**, **first-class multi-entity operations** and **non-punitive pricing**.

---

## 2. Detailed findings

### 2.1 Product lineage, editions and deployment

| Era | Product / edition | Notes | Conf. |
|---|---|---|---|
| 2008–2009 | BNA Fixed Assets **Desktop**, **DesktopPro**, single-user **SBE** ($745), **Enterprise/Web** | Enterprise/Web added third-party integration and remote access through a secure portal. DesktopPro started at $2,615 with Construction in Progress. | M |
| 2014 | **G/L Integrator** SAP-certified; Web software update for the tangible property regulations | Shows a long-standing ERP/GL focus | M |
| 2016–2017 | Desktop, network-installed, and SaaS/Web; **Enterprise** for "larger corporations (including Fortune 20)". Optional modules: **Asset Inventory, Construction in Progress, Foreign Currency, G/L Integrator** | Web version priced around $1,500 (2016) | M |
| 2018–2020 | Rebranded **Bloomberg Tax Fixed Assets** / Bloomberg Tax & Accounting Fixed Assets. CPA Practice Advisor rated it 5 stars in 2020, calling it best suited to "larger CPA firms and enterprise level businesses" | | M |
| 2024–2026 | Marketed as a "native cloud-based" **fixed assets subledger**; integrated with Workpapers and Provision | Capterra still lists Windows/Mac desktop as well as cloud, probably a stale listing | H for cloud; M for desktop status |

- **Target customers:** corporate tax departments (enterprise and mid-market) and accounting firms that manage client assets. Bloomberg runs a dedicated "Fixed Assets Software for the Mid-Market" campaign, and case studies feature large industrials (an "industrial gas leader"). [H]
- **Desktop to cloud:** reviewers say desktop is no longer sold. Migration was "smooth" for some and "difficult" for others, and some users find the online version harder for large-volume edits. [M] This matters to us: the installed base of desktop or network BNA users who were pushed to the cloud is a **switching cohort** we can target.
- **Implementation channel:** a **Bloomberg Tax Certified Implementer Program** (contact cip@bloombergindustry.com) suggests partner-led implementations for complex ERP data conversion. [M]

### 2.2 Books and how multi-book works

- **Standard books:** GAAP/internal, Federal Tax, AMT, ACE, E&P. The 2020 review also lists **California, New York and Pennsylvania** as standard state books. [H/M]
- **Custom books:** a **book wizard** creates up to **99 additional books** for other jurisdictions, planning or scenario modeling. [H] No native **IFRS** book type was found. IFRS would be a user-defined internal book, and IAS 16 component accounting and revaluation support are **unverified** (VERIFY).
- **Book rule families:** the Quick Start Guide says an **Internal Book** applies GAAP rules and a **Tax Book** applies IRS depreciation rules. Each book therefore carries a rule family that limits which methods and conventions are valid. [H]
- **Derived tax books:** AMT, ACE and E&P depreciation are calculated **automatically** from the asset's federal attributes. AMT/ACE matter mostly for pre-2018 corporate AMT carryforward and legacy assets, and for individual AMT through pass-throughs. E&P matters for international (§§951A, 959/961, QBAI) and dividend-capacity work. [H]
- **Period controls:** **period close dates** can be set per book, and a **mass change** can apply to all books at once. [H]
- **State books for bonus nonconformity:** a February 2020 release added **state bonus depreciation books and reports**, including calculation of **federal-to-state modifications** for states that decouple. Bloomberg's guidance recommends separate state books over spreadsheet adjustments and notes that some states require modifications **broken out by depreciation type** while others want one combined number. They also call out **"flip-flop" states** that switch conformity over time and classify conformity as **static (fixed-date), rolling, or selective**. [H]

**Implication:** the multi-book model is "one asset, N books, each with its own method, life, convention, bonus/§179 and elections, inheriting from a parent book unless overridden." The 99-book ceiling looks dated, and a data model with no limit is easy for us to offer.

### 2.3 Depreciation methods, conventions, bonus and §179

What is confirmed about Bloomberg specifically is limited to **marketing level**:
- "Multiple depreciation lives/methods" (reviews); "handles AMT well" (review). [M]
- **Bonus:** bulk bonus elections, bonus-rate modeling and **class-life-level** elect-out modeling. [H]
- **§179:** included in 4562 output (implied). The details of the taxable-income limitation and carryforward were not verified. VERIFY.
- **Cost segregation (June 2024):** applies cost-seg study results to assets and calculates the **§481(a)** adjustment for **Form 3115** (accounting method change). [H] This is a strong feature and one we need to match.

Not confirmed for Bloomberg, but table stakes in the category (Sage and Thomson Reuters publish all of these in public help docs) and therefore assumed for parity:
- **Methods:** MACRS GDS (200DB/150DB/SL), ADS (SL), pre-1987 ACRS, SL, DB variants, SYD, remaining-life and user-defined methods, §197 amortization and units-of-production for internal books. VERIFY for Bloomberg's exact list.
- **Conventions:** half-year, mid-quarter (with the automatic **40% last-quarter test**), mid-month (real property), full-month and modified half-year for book. **Short tax years** handled with ADS and MACRS proration. VERIFY.
- **§280F** luxury-auto caps and listed property, business-use percentage, ITC basis reductions (Form 3468/4255 implies ITC tracking and recapture). [M]

**OBBBA (P.L. 119-21) items a parity product must handle (law per IRS and Big 4 sources; Bloomberg's own implementation is VERIFY):**
| Provision | Rule (summary) | Product requirement | Conf. (law) |
|---|---|---|---|
| §168(k) 100% bonus, permanent | Qualified property **acquired after Jan 19, 2025** (that is, on or after Jan 20; Bloomberg pages use both phrasings, which agree) | Store **acquisition date / binding-contract date** separately from placed-in-service date. Pre-Jan 20 acquisitions keep the TCJA phase-down rate (40% for 2025 PIS) | H |
| §168(k)(10) transition election | Elect **40%** (60% for long-production-period property and certain aircraft) instead of 100% for property placed in service in the **first tax year ending after Jan 19, 2025** | Entity-year election object, made on a timely filed return including extensions | H |
| Notice 2026-11 (Jan 14, 2026) | Interim guidance applying the TCJA §1.168(k)-2 regulations; includes a **component election** for self-constructed property | Component-level acquisition dates for self-constructed assets and CIP | M |
| §179 | **$2.5M** limit, **$4.0M** phase-out threshold for tax years beginning after 2024, inflation-indexed from 2026 | Indexed parameter tables by tax year; taxable-income limitation and carryover | H |
| §168(n) qualified production property | 100% allowance for qualifying **nonresidential real property** used in qualified production activities; Notice 2026-16 (Feb 20, 2026) gives interim guidance including **recapture** when property stops qualifying | New property flag; construction-start and PIS windows; use tracking and a recapture monitor (VERIFY exact dates with the tax-law research stream) | M |
| State decoupling | For example, **California does not conform** to the OBBBA bonus rules; **Texas** franchise tax announced conformity with the OBBBA depreciation rules (Dec 2025) | State conformity profiles by tax year with static, rolling or selective modes | M |

Bloomberg's projected **2026 and 2027 tax-rate releases** say the updated parameters "flow into Fixed Assets, Provision and Workpapers." So parameter tables, such as §179 indexing and §280F caps, are pushed centrally. [H]

### 2.4 Asset lifecycle

| Event | Bloomberg evidence | Conf. |
|---|---|---|
| Acquisition / add | Manual entry and **Data Manager** mass import from multiple systems, on demand or scheduled | H |
| **Construction in Progress** | Separate CIP module: tracks project costs before placed-in-service and **auto-creates assets when projects complete** | M |
| Transfers | Bulk transfers through Data Manager (2019 review); intercompany or inter-entity transfer semantics (carryover basis, §168(i)(7) step-in-the-shoes) unverified | M / VERIFY |
| Full dispositions / retirements | Bulk disposals through Data Manager; feeds Form 4797 | H |
| **Partial dispositions** | Supported, but reviewers name it a **pain point** | M |
| Like-kind exchange (§1031, real property only after TCJA) | Form 8824 output reported (2020) | M |
| Casualty / involuntary conversion | Not confirmed; VERIFY | L |
| Group / pooled assets, GAA (§1.168(i)-1) | Not confirmed; VERIFY | L |
| Cost segregation reclassification and §481(a) | Shipped June 2024 | H |
| Physical inventory / tagging | Legacy **Asset Inventory** module (barcode-style tracking) | M |
| Foreign currency | Legacy **Foreign Currency** module | M |
| Basis adjustments, prior-period PIS | Supported, but a reviewer reports **"reporting becomes erroneous"** after prior-period additions or basis edits | M |

### 2.5 Reports, forms, projections and what-if

- **Forms:** 4562 and 4797 (vendor page); 3468, 4255, 4626, 8824 and a Schedule M-1/M-3 report (2020 review). The 2020 review cites about **40 standard and custom reports**, "including fileable tax forms and supporting worksheets." [H/M]
- **State:** state depreciation **modification reports** (federal-to-state adjustments) and state bonus books. Coverage of specific state forms (for example CA FTB 3885, NY IT-398) is **not confirmed**. VERIFY.
- **Local:** no evidence of **local personal-property-tax rendition** support (county or assessor returns) or city income tax (NYC, Philadelphia, etc.). [L]
- **International:** **QBAI** report (GILTI tangible-asset return); E&P book. [M]
- **Rollforwards / reconciliation:** the June 2024 release added "custom reports, automated reconciliation, and automated export." [H]
- **Projections and what-if:** **Tax Depreciation Modeling** offers side-by-side scenarios isolated from production data, bonus elections by class life, planned-capex layering, custom discount rates (NPV) and modeling of "upcoming regulatory changes." [H] Bloomberg reports that 80% of tax professionals were concerned about implementing the bonus changes but fewer than half had started scenario modeling. That is a marketing hook we can borrow.
- **Journal entries:** automatically creates journal entries against the client's chart of accounts. [H]
- **Provision feed:** book/tax differences and deferred data reach **Bloomberg Tax Provision** through the suite integration. The mechanism and granularity are not documented publicly. [M]

### 2.6 Data import/export, ERP integrations and API

- **Data Manager:** mass import and change of assets and transactions (adds, disposals, transfers, edits). The 2023 ROI survey says ~70% of respondents found Data Manager mass import "extremely useful". [H]
- **ERPs named:** SAP S/4HANA, Oracle NetSuite Cloud, Microsoft Dynamics, Workday, PeopleSoft, Costpoint, Infor M3 and JD Edwards; "integrates with any ERP system." [H] This appears to mean **file-based mapping plus implementation services**, not native certified connectors (except the historical SAP-certified G/L Integrator). [M]
- **Workpapers path (June 2024):** "self-service automation to prepare, cleanse, and transform data from complex ERP data directly into" Fixed Assets, with **import and export** between Workpapers and Fixed Assets. [H]
- **API:** **no official public API found.** Supergood's unofficial "Bloomberg Tax API" exposes "fixed asset registers with multi-book depreciation" through session-based login with MFA handling and must keep pace with UI changes. One directory listing says outright that there is no API. [M] This is a **material gap** and our biggest integration opening.
- **Templates:** Bloomberg's import template layouts are not public. Capterra lists **Microsoft Excel** and **Workpapers** as integrations. [M]

### 2.7 Audit trail and controls

- "Documents every change, protecting your data while enabling collaboration." A **history** view shows changes made against assets over time. The legacy BNA datasheet lists a "secure audit trail and data history viewing capability for asset calculation modifications at any point in time." [H]
- **Authorization levels** for files and systems (role-based access). [M]
- **Period close** locks per book. [H]
- **Unknowns (VERIFY):** whether audit trail entries record field-level before and after values for **bulk** changes; maker-checker approval; SSO/SAML/SCIM; data-residency options; exportable audit logs for SOX ITGC evidence.

### 2.8 Law-change delivery and release cadence

- **Delivery model:** a cloud tenant where Bloomberg pushes tax-law and parameter updates, including state law ("automatically updates when a federal or state tax law changes"). [H]
- **Public changelog:** **none found** for 2025–2026. Public evidence of change consists of press releases (Feb 2020 state bonus; Jun 2024 Workpapers integration, cost seg and §481(a); Jul 2024 Workpapers AI and integrations) and thought-leadership articles (OBBBA bonus strategy, Mar 2026). [H for the absence of a public changelog]
- **Contrast:** Thomson Reuters publishes a public **"One Big Beautiful Bill Act (OBBBA) of 2025"** help page for Fixed Assets CS, and Sage publishes versioned public help (e.g., `help-sfa.na.sage.com/en-us/20260/...`). Bloomberg's opacity is a gap a competitor can turn into an advantage. [H for the contrast]
- **OBBBA shipping timeline:** **unknown.** The Bloomberg OBBBA bonus article is dated about March 2026, and the 2026 projections release is dated Sept 11, 2025. Whether the 40%/60% transition election, §168(n) QPP and Notice 2026-11 component election are fully modeled is **VERIFY** (ask in a demo).

### 2.9 UI/UX workflow (from reviews and guides)

- Workflow: set up a company and choose its book set → add assets manually or through Data Manager → assign GL accounts and class → calculate → close periods → run reports and forms → export JEs, Workpapers and Provision data. [M]
- Pain points: the web UI is **slower or harder for editing large volumes** than desktop; **managing multiple companies** "takes significant time"; **partial dispositions** are awkward; **retroactive changes** produce reporting errors; ease of use is "mixed." [M]
- Positive: once configured, reliable multi-book tracking and reporting; some users found the cloud migration smooth. [M]

### 2.10 Security, hosting and SOC

- Bloomberg describes Fixed Assets as "native cloud." Third-party listings mention "advanced security measures and automatic data backup" (generic). [M]
- **Trust Center:** trust.bloombergindustry.com, with gated document download. **SOC 1 Type II and SOC 2 Type II scope for Fixed Assets is unverified**, as are the hosting provider and region. VERIFY.
- **Implication for us:** enterprise buyers will require a **SOC 1 Type II** (it supports their ICFR because depreciation feeds financial statements) and a **SOC 2 Type II**. Plan the controls from day one (Databricks Unity Catalog audit logs, Cloudflare Zero Trust access logs, GitHub branch protection and change management).

### 2.11 Pricing signals

- Quote-only ("contact Bloomberg Tax for pricing"). Drivers: **modules**, **number of assets**, and possibly users and access level (Gartner's note covers Bloomberg Tax broadly). [M]
- Third-party estimates (ITQlick: about $1,800/month for 10 users; "$2–5K/yr more than a competitor") are inconsistent and **unreliable**. [L]
- Bundle effect: Research, Provision and Workpapers cross-sell. Research AI features come "at no additional charge," which raises suite stickiness. [H]

### 2.12 Adjacent Bloomberg Tax products

| Product | What it does | Relevance to Fixed Assets | Conf. |
|---|---|---|---|
| **Bloomberg Tax Provision** | ASC 740 engine: current and deferred, UTBs, quarterly AETR, state computations, income tax payables, provision and tax-account rollover, rate rec updated for **ASU 2023-09**, Excel review output | Consumes book/tax basis differences from Fixed Assets; tax rates flow in from Research | H |
| **Bloomberg Tax Workpapers** (launched Mar 18, 2024) | Trial-balance cleansing, M-1 flux analysis, period roll forwards; **AI Expression Generator** (natural language to formula, Jul 2024; Gold Stevie 2025) | Cleanses ERP data for Fixed Assets; import and export with Fixed Assets; feeds Provision | H |
| **Bloomberg Tax Research** | Tax Management Portfolios, news, state charts (including bonus-conformity charts); **AI Lab** (2023) → **Bloomberg Tax Answers + AI Assistant** (Mar 2025, free to subscribers) → conversational research, chat history, jurisdiction filtering, **chart builder** (Jul 2025) → compliance-tracking AI and document upload (TEI Midyear, Mar 2026) | Authoritative content behind the law changes; the conformity charts are the editorial source behind the state rules | H |
| **Innovation Studio** | Preview environment for gen-AI tools (AI Assistant was its first release) | Signals Bloomberg will bring AI to Fixed Assets; no FA-specific AI found as of Oct 2026 | M |
| **Corporate Tax Analyzer / projections** | Annual projected-rates releases that flow into FA, Provision and Workpapers | Central parameter distribution | H |

---

## 3. Feature checklist

Priority key: **P0** = MVP-blocking parity; **P1** = needed for the first enterprise deals; **P2** = later or a differentiator.

| # | Feature | Bloomberg support | Notes | MVP priority |
|---|---|---|---|---|
| 1 | Cloud multi-tenant SaaS | Yes [H] | Desktop end-of-sale per reviews | P0 |
| 2 | Federal tax book (MACRS GDS/ADS) | Yes [H] | Exact method list VERIFY | P0 |
| 3 | GAAP / internal book (SL, DB, SYD, UOP, salvage) | Yes [H] | | P0 |
| 4 | AMT / ACE / E&P auto-derived books | Yes [H] | ACE is legacy; E&P needed for international | P1 (E&P P1; AMT/ACE P2) |
| 5 | State books, bonus/§179 decoupling and modification reports | Yes [H] | Shipped in 2020; flip-flop states | P0 (top ~10 states) → P1 all |
| 6 | User-defined books | Up to 99 [H] | We can offer unlimited | P0 |
| 7 | IFRS book (IAS 16 components, revaluation) | Not evidenced [L] | Only as a custom book | P2 |
| 8 | Conventions (HY/MQ with 40% test, MM, short year) | Assumed [L] | VERIFY | P0 |
| 9 | Bonus (OBBBA 100%, acquisition-date test, elect-out by class) | Yes [H] | Transition 40%/60% election VERIFY | P0 |
| 10 | §179 with indexed limits, TI limitation, carryover | Implied [M] | | P0 |
| 11 | §168(n) QPP + recapture monitor | Unknown [L] | New in 2025–26 | P1 (differentiator if early) |
| 12 | §280F autos / listed property | Assumed [L] | | P1 |
| 13 | ITC tracking (3468/4255) | Yes [M] | Energy credits changed under OBBBA, VERIFY | P2 |
| 14 | Cost seg import → reclass → §481(a) / 3115 | Yes, 2024 [H] | Strong feature | P1 |
| 15 | CIP with auto-capitalization | Yes, module [M] | | P1 |
| 16 | Transfers (intra- and inter-entity) | Yes, bulk [M] | Intercompany semantics VERIFY | P0 (intra) / P1 (inter) |
| 17 | Full disposals / retirements; gain/loss character (§1245/§1250/§1231) | Yes [H] | | P0 |
| 18 | Partial dispositions (§1.168(i)-8) | Yes but painful [M] | Differentiation target | P0 |
| 19 | Like-kind exchange (8824) | Yes [M] | Real property only post-TCJA | P1 |
| 20 | Casualty / involuntary conversion (§1033) | Unknown [L] | | P1 |
| 21 | Group / GAA / pooled assets | Unknown [L] | | P2 |
| 22 | Mass import (Data Manager) and mass change | Yes [H] | | P0 |
| 23 | Spreadsheet-grade bulk editing in web UI | Weak per reviews [M] | Differentiator | P0 |
| 24 | Form 4562 | Yes [H] | | P0 |
| 25 | Form 4797 | Yes [H] | | P0 |
| 26 | Forms 4626, 8824, 3468, 4255; M-1/M-3 support | Yes [M] | 2020 list | P1 |
| 27 | State depreciation forms (e.g., CA 3885, NY IT-398) | Not evidenced [L] | VERIFY | P1 |
| 28 | Local personal-property tax renditions | Not evidenced [L] | Differentiator | P2 |
| 29 | Rollforward / reconciliation / custom reports | Yes [H] | | P0 |
| 30 | GL journal entry generation | Yes [H] | | P0 |
| 31 | Projections and what-if (isolated scenarios, capex, NPV) | Yes [H] | | P1 |
| 32 | Period close per book | Yes [H] | | P0 |
| 33 | Audit trail / history | Yes [H] | Field-level before/after for bulk changes VERIFY | P0 |
| 34 | RBAC / authorization levels | Yes [M] | SSO/SCIM VERIFY | P0 (RBAC) / P1 (SSO) |
| 35 | Public REST API and webhooks | **No** [M] | Biggest gap | P0 (differentiator) |
| 36 | Native ERP connectors | Mostly services/file-based [M] | Start with NetSuite and SAP | P1 |
| 37 | Provision / tax-engine export (ASC 740 deferreds) | Yes (to Bloomberg Provision) [H] | We need open exports to OneSource, CCH, Longview, Excel | P1 |
| 38 | Automatic law updates | Yes, opaque [H] | We should ship versioned rules with citations | P0 |
| 39 | Public, versioned release notes | **No** [H] | Differentiator | P0 |
| 40 | Physical inventory / tagging | Legacy module [M] | | P2 |
| 41 | Multi-currency | Legacy module [M] | | P2 |
| 42 | AI (classification, research assistant) | Research and Workpapers only [H] | No FA-specific AI found | P1 differentiator |
| 43 | SOC 1 / SOC 2 Type II | Unverified | Buyer requirement | P1 (Type I at GA) |
| 44 | Multi-entity consolidated operations | Weak per reviews [M] | Differentiator | P0 |

---

## 4. Implications for the product

### 4.1 Parity features the MVP must have

1. **Multi-book engine:** federal tax (GDS/ADS), GAAP/internal, E&P, unlimited user-defined books, and state books that inherit from federal with a **conformity profile per state per tax year** (static, rolling or selective; bonus %, §179 cap, add-back and recovery pattern). AMT/ACE can follow, but design for them now.
2. **OBBBA-correct federal logic:** bonus by **acquisition/binding-contract date** (with the pre-Jan 20, 2025 phase-down), the §168(k)(10) **40%/60% transition election**, **class-level elect-out**, the Notice 2026-11 **component election** for self-constructed property, indexed **§179** ($2.5M / $4.0M base) with the taxable-income limit and carryover, and the mid-quarter 40% test.
3. **Lifecycle:** add, adjust, CIP to placed-in-service, intra-entity transfer, **partial and full disposition** with §1245/§1250/§1231 character, retirement and abandonment.
4. **Outputs:** Form **4562** and **4797** (PDF plus a structured export for tax engines), state modification schedules, rollforward (beginning, adds, disposals, depreciation, ending) per book, **JE export**, and a book-to-tax difference export for provision.
5. **Mass operations:** template import and change with validation and dry-run, plus a spreadsheet-grade grid.
6. **Controls:** immutable audit trail (field-level before and after values, actor, timestamp, reason), per-book **period close**, RBAC.
7. **Scenario modeling:** clone a book or entity into an isolated sandbox, change elections and rates, compare side by side, and promote to production through an approval step.

### 4.2 Differentiators (where Bloomberg is weakest)

1. **Open platform:** a public REST/GraphQL API, webhooks (asset added, period closed, rules updated), OAuth2 client credentials, and first-party connectors (start with NetSuite, SAP S/4HANA, Workday, Dynamics 365). The existence of an unofficial scraped API is evidence of demand.
2. **Transparent, versioned rules:** each rule (bonus rate table, §179 limits, state conformity) is a versioned record with **effective dates, statute or notice citation, change reason and diff**. A public changelog plus an in-app "what changed for *my* assets" impact report beats "it updates automatically." On Databricks, store rules as Delta tables with time travel and Unity Catalog lineage so any past calculation can be reproduced exactly.
3. **Retroactive correctness:** first-class **prior-period and basis corrections** that re-run all books, show catch-up versus restatement, and compute the **§481(a)** adjustment and Form 3115 support automatically (extending Bloomberg's cost-seg feature to every method change).
4. **Partial dispositions done right:** select by component, quantity or percentage; use the §1.168(i)-8 allocation methods (specific identification, PPI discounting, cost-seg study); preview gain/loss across all books before posting.
5. **Multi-entity at scale:** portfolio views, cross-entity mass changes, intercompany transfers with carryover basis and §168(i)(7) handling, and consolidated-group rules (Notice 2026-16 treats a consolidated group as one taxpayer for §168(n)).
6. **State and local depth:** all states' conformity, state forms (CA 3885 etc.), and **local personal-property-tax rendition** exports. Local coverage is a gap among the tax-depreciation leaders.
7. **§168(n) QPP lifecycle:** eligibility questionnaire, construction-start evidence, use tracking and a **recapture monitor**, an early, OBBBA-specific advantage.
8. **AI where it is defensible:** suggest asset class and recovery period from invoice or description text with a citation, parse cost-seg PDFs, detect anomalies (for example a bonus applied to a pre-Jan 20 acquisition), and add a research copilot grounded in our own rules tables. Keep every AI output reviewable and logged.
9. **Pricing:** publish tiers that do not punish asset count (for example, per entity plus volume bands) and allow unlimited books.
10. **Interoperate with the Bloomberg suite** instead of competing head-on with all of it: export in formats Bloomberg Provision and Workpapers users can ingest, and target the desktop-to-cloud migrants who were unhappy with the forced move.

### 4.3 Data entities and key fields (initial model)

| Entity | Key fields |
|---|---|
| **Tenant / Client** | tenant_id, firm vs. corporate, data-residency region, SSO config |
| **Entity (Company)** | entity_id, legal name, EIN, entity type (C/S/P/individual), tax-year end, short-year flags, consolidated group id, functional currency, state/local nexus list |
| **Book** | book_id, entity_id, book_type (tax / internal / derived: AMT, ACE, E&P / state / local / scenario), jurisdiction, parent_book_id (inheritance), conformity_profile_id, rules_version_pin, period calendar, close_through_date |
| **ConformityProfile** | jurisdiction, tax_year, mode (static/rolling/selective), IRC conformity date, bonus_pct / add-back / recovery-pattern rule, §179 limit and phase-out, citation |
| **RuleVersion** | rule_id, parameter set (bonus tables, §179 limits, §280F caps, MACRS tables), effective_from / effective_to, statute/notice citation, published_at, diff |
| **Asset** | asset_id, entity_id, tag/number, description, asset_class (Rev. Proc. 87-56), GL accounts (cost, AD, expense), location (state, county, site), department, parent_asset_id / component_of, quantity, **acquisition_date**, **binding_contract_date**, **construction_start_date**, **placed_in_service_date**, cost, land portion, vendor/invoice refs, new vs. used, listed-property flag, business-use %, QPP flag, QIP flag, cost-seg study id |
| **AssetBook** (per asset per book) | method, recovery period, convention, salvage, bonus % applied, §179 amount, §168(n) amount, ITC/basis reductions, prior accumulated depreciation, override flags, election refs |
| **Election** | entity_id, tax_year, book/jurisdiction, type (elect-out bonus by class, §168(k)(10) 40%/60%, component election, ADS for §163(j), de minimis safe harbor, partial-disposition election, GAA), scope, filed date, statement text |
| **Transaction** | txn_id, asset_id, type (add, adjust, transfer, partial/full disposal, retirement, LKE, casualty, CIP capitalization, reclass), effective date, posting period, amounts, proceeds/expenses, disposal %/qty, allocation method, gain/loss character, replacement-property link |
| **CIPProject** | project_id, cost accumulation lines, component split, completion date, auto-capitalize rules |
| **DepreciationLedger** | asset_id, book_id, period, depreciation, accumulated, NBV, calc_trace_id, rules_version used |
| **Scenario** | scenario_id, base snapshot, overrides, results, status (draft → approved → promoted) |
| **FormOutput** | form id (4562, 4797, 8824, 4626, state), entity, tax year, line values, source lineage, PDF/structured export |
| **AuditEvent** | actor, timestamp, object, field, before, after, reason, bulk_job_id, approval_id |
| **ImportJob** | template, mapping, validation results, dry-run diff, committed_by |

---

## 5. Sources

Vendor (Bloomberg Tax / Bloomberg Industry Group)
- Bloomberg Tax Fixed Assets product page: https://pro.bloombergtax.com/products/fixed-assets/
- "The Leading Cloud-Based Fixed Asset Solution": https://pro.bloombergtax.com/explore/
- Fixed Assets Software for the Mid-Market: https://pro.bloombergtax.com/explore/fixed-asset-software-for-the-mid-market
- Automate your fixed assets life cycle: https://pro.bloombergtax.com/explore/automate-your-fixed-assets-life-cycle
- Adapt to tax law changes without disrupting your processes: https://pro.bloombergtax.com/products/adapt-to-tax-law-changes-without-disrupting-your-processes/
- Tax Depreciation Modeling: https://pro.bloombergtax.com/products/fixed-assets/see-tax-depreciation-modeling-in-action/
- 6 ways to prepare for bonus depreciation changes: https://pro.bloombergtax.com/insights/fixed-assets/6-ways-to-prepare-for-bonus-depreciation-changes/
- From TCJA to OBBBA: Bonus Depreciation Strategy for 2026 and Beyond: https://pro.bloombergtax.com/insights/fixed-assets/bonus-depreciation-strategy-for-2026-and-beyond
- When to elect out of bonus depreciation: https://pro.bloombergtax.com/insights/fixed-assets/when-to-elect-out-of-bonus-depreciation/
- Maximize your ROI with Bloomberg Tax Fixed Assets: https://pro.bloombergtax.com/insights/fixed-assets/maximize-your-roi-with-bloomberg-tax-fixed-assets/
- 2023 Bloomberg Tax Fixed Assets Customer ROI Survey: https://pro.bloombergtax.com/reports/2023-bloomberg-tax-fixed-assets-customer-roi-survey/
- Reduce audit risk with intelligent tax technology: https://pro.bloombergtax.com/products/reduce-audit-risk-with-intelligent-tax-technology/
- Solve fixed assets data challenges: https://pro.bloombergtax.com/brief/solve-fixed-assets-data-challenges/
- State conformity to federal bonus depreciation: https://pro.bloombergtax.com/brief/state-conformity-to-federal-bonus-depreciation/
- Industrial gas leader case study: https://pro.bloombergtax.com/brief/industrial-gas-leader-refines-its-approach-to-fixed-assets-management-with-bloomberg-tax-software/
- Certified Implementer Program: https://pro.bloombergtax.com/?p=30714
- Fixed Assets Quick Start Guide (2019/2020): https://data.bloomberglp.com/bna/sites/9/2019/10/FAQuickStartGuide.pdf ; https://assets.bbhub.io/bna/sites/9/2020/10/FAQuickStartGuide.pdf
- BNA Fixed Assets datasheet (legacy): https://www.slideshare.net/slideshow/bna-fixed-assetssoftwaredatasheet/5633906
- June 2024 Fixed Assets enhancements (PR Newswire): https://www.prnewswire.com/news-releases/bloomberg-tax--accounting-announces-enhancements-to-fixed-assets-software-302180524.html
- July 2024 Workpapers AI Expression Generator and integrations: https://www.prnewswire.com/news-releases/bloomberg-tax--accounting-introduces-ai-expression-generator-and-enhanced-integrations-for-workpapers-302200793.html
- Workpapers Gold Stevie (AI): https://pro.bloombergtax.com/insights/company-news/bloomberg-tax-workpapers-wins-gold-stevie-award-for-ai-enhancements/
- Bloomberg Tax Provision: https://pro.bloombergtax.com/bloomberg-tax-provision ; https://pro.bloombergtax.com/products/seamless-integrations-for-a-smarter-provision-workflow/
- 2026 Tax Projections (Sept 2025): https://pro.bloombergtax.com/insights/company-news/2026-tax-projections-bloomberg-tax-provides-early-insights-for-strategic-planning/
- 2027 Tax Projections: https://pro.bloombergtax.com/insights/company-news/new-bloomberg-tax-projections-give-tax-professionals-an-early-start-on-2027-planning/
- New AI features for tax research (Mar 2025): https://pro.bloombergtax.com/insights/company-news/new-ai-features-from-bloomberg-tax-accounting-simplify-complex-tax-research/
- TEI Midyear 2026 AI tools: https://pro.bloombergtax.com/insights/company-news/bloomberg-tax-showcases-industry-leading-ai-powered-tools-at-tei-midyear-2026
- AI for Corporate Tax (May 2026): https://pro.bloombergtax.com/insights/artificial-intelligence/ai-for-corporate-tax-verified-intelligence-for-complex-calculations-and-compliance/
- Bloomberg Industry Group Trust Center: https://trust.bloombergindustry.com/
- Bloomberg Tax news, Texas franchise tax OBBBA conformity: https://news.bloombergtax.com/daily-tax-report-state/texas-comptroller-announces-franchise-tax-depreciation-conformity-with-obba-rules
- Tax Management Memo, "100% Bonus Depreciation Is Back": https://news.bloombergtax.com/tax-management-memo/100-bonus-depreciation-is-back-strategies-for-implementation

Trade press and reviews
- CPA Practice Advisor reviews: 2020 https://www.cpapracticeadvisor.com/2020/08/14/2020-review-of-bloomberg-tax-accounting-fixed-assets/39543/ ; 2019 https://www.cpapracticeadvisor.com/2019/08/14/2019-review-of-bloomberg-tax-fixed-assets/34453/ ; 2018 https://www.cpapracticeadvisor.com/2018/05/18/2018-review-of-bloomberg-tax-fixed-assets/29821/ ; 2017 https://www.cpapracticeadvisor.com/2017/05/22/2017-review-of-bna-fixed-assets/25560/ ; 2016 https://www.cpapracticeadvisor.com/2016/05/24/2016-review-of-bloomberg-bna-fixed-assets/21842/ ; 2009 https://www.cpapracticeadvisor.com/2009/12/01/bna-software-bna-fixed-assets-desktoppro/2580/ ; 2008 https://www.cpapracticeadvisor.com/?p=4225
- CPA Practice Advisor, state bonus features (Feb 2020): https://www.cpapracticeadvisor.com/2020/02/24/new-state-features-for-bonus-depreciation-available-from-bloomberg-tax-accounting/36839/
- CPA Practice Advisor, flip-flop states (Dec 2021): https://www.cpapracticeadvisor.com/2021/12/22/navigating-bonus-depreciation-for-flip-flop-states/46889/
- CPA Practice Advisor, June 2024 FA enhancements: https://cpapracticeadvisor.com/2024/06/24/bloomberg-tax-accounting-enhances-fixed-asset-system/107112
- CPA Practice Advisor, Workpapers launch (Mar 2024): https://www.cpapracticeadvisor.com/2024/03/18/bloomberg-tax-launches-tax-workpapers-to-automate-process/102827/
- CPA Practice Advisor, BNA G/L Integrator SAP certification (2014): https://www.cpapracticeadvisor.com/2014/05/07/bloomberg-bna-fixed-asset-system-integrates-with-sap-erp/15301/
- CPA Practice Advisor, gen-AI research features (Mar 2025): https://www.cpapracticeadvisor.com/2025/03/12/bloomberg-tax-accounting-launches-new-gen-ai-powered-features-for-tax-research/157249/
- CPA Practice Advisor, enhanced AI Assistant (Jul 2025): https://www.cpapracticeadvisor.com/2025/07/25/bloomberg-tax-accounting-adds-enhanced-ai-assistant-features/164925/
- Accounting Today, BNA Fixed Assets Web update: https://www.accountingtoday.com/news/bloomberg-bna-updates-fixed-assets-web-software
- Accounting Today, Innovation Studio / AI Assistant: https://www.accountingtoday.com/news/bloomberg-t-a-innovation-studio-offers-ai-assistant-feature-as-first-offering-of-cutting-edge-solutions
- G2 reviews: https://www.g2.com/products/bloomberg-tax-accounting-fixed-assets/reviews
- Capterra: https://www.capterra.com/p/80374/BNA-Fixed-Assets/ ; https://www.capterra.com/p/80374/BNA-Fixed-Assets/reviews/
- Software Advice reviews: https://www.softwareadvice.com/accounting/bna-fixed-assets-profile/reviews/
- SoftwareConnect: https://softwareconnect.com/reviews/bloomberg-fixed-assets/
- TrustRadius: https://trustradius.com/products/bloomberg-tax/reviews
- Gartner Peer Insights (Bloomberg Tax): https://www.gartner.com/reviews/product/bloomberg-tax
- ITQlick pricing estimate (low reliability): https://www.itqlick.com/fixed-asset-assistant/pricing
- Supergood unofficial Bloomberg Tax API: https://supergood.ai/docs/bloomberg-tax-api

Law and guidance (OBBBA context)
- IRS Instructions for Form 4562: https://www.irs.gov/instructions/i4562
- IRS Notice 2026-11 (bonus, interim guidance): https://www.irs.gov/pub/irs-drop/n-26-11.pdf
- IRS Notice 2026-16 (§168(n) QPP): https://www.irs.gov/pub/irs-drop/n-26-16.pdf
- EY Tax News on Notice 2026-11: https://taxnews.ey.com/news/2026-0250
- BDO, interim bonus guidance: https://www.bdo.com/insights/tax/irs-issues-interim-guidance-on-bonus-depreciation-rules
- KPMG on Notice 2026-16: https://kpmg.com/us/en/taxnewsflash/news/2026/02/notice-2026-16-guidance-special-depreciation-allowance-qualified-production-property.html
- UHY on OBBB 100% bonus guidance: https://uhy-us.com/insights/news/2026/february/guidance-on-obbb-100-bonus-depreciation

Competitor comparators (public docs)
- Thomson Reuters Fixed Assets CS, OBBBA help page: https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/calculation/one-big-beautiful-bill
- Sage Fixed Assets public help (MACRS conventions, v2026.0): https://help-sfa.na.sage.com/en-us/20260/Depreciation/SingleUser/Content/deprmethods/macrs_formula_conventions.htm

---

## 6. Open questions (VERIFY list)

1. **OBBBA implementation status:** Does Bloomberg Tax Fixed Assets model the §168(k)(10) 40%/60% transition election, the acquisition-date versus placed-in-service split, the Notice 2026-11 component election, §168(n) QPP with recapture, and the 2026-indexed §179 limits? When did each ship? (Ask in a demo; request the 2025–2026 release notes.)
2. **SOC reports:** Does a SOC 1 Type II and/or SOC 2 Type II cover Fixed Assets? What are the hosting provider, region, backup and RPO/RTO, and SSO/SAML/SCIM support? (Trust Center access request.)
3. **API:** Is there any customer-accessible API (even private), or only Data Manager files and the Workpapers bridge? What are the field-level import templates?
4. **State and local scope:** How many states have pre-built conformity books? Which **state forms** are produced, as opposed to modification worksheets? Is there any local personal-property-tax output?
5. **Lifecycle edge cases:** GAA and pooled assets, casualty/§1033, intercompany transfers (§168(i)(7)), and how partial dispositions allocate basis.
6. **Retroactive recalculation:** How are prior-period additions and basis changes handled (catch-up versus restatement)? Is the reported reporting bug fixed?
7. **Current pricing and packaging:** asset-count bands, module list (CIP, Inventory, Foreign Currency, Modeling) and suite discounts with Provision and Workpapers.
8. **Book limit and IFRS:** Is the 99-book cap still in place? Is there any native IFRS/IAS 16 component or revaluation support?
9. **AI roadmap for Fixed Assets:** Has anything from the Innovation Studio reached Fixed Assets (for example, asset classification)?
10. **Review data refresh:** Pull the full G2 and Capterra review text (blocked in this session) to quantify complaint frequency.
