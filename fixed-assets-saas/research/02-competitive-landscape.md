# 02 — Competitive Landscape (excluding Bloomberg deep-dive)

*Research date: 2026-10-30. Scope: fixed-asset (FA) depreciation, tax/GAAP books, compliance forms, business personal property (BPP) tax, lease and cost-segregation adjacencies, and new entrants from 2024 to 2026. Bloomberg Tax Fixed Assets appears only as a comparison column; another agent covers it in depth.*

**Confidence key:** **[H]** = confirmed in a vendor or primary source this session. **[M]** = confirmed only in secondary or older sources, or in a search summary of a vendor page. **[L]** = inference or a single weak source. **VERIFY** = not confirmed this session; check before relying on it.

**Method and limitations.** Direct page fetches to `tax.thomsonreuters.com` and `wolterskluwer.com` were blocked by this environment's network allow-list. After that, the swarm-wide web-search budget (200 calls per turn) ran out partway through. Many claims therefore rest on search-engine summaries of vendor pages rather than full page reads. Profiles of CoStar, PowerPlan, Corptax, Lacerte and ProConnect, and all Bloomberg pricing, draw on prior knowledge and are flagged VERIFY.

---

## 1. Executive summary

1. **The market splits into four silos, and no vendor covers the whole lifecycle in one cloud data model.** The silos are:
   - (a) tax-and-accounting suites: Thomson Reuters (TR), Wolters Kluwer (WK), Sage, Bloomberg
   - (b) ERP asset modules: NetSuite, SAP, Oracle, Microsoft, Workday, Sage Intacct
   - (c) property-tax compliance: CSC PTMS, Ryan (which bought ONESOURCE Property Tax from TR), Avalara (via CrowdReason)
   - (d) physical tracking and lease tools: Asset Panda, AssetWorks, FinQuery, Visual Lease/CoStar

   Corporate tax teams pass data between silos through spreadsheets. A Bloomberg customer case study says its property-tax team had to "dig manually" into FA records because of how book assets are recorded. **[M]**
2. **The CPA-firm incumbents run on desktop software.** TR Fixed Assets CS and CCH ProSystem fx Fixed Assets are Windows products. Their "cloud" is hosted remote access, with Fixed Assets CS hosted on Azure. **[M]** The two integrate tightly with their own tax engines (UltraTax CS, GoSystem Tax RS, CCH ProSystem fx Tax, CCH Axcess), but even inside one vendor the links are lossy: the Fixed Assets CS to GoSystem Tax RS import drops individual asset detail and does not carry state depreciation. **[H, TR help]**
3. **ERP modules keep tax books but rarely produce forms.** Dynamics 365 Finance users report no Form 4562 or 4797 output. **[M]** Oracle Fusion users report gaps in 4562 bonus reporting and MACRS rate tables that do not match the IRS. **[M]** NetSuite's alternate tax methods do not post to the GL. **[H]** Workday supports "nonaccounting" federal, state, AMT and ACE books, but no tax forms were found. **[M]** That gap is why NetSuite ISV Netgain built a tax engine.
4. **The most important new entrant is Netgain.** It launched NetAsset (ERP-native FA) in October 2024 and **NetAsset Tax Pro** for accounting firms on 2025-11-19, and claims a top-10 US accounting firm chose it for tax year 2026. **[H for the launch; claim is vendor-stated]** Netgain publishes a "Sage cutover" guide, so it is targeting Sage migrations directly. **[M]** AI-native ERPs such as DualEntry and Rillet are adding FA modules; DualEntry claims "IRS-ready 4562 and 4797 reporting." **[M, marketing]**
5. **Property tax is consolidating into a few players.** Ryan bought TR's ONESOURCE Property Tax line (about 600 clients, 2022-09-19). Avalara bought CrowdReason's assets (October 2021; content from more than 20,000 assessors and collectors). CSC's PTMS says it serves "50% of the Fortune 100." Altus bought itamlink (2022). **[H/M]** E-filing of BPP returns is still largely paper or county-portal based: 38 states plus DC require returns, and county forms are non-standard in states such as Idaho, New Mexico, Maine and Rhode Island. **[M]**
6. **The 2025 federal law change (OBBBA) is a forcing function.** It made 100% bonus depreciation permanent for property acquired after 2025-01-19 and created a new elective 100% allowance for qualified production property under §168(n). Interim guidance (Notice 2026-16) came in February 2026, and most states had not addressed conformity. **[H, PwC/CBIZ]** Sage shipped an OBBBA update on 2025-08-28. **[H]** Constant federal/state decoupling makes a rules-as-data engine with effective dates valuable.

**The three most defensible bets** (details in section 4):
- (1) One asset ledger, from book through federal, state and local depreciation to BPP returns.
- (2) A "convert-and-prove" migration factory that recomputes legacy registers to the penny.
- (3) A versioned, cited rules and conformity engine with SOC 1-grade audit trails, delivered as an ERP and tax-engine sidecar.

---

## 2. Vendor profiles

### 2.1 Thomson Reuters

**Fixed Assets CS** (CS Professional Suite)
- **Segment:** CPA firms (multi-client) and some small businesses. **[H]**
- **Deployment:** Windows desktop; cloud only as hosted remote access (Virtual Office CS/SaaS, listed as hosted on Microsoft Azure with 99.9% uptime). **[M]**
- **Books and methods:** "unlimited number of treatments"; MACRS, ACRS, SL, SYD, units of production, amortization, 200/150/125% DB, bonus, plus **up to 99 user-defined methods**. **[H, TR help]** MACRS assets that span a short year revert to a formula calculation, and there are no tables for MACRS 150% or ADS. **[H, TR help]**
- **Integrations:**
  - UltraTax CS: assets entered during the year are already in the return when it is opened; state adjustments and apportionments flow automatically. **[H]**
  - Accounting CS: monthly, quarterly or annual journal entries. **[H]**
  - GoSystem Tax RS: export of summary data only (federal 4562 summary; no individual asset detail; no state depreciation); the import overwrites existing return depreciation; references to 65,000 assets. **[H]**
  - Exports to Excel, ASCII and DIF. **[M]**
- **Forms:** 4562 and 4797 via UltraTax. **[M]**
- **Pricing:** quote only. **[H]**
- **Sentiment:**
  - Capterra 4.5 from 19 reviews (small sample). **[M]**
  - Older complaints: lengthy setup, no audit trail, inability to import assets with certain methods. **[M, dated]**

