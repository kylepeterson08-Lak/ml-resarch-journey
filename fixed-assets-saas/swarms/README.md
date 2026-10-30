# Swarm prompt templates

Fill the `{{placeholders}}`, give one template to one agent, and keep the scope to a single
jurisdiction or form family. See `../docs/swarm-playbook.md` for the pipeline these feed.

| Template | Fan-out unit | Writes |
|---|---|---|
| `state-conformity.md` | one state × one tax year | `reference.conformity_regime`, `provision_rule`, `addback_rule`, `limit_rule` |
| `assessor-factors.md` | one state's BPP regime (or one county where it differs) | `reference.assessor_factor`, `bpp_exemption_rule`, `category_map`, `filing_calendar` |
| `form-revision.md` | one form × one revision | `reference.form_revision`, `reference.form_line` |
| `verifier.md` | one drafter's output | verdict per row |

Every row an agent proposes goes to `<env>_rules.staging.rule_row` (`target_table` names the
reference table, `row_json` holds the row, `status = draft`); see `data/databricks/001_rules_catalog.sql`.
