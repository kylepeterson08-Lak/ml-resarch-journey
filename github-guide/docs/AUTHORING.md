# Writing content for the guide

Every lesson is one JSON file. The site renders it, the validator checks it,
and the build merges all of them into a single data file. You never touch
HTML to add or fix a lesson.

```
content/tracks.json                    the curriculum: tracks, lesson order, titles
content/lessons/<track>/<id>.json      one lesson per file
content/drills/<track>.json            decision drills for a track
content/labs.json                      practice-lab scenarios
content/placement.json                 the "where should I start" check
```

Check your work before committing:

```bash
python3 github-guide/tools/validate.py            # everything
python3 github-guide/tools/validate.py --only basics
```

Zero errors is required. Warnings are a human's call.

The reference lesson is
`content/lessons/intermediate/intermediate-merge-conflicts.json`. When this
document is unclear, copy what that file does.

## Voice

- Second person, present tense, active voice. Short sentences.
- Define a term the first time it appears. Then use the same word every time.
- Say what a thing does before saying what it is called.
- No emoji. No exclamation marks. No "simply", "just", "easy" or "obviously".
- Avoid em-dash asides, "not X but Y" constructions and scare quotes.
- US English. Straight quotes.
- Use realistic names: `main`, `feature/add-eval`, `train.py`, `config.yaml`.
- Never invent a UI label, a command flag or a URL. If you are not sure a
  button is called that, describe where it is instead.
- GitHub changes weekly. Avoid prices, quotas and plan limits. When a feature
  depends on the plan, say "availability depends on your plan" and link the
  docs.

## Inline markup

Text fields accept a small subset. Nothing else is rendered.

| Write | Get |
|---|---|
| `**bold**` | bold, used for UI labels and key terms |
| `*italic*` | emphasis |
| `` `code` `` | commands, file names, branch names |
| `[label](https://…)` | external link, https only |
| `[label](#lesson-id)` | internal link to a lesson, lab or drill id |
| `{{Ctrl}}` | a keyboard key |

No raw HTML. Wrap literal angle brackets in backticks: `` `<file>` ``.

## Lesson fields

| Field | Rule |
|---|---|
| `id` | Same as the file name. Starts with the track id. |
| `track` | `basics`, `intermediate`, `advanced` or `expert`. |
| `title` | Must match `lessonTitles` in `tracks.json` exactly. |
| `minutes` | Honest estimate, 3 to 45. |
| `summary` | The one takeaway, 60 to 340 characters. |
| `outcomes` | 3 to 6 things the reader can do afterward. Start with a verb. |
| `prereqs` | Optional. Lesson ids that come earlier. |
| `lenses` | Exactly four keys, 35 to 135 words each. See below. |
| `sections` | 2 to 7. Each has a `heading` and `blocks`. |
| `howto` | 1 to 3 tasks, each with steps for all four tools. |
| `pitfalls` | 2 to 6 `{trap, fix}` pairs. |
| `lab` | Optional. An id from `labs.json`. |
| `quiz` | 3 to 6 questions. |
| `mission` | `title`, optional `where`, and 3 to 7 `steps`. |
| `terms` | 3 to 8 `{term, def}` pairs. These build the glossary and flashcards. |
| `commands` | 2 to 10 entries. These build the cheat sheet. |
| `links` | 2 to 6 official references. |

Target length is 800 to 1,400 words of body text. Basics lessons can run
shorter. Depth beats length: one worked example is worth three paragraphs.

### The four lenses

Each lens explains the lesson's core idea again, for a different way of
thinking. They are alternatives, so each must stand alone.

- `everyday` uses household or office life. Save points, photocopies, shared
  documents, a filing cabinet.
- `legal` uses legal and tax practice. Redlines and blacklines, document
  management versions, Bates numbering, chain of custody, audit trails,
  workpapers and tick marks, review notes and sign-offs, engagement files,
  amended returns, closing binders, legal holds, records retention,
  segregation of duties. Get the professional concept right. Never give
  legal or tax advice.
- `ml` uses a research workflow. Experiment branches, config files,
  notebooks, datasets, checkpoints, seeds, baselines, ablations, papers.
- `technical` states the mechanism precisely in Git and GitHub terms.

### Blocks

Use a mix. Every lesson needs at least one visual block (`graph`, `flow`,
`compare` or `table`), at least one `reveal`, and at least one `callout`.