**UltraTax CS / GoSystem Tax RS depreciation.** UltraTax has a built-in depreciation module (its own MACRS/ACRS assumptions help page), so small clients often never touch Fixed Assets CS. **[M]** GoSystem Tax RS is the corporate and partnership engine for large firms and relies on imports. **[H]**

**ONESOURCE.** No standalone US "ONESOURCE Fixed Assets" product was found. **VERIFY.** ONESOURCE Corporate Tax (in Australia) has a fixed-asset workpaper with a newly added FA import. **[M]** TR **sold ONESOURCE Property Tax to Ryan in September 2022.** **[H]** As a result, TR's corporate customers have no first-party FA-to-property-tax path.

### 2.2 Wolters Kluwer

**CCH ProSystem fx Fixed Assets**
- **Segment:** accounting firms "that manage a large number of client fixed assets." **[M]**
- **Deployment:** desktop. **[M]**
- **Books:** five defaults (Federal, Financial, AMT, ACE, State) plus custom books; no fixed limit on assets or companies. **[M, 2019 review]**
- **Methods:** MACRS, ACRS, SYD, SL, DB, §179, listed autos, units of production, amortization, Indian reservation property. **[M]**
- **Forms:** Form 4797 and disposal gain/loss. **[M]**
- **Import:** Excel/CSV. **[M]**
- **Pricing:** about $2,500 to $3,015 for a single user (2016–2019 reviews; stale). **[L]**

**CCH Fixed Assets Manager (FAM).** WK has a solutions page for it, and its 2024.01000 release notes add a **push of depreciation and retirement data into CCH Axcess**, available only to FAM licensees. **[M]** That suggests FAM is WK's bridge to the cloud Axcess suite. Whether FAM is fully cloud-native is unclear. **VERIFY**

**CCH Integrator** is a cloud corporate-tax platform with direct, indirect, international, employment, CbCR and Pillar Two modules. It has **no property-tax module.** **[M]**

**CCH Tagetik** is CPM and consolidation software. It touches this market only as a provision/close integration endpoint, not as an FA competitor. **[L]**

### 2.3 Sage

**Sage Fixed Assets** (modules: Depreciation, Tracking, Planning, Reporting)
- **Segment:** mid-market to lower enterprise corporates. On G2, 53.8% of reviewers are mid-market. **[M]**
- **Deployment:** Single-user and Network on-premises editions plus **Sage Fixed Assets Cloud**, which is Sage-hosted and has Network-tier features. Cloud sites were updated 2026-01-20. **[H, release notes]**
- **Release cadence:**
  - 2026.0 (2025-08-28): OBBBA changes. **[H]**
  - 2026.1: adds a 50-year estimated-life option for certain US real property. **[H]**
  - 2027.0 (2026-09-29): Message Center, *draft* 2026 Form 4562; final forms planned for 2027.1. **[H]**
- **Forms:** 3468, 4255, 4562, 4626, 4797; GASB 34/35 support. **[M, reseller pages quoting Sage]** More than 50 depreciation methods. **[M]**
- **Planning module:** construction-in-progress, 45+ user-defined fields, one line item split into several assets. **[M]**
- **Tracking module:** barcode inventory and reconciliation. **[M]**
- **Lease:** Sage partnered with LeaseQuery (now FinQuery) in December 2020 instead of building lease accounting in depth. **[H]** A "Sage Fixed Assets Lease" module is not confirmed as current. **VERIFY**
- **Pricing:** conflicting signals. Capterra shows "from $120/user/month," while other estimates range from $84 to $200 per month and $1,500 to $4,000+ per month for enterprise suites. **[L]**
- **Sentiment:**
  - G2 4.2 from 26 reviews; Capterra 4.3 from 159 reviews. **[M]**
  - Praise: handles complex tax situations; flexible fields.
  - Complaints: slow reports, steep learning curve, limited integrations, hard-to-fix errors.

**Sage Intacct Fixed Assets** is cloud-native and claims "unlimited" financial and tax books. **[M, marketing]** A competitor, AssetAccountant, says its tax content is confirmed only for US rules and that prior-period adjustments are not documented. **[L]** Form generation was not confirmed. **VERIFY**

### 2.4 ERP fixed-asset modules

| ERP | Tax-book capability | Forms | Notable gaps / signals |
|---|---|---|---|
| **NetSuite FAM** (SuiteApp) | Multiple "alternate methods" for tax that do **not** post to the GL; group (pool) tax methods; separate book and tax depreciation; revaluation only on accounting methods **[H, Oracle docs]**. FAM also includes lease accounting. **[M]** | No native 4562 confirmed. **VERIFY** | Netgain built **NetAsset Tax Complete / Tax Engine** (tax forms, managed tax years, up to 10 alternate tax schedules). An older document limits rules to MACRS 200, with MACRS 150 and SL loaded by CSV **[M]**. |
| **SAP S/4HANA Asset Accounting** | Parallel depreciation areas (for example, a MACRS M200 area beside US GAAP); a parallel fiscal-year variant for mid-quarter and mid-month conventions; universal parallel accounting changes posting logic for statistical tax areas **[M]**. AI explanations for depreciation keys in S/4HANA Cloud **[L]**. | No US form output found. **VERIFY** | Large SAP shops typically pair it with a specialist tax-depreciation system. **[L]** |
| **Oracle Fusion Assets** | Tax books with their own calendars; bonus rules; delivered 40% bonus methods (support note 2334665.1, updated 2024-08-14) **[M]**. | A Form 4562 BI report exists **[M]**. | Forum reports: 4562 not showing bonus for 40B/60B methods; MACRS 40% rates not matching IRS tables; 80% bonus combination missing; unresolved **[M]**. |
| **Dynamics 365 Finance** | Depreciation books can carry tax. **[L]** | 2024 community post: "doesn't appear to have any US tax forms (4562, 4797)," asking for add-ons, with no replies **[M]**. | Microsoft's NAV guidance said IRS tables are not included **[M]**. |
| **Workday** | Nonaccounting books for federal, state, AMT and ACE; bonus rules only on nonaccounting books; separate rules per book **[H, Workday docs]**. | None found. **VERIFY** | No delivered MACRS profile confirmed. **VERIFY** |

**Takeaway:** ERPs win the book-side system-of-record argument, but they leave the tax side (forms, state conformity, §179 limits, E&P, BPP) to bolt-ons. **[M]**

