# GitHub Inside Out

An interactive field guide to Git and GitHub. It is unofficial and is not
affiliated with GitHub.

- **Four tracks.** Basics, Intermediate, Advanced, Expert. 34 lessons, about
  ten hours of material.
- **Four lenses.** Every core idea is explained four ways: everyday, legal
  and tax, ML research, and technical.
- **Four tools.** Every task has steps for the browser, a phone, the command
  line, and an editor with AI tools.
- **Four reading modes.** Skim, Learn, Do, Test.
- **A practice lab.** Real Git commands against a simulated repository, with
  a live commit graph. Thirteen guided labs and a free-play sandbox. The
  simulator covers three-way merges, interactive rebase with a plan editor,
  `.gitignore`, and GitHub's large-file limit.
- **A workflow reader.** Paste a GitHub Actions workflow. It explains the
  file, flags risks with a link to the lesson that covers each one, and
  shows which jobs would run for a push, a pull request or a fork.
- **Review tools.** Sixteen drills, spaced-repetition flashcards, a
  searchable cheat sheet with risk ratings, a glossary, and progress tracking.
- **Adaptive defaults.** The lens rotates from lesson to lesson, steps follow
  your screen, and a finished lesson reopens in Skim. Each can be pinned.
- **Step view.** One part of a lesson per screen, with Back and Next.

## Run it

You need Python 3.9 or newer. Nothing to install.

```bash
python3 github-guide/tools/serve.py
```

Open <http://127.0.0.1:8000>. The server rebuilds when you edit a file, so a
browser refresh shows the change.

To build without serving:

```bash
python3 github-guide/tools/build.py             # writes github-guide/dist/
python3 github-guide/tools/build.py --offline   # also writes dist/offline.html, one self-contained file
```

`dist/offline.html` opens straight from disk with no server, which is handy
on a plane or for sending to someone.

## How it fits together

```
github-guide/
├── content/                 the guide itself, as data
│   ├── tracks.json          the curriculum: tracks, order, titles
│   ├── lessons/<track>/     one JSON file per lesson
│   ├── drills/<track>.json  decision drills
│   ├── labs.json            practice-lab scenarios
│   └── placement.json       the "where should I start" check
├── src/                     the site that renders the data
│   ├── index.html           one page shell
│   ├── css/                 design tokens, themes, components
│   └── js/                  renderer, Git simulator, graph drawing, progress
├── tools/                   Python, standard library only
│   ├── validate.py          checks every content file against the rules
│   ├── build.py             validates, merges content, writes dist/
│   └── serve.py             local preview with rebuild on change
├── tests/                   Python and JavaScript tests
├── examples/                runnable code the lessons refer to
└── docs/AUTHORING.md        how to write or fix a lesson
```

Each language has one job:

| Language | Job |
|---|---|
| JSON | Holds every lesson, lab, drill and question. |
| Python | Validates the content, builds the site, serves a preview, tests contrast. |
| JavaScript | Renders lessons from the data and runs the practice lab. No framework. |
| CSS | Design tokens, light and dark themes, layout. |
| HTML | One page shell with landmarks and dialogs. |
| YAML | The GitHub Actions workflow that tests and publishes. |
| Markdown | This file and the authoring guide. |

The glossary, the cheat sheet and the flashcard deck are not written by hand.
They are assembled from the `terms` and `commands` each lesson declares, so
they cannot drift out of date.

## Change a lesson

Lessons are plain JSON. Fixing a typo is a one-line edit.

1. Create a branch.
2. Edit a file under `content/`. The rules are in
   [`docs/AUTHORING.md`](docs/AUTHORING.md).
3. Check it: `python3 github-guide/tools/validate.py`
4. Open a pull request. The workflow validates, builds and tests your change.
5. Merge. The site redeploys.

That loop is the one the guide teaches, which is the point.

## Tests

```bash
python3 -m unittest discover -s github-guide/tests -v
node --test github-guide/tests/*.test.js
```

- **Content.** Every lesson must pass the validator in strict mode.
- **Contrast.** Every text and control color pair in `tokens.css` is checked
  against WCAG 2.2 AA in all four themes.
- **Simulator.** The Git simulator's merge, rebase, interactive rebase,
  reset, stash, ignore rules and remote behavior are tested command by command.
- **Workflow reader.** The YAML parser and the workflow analyzer are tested
  rule by rule, and against every workflow example in the lessons.
- **Labs.** Each lab is replayed with its own suggested commands. A lab whose
  steps cannot be completed fails the build.

## Publish it

The workflow in [`.github/workflows/guide.yml`](../.github/workflows/guide.yml)
runs on every push that touches the guide. It validates, builds and tests.
On `main` it also deploys to GitHub Pages.

One-time setup: in the repository, open **Settings**, then **Pages**, and
under **Build and deployment** set **Source** to **GitHub Actions**.

A Pages site for a public repository is public on the internet.

## Accessibility

The guide is built to WCAG 2.2 AA targets:

- contrast is enforced by a test, in light, dark and high-contrast themes
- every control works from the keyboard and has a visible focus ring
- nothing depends on color alone: tracks have letters, statuses have words
- diagrams carry a text version
- text size, spacing, contrast, motion and typeface are adjustable
- touch targets are at least 24 by 24 CSS pixels

If something gets in your way, that is a defect. Please open an issue.

## Limits

GitHub changes often. Where the interface disagrees with a lesson, trust the
interface and the linked official documentation. Legal and tax notes are
general information and are not advice for your situation.

No license has been chosen for this repository yet. Until one is added, the
default applies: others may read the code and may not reuse it. The lesson
"The non-code layer" explains how to choose.
