# Roadmap

Phasing follows `research/08 §10`, launch jurisdictions follow `research/07`, filing path follows
`research/04`. "Done" means implemented here with tests, not production-ready.

## Phase 0 — foundations (weeks 0–6)

- [x] Engine core: MACRS 200DB/150DB/SL, HY/MQ/MM, fiscal years, Pub 946 table reproduction
- [x] Published-table loading (39-yr Table A-7a)
- [x] §179 limitation (Form 4562 lines 1–13), bonus by acquisition date incl. P.L. 119-21
- [x] Dispositions: year-of-disposal convention, §1245 / §1250 / §291 / unrecaptured §1250 / §1231
- [x] Lakebase core schema with RLS, bitemporal book versions, insert-only audit (tested on Postgres 16)
- [x] Unity Catalog DDL: rules catalog (federal, state, local, forms) and tenant catalog with row filters
- [x] Batch adapter (`applyInPandas`) with entity-year mid-quarter step
- [x] Form 4562 Part I fill by semantic key
- [x] API Worker skeleton (JWT → tenant → RLS transaction; calc proxy)
- [ ] GitHub org: branch protection, CODEOWNERS per jurisdiction, OIDC to Databricks/Cloudflare
- [ ] Terraform for Cloudflare + Databricks + AWS KMS/S3 Object Lock; bundles for jobs
- [ ] WISP, security policies, SOC 2/SOC 1 evidence tooling; accessibility design system

## Phase 1 — MVP for ~10 design partners (months 2–6)

Engine gaps to close first:
- [ ] Short tax years (Rev. Proc. 89-15); ADS tables loaded as data; remaining Pub 946 tables
- [ ] §280F listed-property caps (2025: $20,200 / $19,600 / $11,800 / $7,060 — research/03, VERIFY)
- [ ] Long-production-period and aircraft bonus schedules; §168(k)(10) transition election; class elect-out
- [ ] §168(n) qualified production property, with recapture monitor
- [ ] Partial dispositions (Reg. 1.168(i)-8), GAA, like-kind replacement basis (1.168(i)-6), §1231 lookback
- [ ] AMT and E&P books; GAAP methods (SL/DDB/SYD/units, full-month conventions, salvage)
- [ ] Resolve VERIFY: does bonus reduce basis for the mid-quarter 40% test? (research/03 open item 3)

Product:
- [ ] Asset register CRUD, imports (CSV/XLSX → R2 → Auto Loader → validation → Lakebase)
- [ ] Calc on save + what-if; nightly and fleet recalcs; parity CI across pure/Spark/HTTP adapters
- [ ] Reports: rollforward, depreciation expense, audit-trail viewer, 4562 / 4797 official PDF fill
- [ ] Rules workbench (Databricks App), four-eyes release, golden packs, impact diff
- [ ] **Migration factory**: Sage FA, Fixed Assets CS, CCH, Bloomberg exports → recompute → variance report
  (research/02: the main switching cost and a defensible differentiator)

## Phase 2 — breadth and trust (months 6–12)

- [ ] State books for the top 10–15 states (conformity, spread ledgers, CA ADR profile, state §179)
- [ ] BPP returns: **CA** (BOE-571-L, SDR XML, Open Data factors), **TX** (50-144, top ~20 CADs, $125k
  per-location exemption), **FL** (DR-405), **GA** (PT-50P), **NC** listing
- [ ] Local income books: NYC, Philadelphia, Ohio municipal
- [ ] CPA-firm multi-client portfolio; SSO/SCIM; tax-engine export (asset detail + state data)
- [ ] SOC 2 Type II and SOC 1 Type I observation; first VPAT/ACR

## Phase 3 — scale and filing (months 12–24)

- [ ] SOC 1 Type II / SOC 2 Type II reports
- [ ] MI, VA, KY, LA, TN, AZ, CO, WA property tax; annual forms "season" operating model
- [ ] ERP connectors (NetSuite, SAP, Oracle, Workday, Dynamics 365), journal-entry export
- [ ] IRS Software Developer role for MeF schemas; decide on transmitter status
- [ ] IFRS book (components, revaluation, impairment reversal) if design partners need it