### 2.5 Asset tracking

**Asset Panda**
- **Segment:** operations and IT asset tracking (mobile barcode/QR, check-in/check-out).
- **Pricing:** custom, per asset or per user; one listing shows a starting price of about $50/month for 5 users; 14-day trial. **[M]**
- **Depreciation:** off by default; one reviewer says straight-line only with no MACRS, while another listing claims MACRS. **VERIFY**
- **Complaints:** slow loading, support quality. **[M]**

**AssetWorks**
- **Segment:** government, K-12 and higher education (40+ years); "fills gaps left by Oracle and PeopleSoft"; GASB-oriented property tracking and depreciation. **[M]**
- No evidence of tax-basis (MACRS) depth. **[L]**
- Relevance: an integration source (physical inventory, tags) rather than a head-on competitor. Public-sector buyers are a different market.

### 2.6 Property-tax compliance

**CSC PTMS**
- Owned by CSC TCI (developing property-tax software since 1993). **[M]**
- Claims 50% of the Fortune 100; targets medium and large multi-jurisdiction corporates. **[M, vendor]**
- **Scope:** return filing, assessment validation, payments, forecasting, accruals, document management; values assets "using the assessor's method." **[M]**
- **Integrations:** Anybill for payments, later extended to returns automation; CoreLogic parcel values (2021). **[M]**
- Sister product LicenseHQ covers business licenses. **[M]**
- A DMA article calls PTMS and ONESOURCE "the two primary players," with PTMS possibly ahead on share. **[L]**

**Ryan (ex-ONESOURCE Property Tax; PTX Tech)**
- Bought TR's ONESOURCE Property Tax and Transfer Pricing lines on 2022-09-19: about 25 staff and 600+ clients. **[H]**
- Bought PTX Tech (jurisdiction data) in 2021. **[H]**
- Claims "largest property tax software provider in North America." **[M, self-claim]**
- Historic ONESOURCE scale: about 30 million assets and 400,000 personal-property returns a year (undated). **[L]**
- Ryan sells software with services (appeals, outsourcing). DMA notes some customers asked about "long-term options" after the sale, which is a switching window. **[L]**

**Avalara Property Tax**
- From CrowdReason's assets plus a valuation advisory business (October 2021); content from more than 20,000 assessors and collectors. **[H]**
- **Coverage:** 50 states for real property, 38 for personal property. **[M]**
- **"Returns Pro" tier:** for midsize filers with 100 to 300 BPP returns, priced by volume. **[M]**
- **E-filing:** Avalara says it is emerging only in places like California, New Mexico, South Carolina and Maricopa County, Arizona; mail is still common. **[M]**
- Runs an explicit "Avalara vs CSC" competitive page. **[H]**
- **Sentiment:** Avalara overall is about 4.0 on G2 (about 825 reviews); there is no property-tax-specific listing; support responsiveness is a recurring complaint. **[M]**

**Others**
- **Altus Group / itamlink** (bought 2022): mostly real-property management. **[M]**
- **Tyler Technologies, Catalis:** build assessor-side e-filing portals; they decide which formats county intake accepts. **[M]**
- **CCH:** no BPP product found. **[M]**

### 2.7 Lease accounting (where it touches FA)

**FinQuery (formerly LeaseQuery)**
- "AI-powered" platform: prepaids and accruals, lease accounting (ASC 842, IFRS 16, GASB 87/96, SFFAS 54, FRS 102) and contract management. **[M]**
- **No FA module.** FinQuery argues that FA modules cannot do finance-lease interest and liability or the single operating-lease cost. **[M]**
- Sage FA partner since 2020. **[H]**

**Visual Lease** (a CoStar brand)
- ASC 842, IFRS 16, FRS 102, GASB 87/96; handles modifications, impairments, subleases and sale-leaseback. **[M]**
- Grant Thornton preferred-vendor agreement; RSM implementation practice. **[M]**
- Software Advice 4.7. **[M]**
- Integration to an FA register depends on "external data preparation." **[L]**
- CoStar Real Estate Manager overlaps with it. **VERIFY**

**Implication:** right-of-use assets and finance-lease amortization belong in the asset ledger. Lease *measurement* is a commodity best handled through integration.

### 2.8 Cost segregation tooling

- **KBKG Cost Seg Pro** (launched November 2025):
  - "AI-powered, self-guided" studies with audit support; descends from the 2016 Residential Cost Segregator.
  - Free trial; pay after seeing the savings.
  - Property types: single-family, multifamily, office, warehouse, restaurant, hotel, self-storage. **[M]**
- **Price signals:** about $495 to $1,000 for AI/DIY studies versus $5,000 to $20,000+ for engineering studies. **[L]**
- **CSSI:** service firm claiming 50,000 to 65,000+ studies. **[L]**
- **Findcostseg:** founded 2026, AI-driven. **[L]**

**Implication:** cost-seg output, a reclassification of a building into 5-, 7- and 15-year property plus the 39-year remainder, often with look-back changes on Form 3115, is a structured import the FA platform should accept natively. It is a partnership opportunity, not a build. **[L]**

### 2.9 AI-native and cloud-native entrants (2024–2026)

- **Netgain NetAsset / NetAsset Tax Pro** (October 2024 / November 2025):
  - Cloud; federal and state depreciation automation; client-access features; "fraction of the cost" of legacy tools.
  - Top-10 firm win claimed. **[H for the launch; claim vendor-stated]**
  - Started NetSuite-native; Tax Pro moves it into the CPA-firm segment.
  - **The nearest analog to this product in the CPA segment. Treat it as the primary new-entrant threat.**
- **DualEntry** (AI-native ERP): AI auto-fill of asset data, AI depreciation schedules, "IRS-ready 4562 and 4797," federal vs state differences, bulk historical import. **[M, marketing]**
- **Rillet** (AI-native ERP; reported unicorn on a $100M Series C): FA module that auto-detects fixed assets on bills and generates schedules. **[M]** One review summary says the FA register is thin. **[L]** Date of the Series C not confirmed. **VERIFY**
- **Campfire** (AI ERP): no FA detail found. **VERIFY**
- **DEPR.ai:** AI suggests asset class and method from purchases for QuickBooks Online users; MACRS, SL and bonus. **[M]**
- **Agent vendors (Beam.ai, Autohive):** generic "fixed-asset agents" for acquisitions, depreciation, inventory reconciliation and impairment. **[L]** These are templates, not content-backed products.