```jsonc
{"type": "p", "text": "A paragraph."}
{"type": "list", "items": ["One", "Two"], "ordered": false}
{"type": "code", "lang": "bash", "code": "git status", "caption": "optional", "file": "optional-name.yml"}
{"type": "callout", "kind": "tip", "title": "optional", "text": "…"}
{"type": "table", "head": ["A", "B"], "rows": [["1", "2"]], "caption": "optional"}
{"type": "compare", "items": [{"title": "Merge", "points": ["…", "…"]}, {"title": "Rebase", "points": ["…", "…"]}]}
{"type": "flow", "steps": [{"label": "Working tree"}, {"label": "Staging area", "via": "git add", "note": "optional"}]}
{"type": "graph", "caption": "…", "commits": [{"id": "A"}, {"id": "B", "parents": ["A"]}], "branches": {"main": "B"}, "head": "main"}
{"type": "reveal", "prompt": "Predict: …?", "answer": "…"}
```

- `code` languages: `bash`, `yaml`, `json`, `python`, `diff`, `text`,
  `gitignore`, `markdown`, `toml`, `ini`, `conflict`, `graphql`, `dockerfile`.
  Newlines are `\n`. No trailing newline.
- `callout` kinds: `tip`, `note`, `warn`, `danger`, `law` (legal, tax or
  compliance angle) and `a11y` (accessibility angle).
- `flow`: `via` labels the arrow leading into that step.
- `graph`: list commits oldest first. Each parent must already be listed.
  Optional `msg` per commit, `tags`, `highlight` (commit ids to emphasize),
  and `ghost: true` on a commit that is no longer reachable. `head` is a
  branch name, or a commit id for a detached HEAD.
- `reveal`: a predict-then-check prompt. Ask something the reader can reason
  out, then explain the answer.

### How-to tasks

Each task needs `browser`, `phone`, `cli` and `editor`, each a list of 1 to 9
concrete steps.

- `browser`: github.com on a computer. Bold the exact UI labels.
- `phone`: the GitHub Mobile app where it supports the action. Where it does
  not, say so plainly and give the mobile-browser path or the best
  alternative. Be conservative about what the app can do.
- `cli`: `git` and `gh` commands in backticks, one action per step.
- `editor`: VS Code's Source Control view, the GitHub Pull Requests
  extension, Codespaces or github.dev. Where a coding agent can do the task,
  say what to ask for and what to verify afterward.

If a tool cannot do the task, write one step that says so and names the
alternative. Do not pad.

### Quiz

Four choices is the norm. Distractors must be plausible mistakes a learner
would actually make. `answer` is the zero-based index. `why` explains the
right answer and why the tempting wrong one is wrong. Vary the position of
the correct answer.

### Commands

```json
{"cmd": "git merge --abort", "does": "Cancels a merge in progress.", "kind": "git", "risk": "safe"}
```

- `kind`: `git`, `gh`, `shell`, `key` (keyboard shortcut on github.com),
  `search` (a search qualifier) or `web` (a URL pattern).
- `risk`: `safe` (read-only or trivially undone), `caution` (changes local
  history or needs care), `danger` (can destroy work or rewrite shared
  history).

### Links

Official sources only: `docs.github.com`, `git-scm.com`, `cli.github.com`,
`code.visualstudio.com` and the other hosts listed in `tools/validate.py`.
Prefer a stable section page over a deep link you are unsure of.

## Drills

A drill is a short incident with decision points. File:
`content/drills/<track>.json`, a JSON array.

```jsonc
{
  "id": "drill-leaked-secret",
  "track": "advanced",
  "title": "You pushed an API key to a public repository",
  "minutes": 5,
  "situation": "Set the scene in 2 to 4 sentences. Make it specific.",
  "steps": [
    {
      "prompt": "What do you do first?",
      "choices": [
        {"text": "…", "verdict": "best", "feedback": "Why this is right."},
        {"text": "…", "verdict": "ok", "feedback": "Works, with a cost."},
        {"text": "…", "verdict": "bad", "feedback": "What goes wrong."}
      ]
    }
  ],
  "debrief": "The principle to carry away.",
  "lesson": "advanced-security-features"
}
```

Each step has 2 to 4 choices and exactly one `best`. A drill has 2 to 5 steps.

## Labs

Labs run in the practice terminal. Each step has a `goal`, a `say`
explanation, `suggest` (commands that complete the step, shown as tap
targets), a `check` the simulator evaluates, and optional `hint` and `after`.
The test suite replays every lab's suggested commands and fails if any check
does not pass, so a lab cannot ship broken. See `tests/gitsim.test.js`.
