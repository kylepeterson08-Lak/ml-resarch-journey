# Business personal property — {{STATE}}{{ / COUNTY}} — assessment year {{YEAR}}

Research business personal property (BPP) tax compliance for {{STATE}} ({{COUNTY or "statewide"}})
for the {{YEAR}} assessment/lien date. Today is {{TODAY}}.

Find, with a primary-source citation (comptroller/DOR/assessor page or published schedule) and a
retrieval date:

1. Whether BPP is taxable, exemption thresholds, and exempt categories (inventory, freeport,
   pollution control, etc.).
2. Return/rendition form name, number, revision; filing deadline; extensions; penalties.
3. Valuation method: cost × trend/percent-good factors by asset category and year of acquisition,
   assessment ratio, minimum value floors. Capture the full factor table.
4. Category mapping: how assessor categories map to common asset types (computers, furniture,
   machinery, leasehold improvements, vehicles).
5. Reporting of leased equipment (lessee/lessor), CIP, fully depreciated assets, disposals.
6. E-file format or portal and whether computer-generated substitute forms are accepted.

Output:
- A short Markdown note with citations.
- `assessor_factor` rows (jurisdiction_id, category_code, acquisition_year, factor,
  assessment_year), plus `bpp_exemption_rule`, `category_map` and `filing_calendar` rows, as CSV, `status = draft`.
- Mark unconfirmed cells `VERIFY`.