**Read-across:** AI entrants are attacking the *intake* end (classifying invoices into assets, suggesting lives and methods). None shows depth in multi-state conformity, E&P, AMT, BPP returns or audit-grade controls. The defensible layer is the content plus controls, not the AI.

---

## 3. Feature matrices

**Legend:** Y = yes / native; P = partial or via add-on/integration; N = no or not found; ? = unconfirmed (VERIFY). The Bloomberg column is high level only.

### 3.1 Depreciation, books and forms

| Vendor | Deployment | Multi-book (GAAP/IFRS, Fed, AMT, ACE/E&P, State) | State conformity engine | Fed forms (4562/4797/4626/3468) | BPP returns | Primary segment |
|---|---|---|---|---|---|---|
| Bloomberg Tax FA (ref.) | Cloud | Y | Y? | Y | P (separate property-tax book; no BPP return engine confirmed) | Corporate tax, mid–large |
| TR Fixed Assets CS | Desktop + hosted | Y (unlimited treatments) | P (state adjustments to UltraTax) | Y via UltraTax | N | CPA firms |
| TR GoSystem Tax RS | Web | P (imported summary) | N (state depreciation not imported) | Y (in return) | N | Large firms, corporate returns |
| CCH ProSystem fx FA / FAM | Desktop; FAM pushes to Axcess | Y (5 default + custom) | ? | Y (4562/4797) | N | CPA firms |
| Sage Fixed Assets | On-prem + Sage cloud | Y | P? | Y (3468/4255/4562/4626/4797) | N | Mid-market corporates |
| Sage Intacct FA | SaaS | Y ("unlimited" books) | ? | ? | N | Mid-market (Intacct GL) |
| NetSuite FAM (+Netgain) | SaaS | Y (alternate methods, off-GL) | P (Netgain) | N native / Y Netgain? | N | Mid-market (NetSuite) |
| SAP S/4HANA AA | Cloud/on-prem | Y (depreciation areas) | N | N? | N | Enterprise |
| Oracle Fusion Assets | SaaS | Y (tax books) | N | P (4562 BI report, gaps reported) | N | Enterprise |
| D365 Finance | SaaS | P | N | N (users report none) | N | Mid–enterprise |
| Workday | SaaS | Y (nonaccounting Fed/State/AMT/ACE) | N? | N? | N | Enterprise services |
| Asset Panda | SaaS | N (SL only per one review) | N | N | N | Ops / IT tracking |
| AssetWorks | SaaS/hosted | P (GASB) | N | N | N | Public sector / higher education |
| CSC PTMS | ? (VERIFY SaaS) | N (consumes FA data) | N/A | N | Y | Large corporates |
| Ryan (ex-ONESOURCE PT) | SaaS + services | N | N/A | N | Y | Large corporates |
| Avalara Property Tax | SaaS (+ managed returns) | N | N/A | N | Y (38 BPP states) | Mid-market (100–300 returns) |
| FinQuery / Visual Lease | SaaS | N (lease only) | N | N | N | Lease accounting |
| DualEntry / Rillet / DEPR.ai | SaaS, AI-native | P | P (DualEntry fed vs state) | P (DualEntry claims 4562/4797) | N | SMB / startups |

### 3.2 Operations, integration and controls

| Vendor | Physical tracking / barcodes | CIP / projects | Lease (ASC 842) | ERP / GL integration | Tax-engine integration | Public API | AI features | Audit trail / SOX signals |
|---|---|---|---|---|---|---|---|---|
| Bloomberg (ref.) | P | Y? | P? | Y (Automator) | P (Provision/Workpapers) | ? | ? | Y? |
| TR Fixed Assets CS | N | N? | N | Accounting CS JEs | UltraTax, GoSystem (lossy) | N | ? | Weak (older reviews: no audit trail) |
| CCH FA / FAM | N | ? | N | P | ProSystem fx Tax, Axcess (FAM) | N | ? | ? |
| Sage FA | Y (Tracking) | Y (Planning) | P (FinQuery partner) | P (Sage ERPs) | N | N? | N? | P |
| NetSuite FAM | N | P | Y | Native | N | Y (SuiteScript) | N | Y (ERP) |
| SAP / Oracle / Workday | P | Y | Y (ERP lease modules) | Native | N | Y | P (SAP depreciation-key explainer) | Y (ERP) |
| Asset Panda | Y | N | N | P | N | Y? | N | P |
| PTMS / Ryan / Avalara | N | N | N | P (FA imports) | N | P | P (Avalara document management) | P |
| AI-native ERPs | N | N | P (DualEntry) | Native | N | Y | Y (intake/classification) | ? |

**Pattern:** no vendor scores Y on all of book/tax/state depreciation, federal forms, BPP returns, open API and SOX-grade audit trail. Bloomberg comes closest on depreciation but appears to lack BPP return generation. **[L, defer to Bloomberg agent]**

---

## 4. Whitespace and differentiation

### 4.1 Unmet needs, with evidence

1. **One record from the book ledger to the BPP return.** Corporates run depreciation (Bloomberg, Sage, ERP) separately from property tax (PTMS, Ryan, Avalara) and re-key or remap between them: asset class to assessor schedule, location to taxing jurisdiction, original cost to trended cost or percent good. The Bloomberg case study confirms manual digging. **[M]** PTMS's own pitch, "uses the assessor's method," shows that valuation logic lives outside the FA system. **[M]**
2. **State and local conformity at scale.** OBBBA's permanent 100% bonus and §168(n) apply now, and "most states had not addressed" conformity. **[H]** Incumbent links drop state data (GoSystem import), and ERPs have no conformity layer. Each state's decoupling (bonus add-backs, §179 caps, recovery over N years) needs an effective-dated rule with a citation.
3. **True multi-tenant cloud for CPA firms.** Both TR and WK firm tools are desktop or hosted. Netgain's entry, and its claimed top-10 firm win, shows firms will switch for cloud plus price. **[H/M]**
4. **An ERP tax sidecar with forms.** D365 users ask for 4562/4797 add-ons. **[M]** Oracle users report 4562 bonus gaps and table mismatches. **[M]** Workday has tax books but no forms. **[M]** Netgain shows the model works on NetSuite. No one has built it neutrally across D365, Workday, Oracle, SAP and Intacct. **[L]**
5. **Migration that is provable.** Every switch requires reproducing years of historical depreciation across books: bonus elections, §179 carryovers, mid-quarter determinations, ADS, listed property, partial dispositions, general asset accounts. Netgain's "Sage cutover" article signals demand. **[M]** Incumbent tools also have import limits (Fixed Assets CS cannot import some methods). **[M]**
6. **Controls and auditability.** Older Fixed Assets CS reviews cite no audit trail. **[M, dated]** Public companies need immutable change logs, maker/checker controls and SOC 1 Type II reliance. A lakehouse with Delta time travel and Unity Catalog lineage can provide "as-of" recomputation natively. **[L, architecture inference]**
7. **AI at intake, governed by content.** AI entrants classify invoices into assets. **[M]** No one combines that with tangible-property-regulation tests (repair vs improvement, de minimis safe harbor), cost-seg imports, and human approval with an evidence trail. **[L]**

