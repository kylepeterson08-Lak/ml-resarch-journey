# State conformity research — {{STATE}} — tax year {{TAX_YEAR}}

Research {{STATE}}'s income/franchise-tax treatment of depreciation for tax years beginning in
{{TAX_YEAR}}, for both corporations and individuals/pass-throughs. Today is {{TODAY}}.

Determine, with a primary-source pin cite (statute section, DOR regulation/bulletin, or form
instructions) and a retrieval date for each:

1. IRC conformity type (rolling / fixed-date / selective) and the conformity date.
2. §168(k) bonus: conform, decouple, or partial. If decoupled: add-back %, recovery method
   (e.g., "add back 100%, subtract 20%/yr over 5 years"), and how disposals accelerate the
   remaining subtraction.
3. §179: dollar limit and phase-out the state uses (federal, or a fixed amount).
4. Treatment of P.L. 119-21 provisions: §168(n) qualified production property, §174A, permanent
   100% bonus. Note pending bills separately from enacted law.
5. Forms/schedules that carry the adjustment (name, number, revision), and whether the state
   requires a separate state-basis depreciation schedule.
6. Any difference in basis that changes gain/loss on disposition.

Output:
- A short Markdown note with citations.
- Rows for `conformity_regime`, `provision_rule`, `addback_rule` and `limit_rule` as CSV, using the
  columns in `data/databricks/001_rules_catalog.sql`, with `status = draft`.
- Mark any cell you could not confirm from a primary source as `VERIFY`. Do not guess.
