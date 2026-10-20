---
name: learn
description: Use when the user runs /learn or asks to understand, learn from, or get a visual explanation of what they just built or changed. Analyzes the session and git diff, writes a lesson JSON, and renders it as a browser page with architecture and flow diagrams, design patterns, DB and cache notes, and a quiz.
---

# learn

Turn the work the user just did into a short, visual lesson that opens in their browser.

You write **only a JSON file**. `render.mjs` (in this skill's base directory) injects it into `template.html` and opens the page. Never hand-write HTML for the lesson.

## Step 1: Pick the scope

Read the arguments:

| Argument | Scope |
|---|---|
| (none) | What was built or changed in this conversation. If the conversation has no code work, fall back to the uncommitted diff, then the current branch vs its base. |
| `last-commit` | `git show HEAD` |
| `<git-range>` such as `main..HEAD` | `git diff <range>` and `git log <range>` |
| `<path>` | That file or folder, as it exists now |
| `challenge [scope]` | Practical exercises about the session or the supplied scope, such as `challenge last-commit` or `challenge src/payments` |
| `--level junior\|mid\|senior` | Depth of explanation. Default `mid`. |

## Step 2: Gather facts

Run only what the scope needs:

```bash
git status --short
git diff --stat <base>      # base: merge-base with main/master, or HEAD for uncommitted
git diff <base> -- <file>   # for the files that matter
git log --oneline -n 20 <range>
```

Read the changed files that carry the design (entry points, services, repositories, schemas, config, migrations). Skip lockfiles, generated code and snapshots.

For `challenge`, strip that keyword before resolving the scope using the table above. Generate a short summary plus 1–3 practical challenges, with relevant snippets. Other lesson sections are optional in this mode. Do not modify project code or run the proposed exercises.

Every claim in the lesson must point at real code. If you are not sure a pattern is present, leave it out.

## Step 3: Write the lesson JSON

Write it to a temp file (for example `<scratchpad>/learn.json`). Schema:

```json
{
  "title": "Short name of what was built, e.g. 'Rate-limited checkout API'",
  "level": "junior | mid | senior",
  "tldr": ["3 lines max. What it is, how it works, why it matters."],
  "pitch": "How the user would explain this to a colleague in 30 seconds, first person.",
  "stack": ["Spring Boot", "PostgreSQL", "Redis"],
  "snippets": [
    {
      "path": "src/api/checkout.ts",
      "startLine": 12,
      "language": "typescript",
      "code": "Exact contiguous source text copied from the file.",
      "explanation": "What this excerpt demonstrates and why it matters."
    }
  ],
  "challenges": [
    {
      "title": "Prove retries are safe",
      "task": "Predict the result of two requests with the same key, then write a test that checks it.",
      "where": ["src/api/checkout.ts:12"],
      "hints": ["Find where the key is claimed.", "Check how the existing response is retrieved."],
      "checks": ["Assert that only one order is stored.", "Check the response for each request."],
      "solution": "Describe the expected behavior supported by the actual implementation and a concrete way to test it."
    }
  ],
  "files": [{ "path": "src/api/checkout.ts", "role": "HTTP entry point", "change": "added | modified | deleted" }],
  "architecture": {
    "mermaid": "flowchart LR\n  client[Browser] --> api[Checkout API]\n  api --> db[(Postgres)]",
    "notes": ["One line per non-obvious arrow or box."]
  },
  "flows": [
    {
      "name": "Place an order",
      "mermaid": "sequenceDiagram\n  participant C as Client\n  participant A as API\n  C->>A: POST /orders",
      "steps": ["Plain-language walkthrough, one line per hop."]
    }
  ],
  "patterns": [
    {
      "name": "Repository",
      "category": "design pattern | architecture | concurrency | resilience | data | testing",
      "what": "One sentence: what the pattern is, in general.",
      "here": "One or two sentences: how THIS code uses it.",
      "where": ["src/repo/OrderRepository.ts:12"],
      "tradeoffs": { "pros": ["..."], "cons": ["..."] }
    }
  ],
  "data": {
    "erMermaid": "erDiagram\n  ORDER ||--o{ ORDER_LINE : contains",
    "tables": [{ "name": "orders", "why": "..." }],
    "cache": [{ "key": "cart:{userId}", "ttl": "15m", "strategy": "cache-aside", "why": "..." }]
  },
  "concepts": [{ "term": "Idempotency key", "explain": "Two sentences max, plain words." }],
  "seniorQuestions": [{ "q": "What happens if Redis is down?", "a": "Short answer grounded in this code." }],
  "quiz": [
    {
      "q": "Why does checkout write to the DB before publishing the event?",
      "options": ["...", "...", "...", "..."],
      "answer": 1,
      "why": "One sentence."
    }
  ],
  "resources": [{ "title": "Martin Fowler: Repository", "url": "https://martinfowler.com/eaaCatalog/repository.html", "kind": "article | docs | video | book" }]
}
```

Rules:

- Only `title` and `tldr` are required. **Omit any section that does not apply** (no DB work means no `data`). An empty section is worse than a missing one.
- `where` entries are repo-relative `path:line`. They become clickable editor links.
- Snippets may appear at the lesson root, inside a pattern, or inside a challenge, using the same shape above. Include 1–3 useful excerpts of roughly 5–20 lines when source is available. Copy exact contiguous source text, use its actual starting line and repo-relative path, and explain it beside the excerpt. Never invent code or line numbers, silently omit lines, or include credentials. Omit excerpts when source is unavailable.
- Normal lessons should include one practical challenge when the scope supports a useful exercise. Challenge mode should include 1–3. Each challenge needs a concrete task, 1–3 increasingly specific hints, a solution grounded in the code, and observable checks. Include source links where relevant. Distinguish current behavior from proposed changes; do not assume protections exist. Adapt difficulty to `level`.
- Challenges are self-guided exercises. The page reveals hints and a solution but does not execute code or grade free-text answers.
- Size: 2-6 patterns, 3-8 concepts, 3-5 quiz questions, 2-4 senior questions, 3-6 resources. Quality over count.
- Resources must be real, stable URLs you are confident exist (official docs, martinfowler.com, refactoring.guru, MDN, the library's own docs). No invented links.
- Match `level`: junior explains every term, senior focuses on trade-offs and failure modes.
- Write plainly. Short sentences. No marketing tone.

### Mermaid rules (the page breaks on invalid syntax)

- Use `flowchart LR` or `flowchart TD`, `sequenceDiagram`, `erDiagram`, `classDiagram`, `stateDiagram-v2`.
- Node ids are plain words (`api`, `orderSvc`). Put labels in brackets: `api[Order API]`. Use `[(DB)]` for databases, `[[Queue]]` for queues.
- Quote labels that contain punctuation: `api["POST /orders (v2)"]`.
- No `%%{init}%%` blocks and no `click` or `style` directives. The page themes diagrams itself.
- Keep each diagram under about 15 nodes. Split big systems into architecture plus flows.

## Step 4: Render and open

```bash
node "<skill-base-dir>/render.mjs" "<path-to-learn.json>"
```

The script validates the JSON, writes `.learn/<date>-<slug>.html` in the current repo, updates `.learn/index.html` (lesson history), and opens the page in the default browser. Flags: `--out <dir>` to change the output folder, `--no-open` to skip opening.

If it prints a validation error, fix the JSON and run it again.

## Step 5: Reply in the terminal

Keep it to three lines:

1. The path of the generated page.
2. The one-sentence TL;DR.
3. Suggest adding `.learn/` to `.gitignore` if it is not already ignored.