### 4.2 Three most defensible differentiation bets

1. **The "one ledger" for book, federal, state, local and BPP.** One asset ledger with N books in which local property-tax "books" are first-class: assessor schedules, trending/percent-good tables, situs by location, county form templates, and e-file outputs (California SDR/e-SDR, county portals) where they exist. This merges two budgets (FA and property tax) that are currently served by different vendors. Incumbents are separated by M&A history: TR sold ONESOURCE PT, Bloomberg lacks BPP returns, and the property-tax vendors lack depreciation depth. **Defensibility:** high. It needs thousands of jurisdiction forms, valuation factors and annual maintenance, the same content moat Avalara and PTMS built over decades. **[M]**
2. **Convert-and-prove migration factory.** Ingest Sage, Fixed Assets CS, CCH, Bloomberg and ERP exports. Recompute every asset across every book and year, and produce a variance report by asset, book and year with documented opening-balance overrides. Offer it as a fixed-fee or free "parallel-run guarantee." This removes the biggest switching cost, and every conversion adds mapping patterns to a library competitors do not have. **Defensibility:** medium-high, compounding with volume.
3. **A versioned, cited rules engine with SOC 1-grade controls, delivered as a sidecar.** Store depreciation rules, conformity rules and jurisdiction translations as effective-dated data (Unity Catalog/Delta), each with a citation and change log. Recompute any period as of any rule version. Expose it through APIs and connectors to ERPs (NetSuite, Intacct, D365, Workday, SAP, Oracle) and to tax engines (UltraTax, CCH Axcess, GoSystem, Lacerte/ProConnect, ONESOURCE Income Tax, Corptax, all VERIFY integration paths). **Defensibility:** medium-high. SOC 1 Type II plus auditor familiarity takes 12 to 24 months to earn, and that is also a barrier against AI-native entrants.

### 4.3 Where *not* to differentiate

- Lease measurement under ASC 842 is commoditized; integrate with FinQuery, Visual Lease or ERP lease modules instead. **[M]**
- Physical tracking hardware and mobile apps: integrate with Asset Panda, AssetWorks or RFID vendors.
- Engineering-based cost segregation: partner with KBKG-style tools and ingest their output.

---

## 5. Buyer personas and go-to-market

### 5.1 Personas

