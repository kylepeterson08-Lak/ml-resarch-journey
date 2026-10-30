# Research & rules-maintenance swarms

Tax and accounting content is the product's moat and its biggest liability. Every jurisdiction
changes something every year, and one wrong table published to customers costs more trust than any
feature earns. So "swarms" here are a **repeatable content pipeline**, not a one-off research
burst: agents draft, humans with signing authority approve, and nothing reaches a customer's
calculation without a citation, a regression pack, and a reviewer of record.

## Swarm map

| Swarm | Scope | Cadence | Output (staging table) | Human sign-off |
|---|---|---|---|---|
| **Market** | Bloomberg Tax FA, ONESOURCE, CCH, Sage, ERP modules, BPP vendors, new entrants | Quarterly | `research/` reports | Product |
| **Federal tax** | IRC §§167/168/179/197/280F/1245/1250/1231, Treas. Regs., Rev. Procs., Notices, Pub 946 | Per IRS release + annual inflation Rev. Proc. (Oct/Nov) | `reference.asset_class`, `federal_parameter`, `bonus_rule`, `macrs_table` | Tax (CPA/EA/JD) |
| **Federal forms** | 4562, 4797, 4684, 8824, 3115, 8594, 4255, 3468, 3800, 7205, 8908, 4626, 6251, M-1/M-3 | Draft forms (Jul–Oct) → final (Dec–Jan); MeF schema releases | `reference.form_revision`, `form_line` (incl. PDF field, e-file XPath) | Tax + Forms QA |
| **GAAP / IFRS** | ASC 360, 350-40, 410-20, 842, 835-20, 805, 740, 250; IAS 16/36/40, IFRS 5/16 | Per ASU / IASB amendment | `book_def.policy_elections` defaults | Accounting (CPA) |
| **State income tax** ×51 | IRC conformity date, §168(k)/§179/§168(n)/§174A decoupling, add-back/recovery mechanics, state depreciation forms | Each legislative session (Jan–Jun) + DOR guidance; annual form release | `reference.conformity_regime`, `provision_rule`, `addback_rule`, `limit_rule`, `form_line` | State tax reviewer per region |
| **Local / property tax** ×(states × counties) | BPP filing requirements, exemptions, assessor depreciation/trend tables, forms, e-file formats (CA SDR, county portals) | Annual table release (Dec–Feb) + filing season | `reference.assessor_factor`, `bpp_exemption_rule`, `category_map`, `filing_calendar`, `form_line` | Property-tax reviewer |
| **Local income** | NYC, Philadelphia BIRT, Ohio municipal, KY occupational, MO earnings, OR Metro/Multnomah | Annual | `reference.provision_rule` (city-level jurisdictions) | State/local reviewer |
| **Platform** | Cloudflare, Databricks, security/compliance (SOC 1/2, Pub 4557, FTC Safeguards), accessibility (WCAG 2.2, Section 508, PDF/UA) | Semiannual | `docs/` ADRs | Engineering |

## Pipeline for one rule change

```
watch → draft → extract → verify → regress → review → publish
```

1. **Watch.** Scheduled jobs diff IRS "Draft Forms", Internal Revenue Bulletins, state DOR
   "what's new" pages, and assessor table pages; a change opens a GitHub issue labeled by
   jurisdiction.
2. **Draft (research agent).** Reads the primary source and writes a rule proposal: what changed,
   effective dates (valid-time), entity types, citation (pin cite + URL + retrieval date).
3. **Extract (extraction agent).** Converts the proposal to rows for the reference tables in
   `data/databricks/001_rules_catalog.sql`, written to `staging.rule_row` — e.g. a new
   `provision_rule` row with `valid_from` and `treatment = 'ADDBACK_SPREAD'`, plus its `addback_rule`.
4. **Verify (independent verifier agent).** Does not see the drafter's reasoning; is given only
   the citation and the extracted rows and must reproduce them from the source. Disagreement
   blocks.
5. **Regress.** Golden test packs run in CI: published IRS/state examples, prior-year customer-shaped
   fixtures, and table-reproduction tests (as `engine/tests/test_macrs_tables.py` does for Pub 946).
   The PR shows a **"what changed for whom"** impact diff: which test tenants' numbers moved, by how much.
6. **Review (human).** A credentialed reviewer approves the PR. CODEOWNERS maps
   `rules/state/CA/**` → the CA reviewer, etc. The approval is the SOC 1 control evidence.
7. **Publish.** Merge triggers a Databricks job that promotes staging rows to `<env>_rules.reference.*` with a
   new `rule_release_id`. Customer books pin a release; upgrading is an explicit, logged action
   with a preview of the impact.

Agent output is never authoritative. Rows from agents carry `status = 'draft'` until a human
approves; only `approved` rows are visible to production calculations.

## Running a swarm with Claude Code

The research in `research/01–08` was produced by eight parallel agents, one per topic, each
writing a cited report. For maintenance runs, fan out by jurisdiction instead of by topic, and
keep each agent's scope small enough to verify (one state, one form family, or one assessor
district per agent). The prompt templates in `../swarms/` are the starting point; every agent must:

- use primary sources and record pin cites with retrieval dates;
- mark anything unverified `VERIFY` instead of guessing;
- emit rows in the staging schema, not prose only;
- stay inside its jurisdiction (no edits outside its staging partition).

Practical limits seen in the first run: several vendor and Big 4 sites block automated fetches,
and parallel agents share a web-search budget. Size swarms to ≤8 agents per batch and give the
verifier its own budget.

## Accessibility is a content requirement, too

Form outputs are documents people with disabilities must be able to read, review and sign.
Every rendered PDF needs a tagged structure (PDF/UA), a reading order matching the official form,
and field labels that make sense to a screen reader. That is a QA step in the forms swarm, not a
late engineering fix.
