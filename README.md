# learn

[![Test](https://github.com/talayash/learn/actions/workflows/test.yml/badge.svg)](https://github.com/talayash/learn/actions/workflows/test.yml)

**Type `/learn` after you build something, and get a visual lesson about what you just did.**

A Claude Code plugin. It reads your session and your git diff, then opens a page in your browser that explains your work: the architecture, how a request moves through it, the design patterns you used (with links to the exact lines), your database and cache choices, the words you should know, and a short quiz.

![The lesson page: title, three-line summary, and section navigation](assets/hero.png)

![An architecture diagram generated from the code](assets/architecture.png)

## Why

You shipped a feature with an AI pair. It works. Could you explain it in a standup, defend it in a design review, or answer "what happens if Redis is down?" in an interview?

`/learn` turns the work you just did into the lesson you would have gotten from a senior engineer walking you through it.

## Install

In Claude Code:

```
/plugin marketplace add talayash/learn
/plugin install learn@learn
```

Requires Node 18 or newer (Claude Code already needs it).

<details>
<summary>Install without the plugin system</summary>

Copy the skill into your personal skills folder:

```bash
git clone https://github.com/talayash/learn
cp -r learn/skills/learn ~/.claude/skills/learn
```

</details>

## Use

| Command | What it explains |
|---|---|
| `/learn` | What you built in this session (falls back to uncommitted changes, then your branch) |
| `/learn last-commit` | The last commit |
| `/learn main..HEAD` | Any git range |
| `/learn src/payments` | A file or folder as it is now |
| `/learn challenge` | Hands-on exercises based on this session, with progressive hints and solutions |
| `/learn challenge last-commit` | Exercises scoped to the last commit; also accepts a path or git range |
| `/learn --level senior` | Same, but focused on trade-offs and failure modes. Also `junior` and `mid` (default). |

Each lesson is saved to `.learn/<date>-<topic>.html` in your repo, and `.learn/index.html` lists every lesson you have generated. Add `.learn/` to `.gitignore` if you do not want to commit them.

## What a lesson contains

Lessons are short on purpose: about 5 minutes of reading. Sections only appear when they apply, so a CSS refactor will not get a database section.

- **Takeaways**: three numbered lines, a 30-second explanation in your own voice, and the files that matter (collapsed)
- **How it fits together**: a diagram of the components and how they connect
- **How a request moves**: sequence diagrams with a plain-language walkthrough
- **Key code**: short, exact source excerpts with file links, line ranges, and explanations
- **Patterns**: cards with the idea, how your code uses it, clickable `file:line` links (they open in VS Code), and trade-offs on demand
- **Data and cache**: ER diagram, why each table exists, cache keys, TTLs and strategy
- **Key terms**, **Quick check** (quiz), **Try it yourself** (a task with hints revealed one at a time and a separate solution), **Senior questions**, **Go deeper** (curated links)

Sticky section bar with reading progress, light and dark themes, set in Atkinson Hyperlegible for easy reading. Works on phones and prints cleanly.

`render.mjs` warns when a lesson runs over its length budget (for example more than 3 patterns or 1,100 words of prose), and the skill trims it before you see it.

## How it works

```
/learn  ->  Claude reads the session + git diff
        ->  writes lesson.json (a fixed schema)
        ->  render.mjs injects it into template.html
        ->  .learn/2026-10-20-checkout-api.html opens in your browser
```

Claude only writes data. The page design lives in one template, so every lesson looks the same and costs fewer tokens than generating HTML each time. Diagrams are [Mermaid](https://mermaid.js.org), rendered in the browser.

**Privacy:** nothing about your code leaves your machine beyond what Claude Code already sends. The generated page loads Mermaid and two Google Fonts from public CDNs; everything else is inline.

## Repository layout

```
.claude-plugin/        plugin and marketplace manifests
commands/learn.md      the /learn slash command
skills/learn/
  SKILL.md             analysis steps and the lesson JSON schema
  template.html        the page: design, diagrams, quiz
  render.mjs           JSON -> HTML, history index, opens the browser
  validate.mjs         nested lesson schema validation
examples/              a sample lesson
tests/                 renderer tests
```

## Try the renderer without Claude

```bash
node skills/learn/render.mjs examples/checkout-api.json
```

Try the challenges and embedded source excerpts:

```bash
node skills/learn/render.mjs examples/renderer-challenge.json
```

## Contributing

Design changes go in `skills/learn/template.html`. Changes to what Claude analyzes go in `skills/learn/SKILL.md`. If you add a field to the schema, update both, plus `examples/checkout-api.json`.

```bash
npm install
npm test
```

Lesson text is always inserted with `textContent`, and the JSON is escaped so it cannot close its `<script>` tag. Please keep it that way; the tests check it.

### Releasing

Releases are automatic. Bump the version in one PR:

```bash
npm run bump -- 0.2.0
```

This sets the same version in `package.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (a test fails if they ever disagree). When the PR is merged and the tests pass on `main`, the Release workflow tags `v0.2.0` and publishes a GitHub Release with notes generated from the merged PRs. Pushes that do not change the version release nothing.

## License

MIT
