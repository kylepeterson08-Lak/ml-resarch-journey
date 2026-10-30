# Fixed-Assets SaaS — research & prototype workspace

A sandbox for designing a cloud fixed-asset platform in the class of Bloomberg Tax Fixed Assets:
one asset register, many books (GAAP, IFRS, federal tax, AMT, E&P, every state, local
personal property), with rules held as effective-dated data and output to federal, state and
local forms.

Target stack: **GitHub** (code, CI, rule-change review) → **Cloudflare** (edge, WAF, Zero Trust,
Workers/Pages) → **Databricks** (Unity Catalog/Delta for rules, jurisdiction mappings, tenant data,
pipelines; Lakebase/Postgres for interactive edits — see `docs/architecture.md`).

> Status: research + engine prototype. Nothing here is tax advice, and no output is fit to file.
> Rule rows marked `verify` have not been signed off against primary sources.

## Layout

| Path | What it is |
|---|---|
| `research/` | Swarm research reports — start with `00-synthesis.md`, then 01–08 by topic |
| `docs/` | `architecture.md` (decisions + data model), `roadmap.md`, `swarm-playbook.md` |
| `swarms/` | Prompt templates for per-jurisdiction research / verification agents |
| `engine/` | `fa_engine` Python package: MACRS, §179, bonus, dispositions, recapture (59 tests) |
| `data/lakebase/` | Postgres system-of-record schema with RLS + isolation tests |
| `data/databricks/` | Unity Catalog DDL (rules catalog, tenant catalog) and the batch recalc job |
| `edge/cloudflare/` | API Worker: JWT → tenant → RLS-scoped Postgres; calc proxy |
| `forms/` | Form definitions keyed by semantic key; Form 4562 Part I fill |

## Engine quick start

```bash
cd engine
pip install -e ".[dev]"
pytest -q
```

```python
from datetime import date
from decimal import Decimal as D
from fa_engine import Asset, Convention, FederalRules, Method, depreciation_schedule

rules = FederalRules.load_default()
asset = Asset(
    asset_id="EQ-1",
    cost=D("50000"),
    acquired=date(2025, 3, 1),
    placed_in_service=date(2025, 3, 1),
    recovery_years=D(7),
    method=Method.DB200,
    convention=Convention.HALF_YEAR,
    bonus_rate=rules.bonus_rate(date(2025, 3, 1), date(2025, 3, 1)),  # 100% after P.L. 119-21
)
for row in depreciation_schedule(asset):
    print(row.tax_year, row.bonus, row.depreciation, row.net_book_value)
```

What the engine covers today:

- MACRS rates for 200DB / 150DB / SL with the switch to SL; HY, MQ, MM conventions; 12-month
  fiscal years. Table mode reproduces Pub 946 Tables A-1, A-2, A-5 and A-6 and is tested against
  them; Table A-7a (39-year), which was not built by formula, is loaded as data.
- Basis ordering: business-use % → §179 → bonus → MACRS.
- §179 limitation exactly as Form 4562 Part I lines 1–13 (phase-out, income limit, carryover).
- Bonus rate by acquisition and placed-in-service dates, including the P.L. 119-21 cutoff (Jan 19/20, 2025).
- Mid-quarter 40% test.
- Year-of-disposition depreciation; gain/loss character split into §1245, §1250 (additional depreciation),
  §291 (C corps), unrecaptured §1250 (non-corporate), and §1231; Form 4797 part routing.

Known gaps (tracked in `docs/roadmap.md`): short tax years, ADS tables loaded from data, §280F caps,
long-production-period bonus, §168(n), partial dispositions, GAA, AMT/E&P/state books, GAAP methods.

## Running everything

```bash
pip install -e "engine[dev]" pandas
(cd engine && python -m pytest -q)
(cd forms && python -m pytest -q tests)
(cd data/databricks/jobs && python -m pytest -q)
psql -v ON_ERROR_STOP=1 -f data/lakebase/001_core.sql -f data/lakebase/tests/001_isolation_test.sql  # scratch DB
(cd edge/cloudflare && npm ci && npm run typecheck)
```

## Moving this into its own repository

This folder is self-contained. Once a dedicated repo exists:

```bash
git subtree split --prefix=fixed-assets-saas -b fixed-assets-saas-export
git push <new-repo-url> fixed-assets-saas-export:main
```

The CI workflow lives at `.github/workflows/fixed-assets.yml` in this repo; copy it to the
new repo's root and drop the `fixed-assets-saas/` prefix from its paths.
