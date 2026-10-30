# Form definition — {{FORM}} — revision {{REVISION}}

Build the form definition for {{FORM}} ({{JURISDICTION}}), revision {{REVISION}}, from the
official form and its instructions. Today is {{TODAY}}.

For each line: line number, official caption, data type, the engine output or user input that
populates it, the calculation (referencing other lines), entity types that use it, and any
required attached statement. Where the agency publishes fillable PDFs or e-file schemas, record
the PDF field name and the XML element path for each line.

Note what changed versus the prior revision, and any substitute-form rules (IRS Pub 1167 or the
state's equivalent) that constrain rendering.

Output: Markdown summary plus `form_revision` and `form_line` rows (with `pdf_field` and `efile_xpath`) as CSV,
`status = draft`. Mark anything unconfirmed `VERIFY`.