| Persona | Pain | Incumbents | Buying trigger | Must-haves |
|---|---|---|---|---|
| **Corporate tax department** (Fortune 1000; VP Tax, Director of Tax Technology) | Separate FA and property-tax systems; state conformity; E&P/AMT; provision tie-out | Bloomberg, Sage FA, PowerPlan (utilities; VERIFY), SAP/Oracle tax books + PTMS/Ryan | OBBBA re-modeling; property-tax vendor change (Ryan transition); ERP migration | Provision integration (ONESOURCE Provision, Bloomberg Provision, Corptax, Longview; VERIFY); multi-entity; SOC 1 |
| **CPA firm** (Top 100; tax technology partner) | Desktop tools; per-client data silos; seasonal crunch | Fixed Assets CS, CCH FA/FAM, Sage FA; Netgain Tax Pro (new) | Firm-wide cloud mandate; licensing renewals; staff shortages | Multi-client tenancy; push to UltraTax, CCH Axcess, GoSystem, Lacerte/ProConnect; client portal; per-client pricing |
| **Middle market** (CFO/controller, outsourced tax) | ERP has no tax forms; spreadsheet tax books | Sage FA, NetSuite FAM + Netgain, Intacct FA, spreadsheets | ERP move (to NetSuite or Intacct); first BPP audit/penalty | ERP connector; low price; guided setup; managed BPP filing option (Avalara Returns Pro sets a benchmark) |
| **PE-backed multi-entity** (portfolio CFO, tax VP) | Acquisitions bring heterogeneous registers; ASC 805 purchase-price allocation, §338(h)(10)/§754 step-ups; many ERPs | Mixed (spreadsheets, Sage, ERP modules) | Each add-on acquisition; exit preparation (quality of earnings) | Fast onboarding of acquired registers (bet #2); entity hierarchy; consolidated BPP footprint |
| **Public company (SOX)** (CAO, internal audit, tax) | ITGC reliance; change management on tax content; evidence | Bloomberg, Sage, ERP | Auditor findings; material-weakness risk | SOC 1 Type II, SOC 2; maker/checker; immutable audit trail; as-of recomputation; access reviews |

### 5.2 Go-to-market

- **Two wedges.**
  - **(a) Property-tax wedge for corporates.** Lead with "BPP returns from your FA data." The BPP filing season (January to May; California 571-L due April 1 with a 10% penalty **[M]**) gives a hard deadline.
  - **(b) Cloud-firm wedge for CPA firms.** Lead with cloud multi-client depreciation plus tax-engine push. Netgain is pursuing (b) now.
- **Channels.**
  - ERP marketplaces: NetSuite SuiteApp, Microsoft AppSource, SAP Store, Oracle Cloud Marketplace, Sage Intacct Marketplace. **VERIFY each listing's requirements**
  - Mid-tier CPA firms as implementers. Lease vendors already use this channel: Grant Thornton with Visual Lease, RSM. **[M]**
- **Sales calendar.**
  - Corporate FA decisions cluster before year-end close (Q3–Q4).
  - CPA-firm decisions come after busy season (May–September).
  - Products must be ready before 1040/1120 season (January) and the BPP season (January–April).
- **Switching costs, ranked:** (1) historical depreciation reconstruction; (2) tax-engine and ERP integrations; (3) staff retraining; (4) audit-trail continuity; (5) contract timing, since multi-year enterprise renewals are common (VERIFY).
- **Pricing signals to anchor on:**
  - CCH single-user about $2.5K–$3K (stale). **[L]**
  - Sage FA list about $120/user/month (inconsistent). **[L]**
  - Avalara BPP priced by return volume. **[M]**
  - Netgain "fraction of cost." **[M]**
  - Price per asset band plus per BPP return, with conversion credits.

### 5.3 Regulatory and compliance moats

- **Federal e-file.** FA systems generally do not e-file Form 4562 on their own; the form is attached to the 1040/1065/1120 return transmitted by an IRS MeF-approved software developer and transmitter (TR, WK, Intuit). Becoming one requires IRS e-file application and annual ATS testing (Publication 4164). **VERIFY current requirements.** The near-term moat is the **integration into** those engines, not becoming a transmitter.
- **BPP e-file.** County-by-county:
  - California SDR/e-SDR via calbpsfile.org; 30+ counties on the Megabyte platform; Los Angeles has its own system; batch filing "not aware of any." **[M]**
  - Portals in New Mexico, South Carolina, Maricopa County AZ and Snohomish County WA. **[M]**
  - Virginia counties reject the state form. **[M]**

  Each accepted format is an accreditation-style moat.
- **SOC 1 Type II and SOC 2 Type II.** These are table stakes for corporate and SOX buyers. Assume incumbents have them. **VERIFY per vendor**
- **Content credibility.** Auditors and Big-4 reviewers trust incumbent tables; a single public table error (as in the Oracle MACRS forum threads **[M]**) erodes trust. Publish golden test suites (IRS Publication 946 tables, Rev. Proc. examples) and versioned rule changelogs.

---

## 6. Implications for the product

1. **Data model first.** In Unity Catalog/Delta, model `asset`, `asset_component`, `book` (GAAP, IFRS, Fed, AMT, ACE/E&P, State-N, Local-BPP-N), `rule_version` (effective-dated, cited), `jurisdiction` (state, county, assessor, situs), `election` (bonus opt-out by class and year, §179, §168(n)) and `form_template`. Every computed value should carry `rule_version_id` and `input_snapshot_id` so it can be reproduced as of any date (Delta time travel).
2. **Ship a conformity engine on day 1,** covering post-OBBBA §168(k) at 100%, §168(n) per Notice 2026-16, and state decoupling tables. Make "what changed in your depreciation because of rule X" a first-class report; it doubles as audit evidence.
3. **BPP returns at the MVP for the top 10 BPP states by filer volume** (VERIFY ranking; candidates are TX, CA, FL, GA, VA, NC, IN, MI, AZ, CO). Include California SDR file output and printable county forms. Extend the jurisdiction library through the data pipeline: translations, assessor schedules and trend factors as data, not code.
4. **Build the migration factory before the UI.** Start with parsers for Sage FA, Fixed Assets CS, CCH and Bloomberg exports, plus NetSuite, Intacct and D365 extracts. Pair them with a recompute-and-variance engine and an AI-assisted field mapper that a human approves.
5. **Integrations as product.** Push to UltraTax, CCH Axcess and GoSystem, with *asset detail and state data*, beating the lossy TR-to-TR import. ERP sidecar connectors should carry two-way journal entries and asset sync. Lease and cost-seg imports should use a defined schema.
6. **AI where it is governed.** Use AI for invoice-to-asset classification, MACRS life suggestions with citations, repair vs capitalize triage, and county form field mapping. Gate every AI output behind approval and log it, so SOX reviewers see a control rather than a risk.
7. **Security and compliance roadmap.** Use Cloudflare Zero Trust for tenant and admin access and WAF on public APIs. Start SOC 2 Type II and SOC 1 Type II readiness in month 0, since the first report needs a 6 to 12 month observation window. Build GitHub-based change management for rule content that auditors can sample.
8. **Positioning against Netgain.** Netgain is NetSuite-centric and firm-focused. Compete on ERP neutrality, BPP returns, and corporate SOX features. Watch whether Netgain adds property tax.

---

## 7. Sources

**Thomson Reuters**
- Fixed Assets CS product page: https://tax.thomsonreuters.com/us/en/cs-professional-suite/fixed-assets-cs
- Features of Fixed Assets CS: https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/install/features-of-fixed-assets-cs
- Depreciation features and calculations: https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/install/asset-depreciation-features-and-calculations
- MACRS/ACRS calculation notes: https://cs.thomsonreuters.com/ua/fixa/cs_us_en/calc_depr/macrs_acrs.htm
- GoSystem Tax RS FA integration, get started: https://www.thomsonreuters.com/en-us/help/gosystem-tax-rs/import-export/fixed-assets-and-gosystem-tax-integration/fixed-assets-get-started
- GoSystem Tax RS FA import: https://www.thomsonreuters.com/en-us/help/gosystem-tax-rs/fixed-assets-and-gosystem-tax-integration/fixed-assets-import-data
- Export to GoSystem Tax: https://www.thomsonreuters.com/en-us/help/fixed-assets-cs/integration/export-to-gosystem-tax
- UltraTax MACRS/ACRS: https://www.thomsonreuters.com/en-us/help/ultratax-cs/depreciation/macrs-acrs
- CPA Practice Advisor review (2014): https://www.cpapracticeadvisor.com/2014/09/05/thomson-reuters-fixed-assets-cs/894/
- SoftwareConnect review: https://softwareconnect.com/reviews/fixed-assets-cs/
- Capterra: https://www.capterra.com/p/80494/Fixed-Assets-CS/
- ONESOURCE Corporate Tax FA workpaper (Australia): https://onesourcetraining.thomsonreuters.com.au/au/courses/639-onesource-corporate-tax-nextgen-content-webinar-fixed-assets

**Wolters Kluwer**
- CCH ProSystem fx Fixed Assets: https://www.wolterskluwer.com/en/solutions/cch-prosystem-fx/fixed-assets
- CCH Fixed Asset Manager: https://www.wolterskluwer.com/en/solutions/cch-fixed-asset-manager
- FAM 2024 release notes: https://support.cch.com/updates/fam/pdf/ReleaseNotesFAM2024.01000.pdf
- 2019 review: https://www.cpapracticeadvisor.com/2019/08/14/2019-review-of-cch-prosystem-fx-fixed-assets/34457/
- CCH Integrator: https://wolterskluwer.com/en/solutions/cch-integrator/tax-data-management

**Sage**
- SFA 2026.1 release notes: https://docs.sage.com/docs/en/customer/sfa/26_1/open/SFA_2026_1_ReleaseNotes.pdf
- 2027.0 announcement: https://communityhub.sage.com/us/sage_fixed_assets/f/announcements/274242/sage-fixed-assets-2027-0-has-arrived-work-with-more-confidence
- 2026.0 (OBBBA) announcement: https://communityhub.sage.com/us/sage_fixed_assets/f/announcements/254707/a-new-season-and-a-new-version-of-sage-fixed-assets-is-here
- What's new in 2026.0: https://help-sfa.na.sage.com/en-us/20260/Depreciation/SingleUser/Content/whats_new.htm
- Product tour (reseller): https://www.dsdinc.com/resource/sage-fixed-assets-product-tour/
- G2: https://www.g2.com/products/sage-fixed-assets
- Capterra: https://capterra.com/p/144649/Sage-Fixed-Assets/
- Capterra pricing: https://www.capterra.com/p/144649/Sage-Fixed-Assets/pricing/
- Cloud question (community): https://communityhub.sage.com/us/sage_fixed_assets/f/general-discussion/272532/we-currently-have-sage-fixed-assets-on-a-self-hosted-server-does-sage-offer-the-cloud-based-platform-just-for-sage-fixed-assets-is-so-is-there-an-average-cost-available-to-move-to-the-cloud-based-offering
- Sage Intacct Fixed Assets: https://www.sage.com/en-us/sage-business-cloud/intacct/product-capabilities/extended-capabilities/fixed-assets
- AssetAccountant comparison (competitor): https://www.asset.accountant/sage-intacct-assets-integration/
- LeaseQuery and Sage partnership: https://finquery.com/press-releases/leasequery-sage-partnership-intelligence-asset-technology/

**ERP and ERP ISVs**
- NetSuite FAM overview: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N2126441.html
- NetSuite FAM lease accounting: https://www.getgsi.com/blog/en-us/netsuiteblog/netsuite-now-has-lease-accounting-in-fixed-asset-module
- Netgain NetAsset Tax Complete: https://www.netgain.tech/product-module/netasset-tax-complete
- Netgain tax years: https://support.netgain.tech/article/361424/tax-engine-manage-tax-years
- Netgain tax forms: https://netgain-support.capacity.com/article/158419/netasset---tax-engine--reporting
- Netgain Sage cutover: https://netgain-support.capacity.com/article/959452/netasset---tax-engine--sage-cutover
- Netgain Tax Pro launch: https://www.cpapracticeadvisor.com/2025/11/19/netgain-releases-fixed-asset-tax-depreciation-solution-for-accounting-firms/173551/
- Netgain press release: https://www.netgain.tech/press/netgain-delivers-affordable-fixed-asset-tax-software-for-accounting-firms
- International Accounting Bulletin coverage: https://www.internationalaccountingbulletin.com/news/netgain-fixed-asset-tax-depreciation-solution/
- Netgain 2024 ERP launch: https://www.cpapracticeadvisor.com/2024/10/02/netgain-rolls-out-new-fixed-asset-accounting-solution/151752/
- SAP parallel values: https://sapinsider.org/learn-how-to-maintain-parallel-asset-values-and-post-to-the-sap-general-ledger
- SAP universal parallel accounting: https://blogs.sap.com/2022/10/24/asset-accounting-with-universal-parallel-accounting/
- SAP AI depreciation keys: https://www.openpr.com/news/4625802/bpx-highlights-ai-generated-depreciation-key-explanations-as
- Oracle tax book: https://docs.oracle.com/en/cloud/saas/financials/25d/faias/create-a-tax-book.html
- Oracle support note 2334665.1: https://support.oracle.com/knowledge/Oracle%20Cloud/2334665_1.html
- Oracle MACRS forum thread: https://community.oracle.com/customerconnect/discussion/902687/fusion-assets-macrs-depreciation-method-doesnt-match-to-irs-provided-guidelines
- D365 forms forum thread: https://dynamicscommunities.com/community/groups/dynamicsfoax/forum/topic/tax-depreciation-add-ons-for-forms/
- Microsoft NAV MACRS guidance: https://support.microsoft.com/en-gb/help/2018623/how-to-set-up-modified-accelerated-cost-recovery-system-macrs-deprecia
- Workday depreciation profiles: https://doc.workday.com/admin-guide/en-us/financial-management/business-assets/asset-accounting/depreciation/qhe1675384265701.html
- Workday asset books: https://doc.workday.com/admin-guide/en-us/financial-management/business-assets/asset-accounting/asset-book-population/dan1370796866870.html

**Tracking**
- Asset Panda review: https://fitsmallbusiness.com/asset-panda-review
- Asset Panda on Capterra: https://www.capterra.com/p/142562/Asset-Panda/
- Asset Panda pricing: https://www.getapp.com/operations-management-software/a/asset-panda/pricing/
- AssetWorks: https://www.assetworks.com/active-assets/your-industry

**Property tax**
- Avalara Returns Pro: https://www.avalara.com/us/en/products/property-tax-returns-pro.html
- Avalara Property Tax: https://www.avalara.com/us/en/products/property-tax.html
- Avalara on challenging states: https://www.avalara.com/us/en/blog/personal-property-tax-challenging-states-for-compliance.html
- Avalara vs CSC: https://www.avalara.com/us/en/about/why-avalara/avalara-vs-csc.html
- CrowdReason deal (CPA Practice Advisor): https://www.cpapracticeadvisor.com/2021/10/18/avalara-acquires-crowdreason-to-help-businesses-manage-property-tax-compliance/45841/
- CrowdReason deal (GeekWire): https://www.geekwire.com/2021/avalara-continues-acquisition-spree-purchase-property-tax-compliance-company-crowdreason/
- Avalara on G2: https://www.g2.com/products/avalara/reviews
- Ryan buys ONESOURCE PT (Business Wire): https://www.businesswire.com/news/home/20220919005252/en/Ryan-Acquires-the-Property-Tax-and-Transfer-Pricing-Product-Lines-of-Thomson-Reuters-Expanding-Software-Solutions-and-Services
- Privsource deal record: https://www.privsource.com/acquisitions/deal/WNSE7o
- FinLedger coverage: https://finledger.com/articles/ryan-acquires-thomson-reuters-property-tax-transfer-offerings
- DMA analysis: https://dmainc.com/?p=2142
- Ryan property tax software: https://ryan.com/tax-technology/property-tax
- Ryan buys PTX Tech: https://ryan.com/insights/press-room/ryan-enhances-property-tax-software-solutions-with-the-acquisition-of-ptx-tech
- ONESOURCE PT scale (Nestlé): https://siteselection.com/nestle-uses-nimble-tax-system/
- CSC PTMS: https://cscglobal.com/service/corptax/ptms-property-tax
- CSC PTMS brochure: https://www.cscglobal.com/cscglobal/pdfs/PTMS.pdf
- PTMS and Anybill: https://www.anybill.com/resource/ptms-expands-anybill-integration-to-automate-property-tax-returns
- CSC TCI and CoreLogic: https://www.businesswire.com/news/home/20211104005127/en/CSC-TCI-and-CoreLogic-Collaborate-to-Supply-Customers-with-Automated-Parcel-Values
- Altus buys itamlink: https://www.streetinsider.com/Globe+Newswire/Altus+Acquires+Leading+Property+Tax+Management+Software+itamlink/20018302.html
- California BOE public comment (2023): https://boe.ca.gov/meetings/pdf/2023/202308-TRA-Hrg-PubComm-Rodriguez.pdf
- Sacramento County e-file: https://assessor.saccounty.gov/content/assessor/us/en/sdr-and-esdr/efile-your-business-property-statement.html
- Santa Clara County 571-L: https://www.sccassessor.org/property-information/business-owner/business-property-statement-filing
- Tyler Technologies on e-filing: https://www.tylertech.com/resources/blog-articles/e-filing-streamlines-property-tax-returns
- Bloomberg case study: https://pro.bloombergtax.com/brief/industrial-gas-leader-refines-its-approach-to-fixed-assets-management-with-bloomberg-tax-software/
- Bloomberg 2024 FA enhancements: https://cpapracticeadvisor.com/2024/06/24/bloomberg-tax-accounting-enhances-fixed-asset-system/107112

**Lease**
- FinQuery on FA software and leases: https://finquery.com/blog/fixed-asset-software-lease-accounting/
- Visual Lease (CoStar brand): https://www.costargroup.com/about-us/brands/visual-lease
- Grant Thornton and Visual Lease: https://visuallease.com/grant-thornton-enters-preferred-vendor-agreement-with-visual-lease/
- Visual Lease on Software Advice: https://www.softwareadvice.com/property/visual-lease-profile/
- RSM Visual Lease practice: https://rsmus.com/services/consulting/lease-accounting-visual-lease.html

**Cost segregation**
- KBKG Cost Seg Pro launch: https://www.bentoncourier.com/online_features/press_releases/kbkg-launches-cost-seg-pro-the-next-generation-of-self-guided-cost-segregation-software-for/article_163087ad-b109-5e99-9690-ffdb4d338af1.html
- KBKG Cost Seg Pro: https://www.kbkg.com/csp
- AI and cost seg pricing: https://aijourn.com/will-ai-replace-real-estate-cpas-engineers-the-future-of-cost-segregation-studies/
- Findcostseg: https://www.startuphub.ai/startups/findcostseg.md

**AI-native**
- DualEntry FA: https://www.dualentry.com/core-financials/fixed-asset-management-software
- Rillet FA docs: https://docs.rillet.com/EjmEP4KZ9BVp9j2ho4Mh/general-accounting/fixed-assets
- Rillet Series C: https://www.fintechfutures.com/venture-capital-funding/rillet-reaches-unicorn-status-with-100m-series-c
- AI-native ERP roundup: https://erpresearch.com/en-us/ai-native-erp
- DEPR.ai: https://www.depr.ai/home
- Beam.ai FA agent: https://beam.ai/agents/fixed-asset-agent/

**Regulatory (OBBBA)**
- PwC on bonus and QPP: https://www.pwc.com/us/en/services/tax/library/pwc-ob3-provides-bonus-depreciation-qualified-production-property.html
- PwC on initial QPP guidance: https://www.pwc.com/us/en/services/tax/library/pwc-initial-guidance-released-on-new-deduction-for-qpp.html
- BDO: https://www.bdo.com/insights/tax/one-big-beautiful-bill-act-expands-100-depreciation-expensing-opportunities
- CBIZ: https://www.cbiz.com/insights/newsletters/opportunities-and-uncertainties-with-qualified-production-property-depreciation
- Current Federal Tax Developments: https://www.currentfederaltaxdevelopments.com/blog/2026/2/20/an-analysis-of-the-special-depreciation-allowance-under-the-one-big-beautiful-bill-act
- Grant Thornton: https://www.grantthornton.com/insights/alerts/tax/2025/insights/obbba-offers-new-ways-to-accelerate-depreciation

---

## 8. Open questions (VERIFY list)

1. Does a US **ONESOURCE Fixed Assets** product exist, or is TR's corporate FA strategy now "partner or ERP"? Does TR plan a cloud-native Fixed Assets CS on Onvio or CoCounsel?
2. Is **CCH Fixed Assets Manager** cloud-native within CCH Axcess, and which books and state data does the Axcess push carry?
3. Sage FA Cloud pricing, the status of the Lease module, and Sage Intacct FA form output.
4. Netgain NetAsset Tax Pro: the forms list, state coverage, pricing, the name of the top-10 firm, and any property-tax roadmap.
5. CSC PTMS deployment (SaaS or hosted), pricing, and e-file formats; Ryan's post-acquisition ONESOURCE PT roadmap and renewal terms.
6. Which counties and states accept **bulk or electronic BPP filing** in machine formats (California SDR spec, Texas, Florida DR-405 portals, Georgia, Michigan, Indiana)? What do vendor certifications require?
7. Status of **PowerPlan** (utilities FA/tax/property tax; ownership and roadmap) and **Corptax**'s fixed-asset capability: both are potentially material corporate competitors not researched this session.
8. CoStar's overlap between Visual Lease and Real Estate Manager, and whether either syncs into FA registers.
9. SOC 1 Type II and SOC 2 Type II report availability for each incumbent, and which Big-4 audit methodologies rely on them.
10. State conformity to OBBBA §168(k) at 100% and §168(n) as of tax year 2026 (another agent may own the rules research).
11. Federal §179 limits after OBBBA (believed to be $2.5M with a $4M phase-out threshold; **VERIFY**).
12. Gartner, Forrester or IDC coverage of the fixed-asset or property-tax software category: none found this session.
