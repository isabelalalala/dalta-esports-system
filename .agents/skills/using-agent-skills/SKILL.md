---
name: using-agent-skills
description: Discovers and invokes agent skills. Use when starting a session, or when you need to decide which skill or workflow applies to the piece of work at hand. This is the meta-skill that governs how all other skills are discovered and invoked.
---

# Using Agent Skills

## Overview

Agent Skills is the local catalog of workflow, domain, vendor, and mode skills. The lifecycle tree below covers engineering phases; the Domain & Mode Routing section covers everything else (marketing, design, vendor packs, file formats, media). This meta-skill helps you discover and apply the right skill for your current task.

## Skill Discovery

When a task arrives, identify the development phase and apply the corresponding skill:

```
Task arrives
    │
    ├── Learning mode? ──────────────→ learn (vibe-wise) — FIRST gate. Active when a
    │   │                               `.vibe-wise/` state exists or the user asks to
    │   │                               learn/resume. The learner owns design decisions;
    │   │                               all skills below still apply but run inside the
    │   │                               learning loop (coach, don't take over). Skipped
    │   │                               only on explicit request to skip/pause learning.
    │   └── "reset learning" ─────────→ reset (vibe-wise) — explicit invocation only;
    │                                   backs up notes, restarts onboarding
    ├── Feature or bugfix? ──────→ three .md artifacts, user-verified (Core Behavior 7)
    ├── Don't know what you want yet? ──────→ interview-me
    ├── Have a rough concept, need variants? → idea-refine
    ├── New project/feature/change? ──→ spec-driven-development
    ├── No quality bar written down? ──→ constraint-driven-development
    ├── Have a spec, need tasks? ──────→ planning-and-task-breakdown
    ├── Filing a GitHub issue/ticket? ─→ always gh-issue (never raw gh)
    ├── Implementing code? ────────────→ incremental-implementation
    │   ├── UI work? ─────────────────→ frontend-ui-engineering
    │   ├── Accessibility audit? ─────→ accessibility
    │   ├── API contract work? ───────→ api-and-interface-design
    │   ├── Module/seam design? ──────→ codebase-design
    │   ├── Need better context? ─────→ context-engineering
    │   ├── Need doc-verified code? ───→ source-driven-development
    │   └── Stakes high / unfamiliar code? ──→ doubt-driven-development
    ├── Writing/running tests? ────────→ tdd
    │   ├── Python tests? ────────────→ python-testing-patterns
    │   └── Browser-based? ───────────→ playwright-cli + browser-testing-with-devtools
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    ├── Security question, focused review, ──→ security-audit — guidance by default;
    │   or full codebase audit / pen test?    full six-phase workflow only on an
    │                                          explicit audit/pen-test/comprehensive
    │                                          review request
    ├── Reviewing code? ───────────────→ code-review-and-quality
    │   ├── Too complex? ─────────────→ code-simplification
    │   ├── Security audit of existing code? → security-review
    │   ├── Building w/ untrusted input? → security-and-hardening
    │   ├── Python code? ─────────────→ python-anti-patterns + python-code-style
    │   └── Performance concerns? ────→ performance-optimization (+ python-performance-optimization for Python)
    ├── Committing/branching? ─────────→ git-workflow-and-versioning
    │   ├── Before ANY commit ─────────→ code-review-and-quality + review-<slug>.md (Core Behavior 12)
    │   └── Empty dir, not a repo? ────→ git init first (Core Behavior 9)
    ├── Opening a PR / merging a branch? → always github-pr (never raw gh)
    ├── CI/CD pipeline work? ──────────→ ci-cd-and-automation
    ├── Deprecating/migrating? ────────→ deprecation-and-migration
    ├── Writing docs/ADRs? ───────────→ documentation-and-adrs
    ├── Adding logs/metrics/alerts? ───→ observability-and-instrumentation
    └── Deploying/launching? ─────────→ shipping-and-launch
```

## Model Effort (SWE-2)

When the session model is a SWE-2 variant, emit an effort recommendation alongside the skill pick — a skill cannot call `/model` itself, so it names the level and the user applies it (`/model` + `←→` effort arrows, or `Alt+T`/`Opt+T` mid-session). If the session model is **Adaptive**, skip this — the router already chooses per task.

**Default: `swe-2 high`.** Recommend a different level only when the task clearly lands in a table row.

| Task shape | Effort |
|---|---|
| Simple bugfix, single-file edit, doc/comment change, question, mechanical rename | `medium` |
| Multi-file implementation, feature work, unfamiliar code, ambiguous scope, code review | `high` |
| Security-sensitive logic, architecture/migration, stubborn bug after two failed attempts, high-stakes correctness, `doubt-driven-development` paths | `max` |

Caveat: SWE-2 trails frontier models sharply on long-horizon terminal/system work (Terminal-Bench 4: 27.3% vs ~55-58%). For that task shape, recommend a frontier model (e.g. Fable, GPT-6) instead of bumping to `max`.

## Domain & Mode Routing

The tree above covers *how* to work. This section covers *what* you're working on — check it first, then stack with lifecycle skills (e.g. a Neon schema change = `neon` → `neon-postgres` + `tdd`). Skills marked "(alias)" are the same skill installed under a second name — prefer the first listed.

Router skills dispatch to their own sub-skills — invoke the router, don't guess the leaf:

| Trigger | Router | Dispatches to |
|---------|--------|---------------|
| Clerk, auth, sign-in, orgs, billing, webhooks | `clerk` | clerk-setup, clerk-cli, clerk-backend-api, clerk-custom-ui, clerk-orgs, clerk-billing, clerk-webhooks, clerk-testing, clerk-expo, clerk-android, clerk-swift, clerk-{nextjs,react,vue,nuxt,astro,tanstack,react-router,chrome-extension}-patterns |
| Neon, Lakebase Postgres, branching, serverless backend | `neon` | neon-postgres, neon-postgres-branches, neon-postgres-egress-optimizer, neon-auth, neon-functions, neon-object-storage, neon-ai-gateway |
| Supabase (any product), Postgres best practices | `supabase` | supabase-postgres-best-practices |
| Codebase understanding, knowledge graph, diffs, onboarding | `understand` | understand-chat, understand-dashboard, understand-diff, understand-domain, understand-explain, understand-figma, understand-knowledge, understand-onboard |

### Marketing, SEO & Growth

| Need | Skills |
|------|--------|
| Strategy, ideas, plans, advisors | `marketing-ideas`, `marketing-plan`, `marketing-council`, `marketing-psychology`, `marketing-loops`; run `product-marketing` first — it writes the positioning context the others read |
| Content strategy & research | `content-strategy`, `niche-research`, `customer-research` |
| SEO & discoverability | `seo-audit`, `ai-seo`, `schema`, `programmatic-seo`, `site-architecture`; app stores: `aso` |
| Paid & organic channels | `ads`, `ad-creative`, `social`, `emails`, `cold-email`, `sms`, `events`, `public-relations`, `influencer-marketing`, `co-marketing`, `community-marketing` |
| Launch & distribution | `launch`, `directory-submissions`, `referrals`, `revops` |
| Conversion & retention | `cro`, `signup`, `onboarding`, `popups`, `paywalls`, `pricing`, `offers`, `churn-prevention`, `lead-magnets`, `free-tools` |
| Competitors & sales | `competitor-profiling`, `competitors`, `sales-enablement`, `prospecting` |
| Measurement | `analytics`, `attribution`, `ab-testing` |
| Copy | `copywriting` (new copy), `copy-editing` (improve existing) |

### LinkedIn & Personal Content

Voice first — `voice-builder` then `newsletter-voice` write the about-me.md / voice.md files the rest read.

| Need | Skills |
|------|--------|
| Posts & hooks | `post-writer`, `post-formatter`, `post-scorer`, `hook-generator`, `content-matrix`, `pinned-comment`, `quote-post` |
| Visuals | `graphic-designer`, `gemini-carousel`, `gemini-infographic`, `youtube-thumbnail` |
| Profile & analytics | `profile-optimizer`, `analytics-dashboard` |
| Repurposing to video | `reels-scripting` |

### Frontend Design & UI

| Need | Skills |
|------|--------|
| Design, improve, redesign UI | `impeccable`, `design-taste-frontend` (aliases `taste-skill`, `design-taste-frontend-v1`, `taste-skill-v1`), `redesign-existing-projects` (alias `redesign-skill`), `web-design-guidelines` (audit only) |
| Visual style packs | `high-end-visual-design` (alias `soft-skill`), `gpt-taste` (alias `gpt-tasteskill`), `minimalist-ui` (alias `minimalist-skill`), `industrial-brutalist-ui` (alias `brutalist-skill`), `apple-design`, `emil-design-eng`, `stitch-design-taste` (alias `stitch-skill`) |
| Design images / image-to-code | `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code` (alias `image-to-code-skill`), `brandkit` |
| Build & components | `frontend-ui-engineering`, `shadcn`, `ask-sonner`, `mobile-native`, `pick-ui-library`, `prototype`, `vercel-composition-patterns`, `vercel-react-view-transitions` |

### Animation & Motion

`animate` (web), `animate-expo` (RN/Expo), `animation-vocabulary` (name that effect), and the audit chain `find-animation-opportunities` → `improve-animations` → `review-animations`.

### Documents, Files & Output

| File type | Skill |
|-----------|-------|
| .docx / .pptx / .xlsx / .csv / .pdf | `docx`, `pptx`, `xlsx`, `pdf` |
| User-facing docs | `writing-user-docs` |
| Exhaustive unabridged output | `full-output-enforcement` (alias `output-skill`) |

### Vercel & Next.js Pack

| Need | Skills |
|------|--------|
| Next.js app work | `nextjs`, `next-upgrade`, `next-cache-components`, `next-forge`, `turbopack`, `react-best-practices`, `vercel-react-best-practices` |
| Deploy & CLI | `vercel-cli`, `deploy-to-vercel`, `vercel-cli-with-tokens`, `deployments-cicd`, `env-vars`, `bootstrap`, `access-protected-vercel-deployment`, `vercel-optimize` |
| Platform primitives | `vercel-functions`, `vercel-storage`, `vercel-services`, `vercel-firewall`, `vercel-sandbox`, `vercel-connect`, `cdn-caching`, `routing-middleware`, `runtime-cache`, `microfrontends`, `vercel-agent` |
| AI, agents & backends | `ai-sdk`, `ai-gateway`, `chat-sdk`, `build-agents`, `eve`, `workflow`, `flags-sdk`, `marketplace`, `create-a-backend`, `auth`, `verification`, `knowledge-update` |

### Data, AI & Security Vendors

| Trigger | Skills |
|---------|--------|
| MongoDB / Atlas | `mongodb-natural-language-querying`, `mongodb-schema-design`, `mongodb-query-optimizer`, `mongodb-connection`, `mongodb-search-and-ai`, `mongodb-atlas-stream-processing` |
| Canva designs | `get-design-feedback`, `edit-design`, `implement-feedback`, `brand-check`, `bulk-create`, `resize-for-social-media` |
| Hugging Face / model training | `hf-cli`, `huggingface-llm-trainer` |
| Static analysis / SAST | `semgrep` (fast scan), `codeql` (deep dataflow), `sarif-parsing` (process results) |

### Languages

| Trigger | Skills |
|---------|--------|
| Python — tests, style, review, perf | `python-testing-patterns`, `python-code-style`, `python-anti-patterns`, `python-performance-optimization` |
| Swift | `write-swift` |
| React Native / Expo / Flutter | see React Native & Mobile |

### React Native & Mobile

`vercel-react-native-skills`, `react-native-best-practices`, `react-navigation`, `upgrading-react-native`, `react-native-tv-best-practices`, `create-react-native-library`; migration: `assess-react-native-migration` (decide) → `react-native-brownfield-migration` (implement). Swift: `write-swift`. Flutter web: `create-flutter-website-app`. Mobile CI: `github-actions`.

### Media & Misc

| Trigger | Skills |
|---------|--------|
| Marketing images / video | `image`, `video`, `brandkit` |
| Diagrams / charts as HTML/SVG/PNG | `diagram-design` |
| Browser testing | `playwright-cli` + `browser-testing-with-devtools` (DevTools MCP) together, `webapp-testing` |
| Recent community sentiment (30 days) | `last30days` |
| Devin CLI docs/config | `devin-cli` |
| Find / create / validate skills | `find-skills`, `skill-creator`, `validate-skills` |
| Devin env setup & secrets | `declarative-repo-setup`, `upload-secrets` |

Mode & review skills — stack on top of whatever lifecycle skill is active:

| Skill | When |
|-------|------|
| `learn` (vibe-wise) | Learning-first mode — the first skill invoked when learning mode applies; wraps every later skill so the learner leads design and the agent coaches/explains instead of deciding |
| `reset` (vibe-wise) | Restart learning onboarding — explicit invocation only, backs up notes first |
| `antislop` | Core filter — load on every task; runs on every file a skill outputs before it ships (Core Behavior 8); add `antislop-ui` (interface), `antislop-code` (comment hygiene), `antislop-copywriting` (prose), `antislop-human` (a11y/contrast), `antislop-layoutmobile` (responsive) per surface |
| `ponytail` | Minimal-diff mode for any coding task — runs on code-bearing file outputs before they ship (Core Behavior 8); `-review`/`-audit` hunt over-engineering, `-debt` lists deferred shortcuts, `-gain` scoreboard, `-help` usage card |
| `impeccable` | Frontend design/polish/critique — use instead of generic UI work when design quality is the point |
| `web-design-guidelines` | Review UI code against interface guidelines |
| `accessibility` | WCAG 2.2 audit + fixes for web UI — Lighthouse/axe evidence plus manual keyboard/screen-reader checks |
| `security-review` | Adversarial vulnerability review of existing code, confidence-scored findings |
| `security-audit` | Security questions, focused reviews, and vuln research (guidance mode); explicit codebase audit or pen test runs the full six-phase hunter/verifier workflow with sandboxed evidence and writes REPORT.md + findings.json |
| `writing-guidelines` | Review docs/prose against writing guidelines |
| `full-output-enforcement` | Any task that must not truncate or use placeholders |

## Core Operating Behaviors

These behaviors apply at all times, across all skills. They are non-negotiable.

### 1. Surface Assumptions

Before implementing anything non-trivial, explicitly state your assumptions:

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about architecture]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The most common failure mode is making wrong assumptions and running with them unchecked. Surface uncertainty early — it's cheaper than rework.

### 2. Manage Confusion Actively

When you encounter inconsistencies, conflicting requirements, or unclear specifications:

1. **STOP.** Do not proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff or ask the clarifying question.
4. Wait for resolution before continuing.

**Bad:** Silently picking one interpretation and hoping it's right.
**Good:** "I see X in the spec but Y in the existing code. Which takes precedence?"

### 3. Push Back When Warranted

You are not a yes-machine. When an approach has clear problems:

- Point out the issue directly
- Explain the concrete downside (quantify when possible — "this adds ~200ms latency" not "this might be slower")
- Propose an alternative
- Accept the human's decision if they override with full information

Sycophancy is a failure mode. "Of course!" followed by implementing a bad idea helps no one. Honest technical disagreement is more valuable than false agreement.

### 4. Enforce Simplicity

Your natural tendency is to overcomplicate. Actively resist it.

Before finishing any implementation, ask:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?

If you build 1000 lines and 100 would suffice, you have failed. Prefer the boring, obvious solution. Cleverness is expensive.

### 5. Maintain Scope Discipline

Touch only what you're asked to touch.

Do NOT:
- Remove comments you don't understand
- "Clean up" code orthogonal to the task
- Refactor adjacent systems as a side effect
- Delete code that seems unused without explicit approval
- Add features not in the spec because they "seem useful"

Your job is surgical precision, not unsolicited renovation.

### 6. Verify, Don't Assume

Every skill includes a verification step. A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data).

Per-skill verification is the local check. The project-wide bar that applies to *every* change, regardless of which skill is active, is the Definition of Done: tests pass, no regressions, behavior verified at runtime, docs updated. See `../../references/definition-of-done.md`. It complements each task's acceptance criteria rather than replacing them.

### 7. Three Artifact Files, Each User-Verified

For any feature or bugfix, work produces three separate markdown files in `~/.devin/plans/` — one per stage, each reviewed and verified by the user before moving to the next. Never skip straight to a later artifact, and never merge them into one document.

1. **`analysis-<slug>.md`** — temp analysis, the first output (not a plan, not code). Contents: problem statement and how the issue was reproduced or located; relevant files, functions, and call paths; assumptions and open questions; candidate approaches with tradeoffs. For data bugs, include the read-only queries the user can run to verify against the real database. Then stop — the user verifies or asks for refinement before anything else is produced.
2. **`issue-<slug>.md`** — the GitHub issue body, written once the analysis is verified. Filled from the repo's ticket template (see `gh-issue`), kept as the canonical local copy — the same file is passed to `gh issue create`/`gh issue edit` via `--body-file`. The user reviews it before the issue is posted or updated.
3. **`<slug>-plan.md`** — the local implementation plan for the actual work, written once the issue is confirmed: ordered tasks with acceptance criteria, verification steps, risks, and the atomic-commit plan. The user reviews and approves it before implementation begins.

The division is deliberate: the analysis is working memory, the issue file is the public ticket, the plan is the local work contract — keeping them separate keeps each one small and lets the user catch wrong assumptions at the cheapest possible stage.

### 8. De-slop Every File Output

Every file a skill emits — plan, analysis, issue/ticket body, doc, code, copy — gets an antislop pass before it ships: `antislop` core plus the sub-skill matching the surface (`antislop-copywriting` for prose/markdown, `antislop-code` for comments, `antislop-ui`/`antislop-human`/`antislop-layoutmobile` for interfaces). Remove the AI-slop content, don't just flag it:

- Hedged or provisional claims: `(proposed)`, `(proposed — …)`, `[Preliminary — …]`, guesses stated as fact
- Empty AI vocabulary, buzzwords, filler phrases, signposting, chatbot closers
- Fabricated specifics: invented numbers, names, quotes, sources
- Harness metadata leaked into content: `agent:`/`session:`/`created:` frontmatter, "Generated with …" trailers, tool names
- Template scaffolding pasted into the deliverable: `[WIP]` stubs for sections filled in later, drafting notes to self

Code-bearing outputs also get a `ponytail` pass (`ponytail` while writing, `ponytail-review` on diffs): shortest working diff, existing helpers and stdlib before new code, no new dependency a builtin covers, no speculative abstractions or boilerplate.

Match the destination's existing conventions — these passes remove slop and bloat, they do not restyle the file.

### 9. Initialize Empty Directories Before Branching

Before applying any branch-based workflow (feature branch, bugfix branch, gh-issue branch-off), check the working directory. If it is empty and not a git repository, run `git init` and land the initial work directly on the default branch — do not create a feature branch. A feature branch off nothing is meaningless overhead; the first commit(s) are the trunk.

Once the repo has history, normal branching rules apply from then on.

### 10. E2E Browser Verification With Evidence

Any change that affects browser-visible UI is verified end-to-end in a real browser — automated tests alone are not sufficient evidence. Use `playwright-cli` and `browser-testing-with-devtools` together — the Playwright CLI drives the flow and captures artifacts; the chrome-devtools MCP inspects what the flow produces:

- **Runtime inspection** — use `browser-testing-with-devtools` (chrome-devtools MCP) alongside the CLI run to check DOM state, capture console errors, and analyze network requests.
- **Screenshots** — capture each new/changed UI state with `playwright-cli screenshot --filename=<name>.png`.
- **Video** — record the exercised flow with `playwright-cli video-start <name>.webm` … `video-stop` (or a scripted `run-code` tour using `page.screencast` for paced, annotated playback) so the user can watch the behavior.
- **Both viewports** — run the pass on desktop AND on mobile (`playwright-cli open --mobile` / `--device`, or `resize`), since responsive duplicates and mobile breakpoints routinely differ; artifacts are named per-viewport (`<name>-desktop.png` / `<name>-mobile.png`, `…-desktop.webm` / `…-mobile.webm`).
- Artifacts are for review and PR attachments (`gh pr create --attach`), not committed to the repo.

### 11. GitHub Issue/PR Writes Always Invoke the Skill First

Before running `gh issue create`, `gh issue edit`, `gh pr create`, `gh pr merge`, or any other write to a GitHub issue or PR, invoke the owning skill (`gh-issue` or `github-pr`) and execute its full flow — repo detection, preflight verification, and the user-confirmation gate. Never run the raw `gh` command directly, even when the command looks trivial or the conversation already contains all the parameters. The skills exist because the checks they carry (upstream tracking, empty-diff detection, ticket-number titles, body review) are the ones that get skipped when the command is run ad hoc. If the skills' files are unavailable, say so and stop rather than falling back to raw `gh` writes. Read-only `gh` calls (`view`, `list`, `api` GETs, `checks`) do not require the skills.

Every issue/PR body gets both passes before it ships — always, no exceptions: `antislop` core + `antislop-copywriting` (prose hygiene: no AI vocabulary, hedged claims, or filler) and `ponytail` (shortest working content — cut boilerplate, speculative sections, and checklists nobody asked for). Write the body to a temp file named after the item's title slug — `gh-issue-<title-slug>.md` or `gh-pr-<title-slug>.md`, never a fixed generic name the next body silently overwrites — run the passes, apply fixes, then present for user approval before posting.

### 12. Code Review + Learning Analysis Before Every Commit

A commit is the last thing that happens to a change, never the next thing. Before ANY `git commit` — not just before merge — run this gate:

1. Invoke `code-review-and-quality` on the full pending diff. Stack a specialist reviewer when the diff warrants it: `security-review` for auth, data, or trust-boundary changes; `ponytail-review` to hunt over-engineering; `accessibility` for UI. For large or multi-file diffs, delegate the review to a `code-reviewer` (or `security-auditor`) subagent so it runs with fresh context.
2. Write `review-<slug>.md` to `~/.devin/plans/` with three sections:
   - **What changed** — files touched and what each change does, in plain language.
   - **Findings** — issues the review surfaced, severity, and whether each was fixed or deliberately deferred (and why).
   - **Concepts to learn** — the patterns, idioms, and techniques the diff uses, explained well enough that the user could apply them elsewhere (e.g., why an N+1 query became eager loading, what a policy/guard actually enforces). Teach the concept, don't just name it.
3. Present the file for user review and wait. Findings get resolved or explicitly deferred before the commit runs — `git-workflow-and-versioning` still owns the commit itself; this gate only decides whether the diff is ready.

Trivial changes (typo, config tweak) still get the pass, but the file can shrink to a few lines.

## Failure Modes to Avoid

These are the subtle errors that look like productivity but create problems:

1. Making wrong assumptions without checking
2. Not managing your own confusion — plowing ahead when lost
3. Not surfacing inconsistencies you notice
4. Not presenting tradeoffs on non-obvious decisions
5. Being sycophantic ("Of course!") to approaches with clear problems
6. Overcomplicating code and APIs
7. Modifying code or comments orthogonal to the task
8. Removing things you don't fully understand
9. Building without a spec because "it's obvious"
10. Skipping verification because "it looks right"
11. Shipping a file output with AI slop still in it — hedged claims, filler, leaked metadata, leftover template stubs
12. Shipping code output ponytail would shrink — speculative abstractions, unneeded dependencies, boilerplate nobody asked for
13. Writing to GitHub issues/PRs with raw `gh` commands without invoking `gh-issue`/`github-pr` first — the skill's preflight and user-confirmation gates exist precisely because ad-hoc invocation skips them
14. Committing without the pre-commit review pass and `review-<slug>.md` — the diff you just wrote is the one you're least able to see clearly

## Skill Rules

1. **Check for an applicable skill before starting work.** Skills encode processes that prevent common mistakes.

2. **Skills are workflows, not suggestions.** Follow the steps in order. Don't skip verification steps.

3. **Multiple skills can apply.** A feature implementation might involve `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `tdd` → `code-review-and-quality` → `code-simplification` → `shipping-and-launch` in sequence.

4. **When in doubt, start with a spec.** If the task is non-trivial and there's no spec, begin with `spec-driven-development`.

5. **Vendor routers win over direct invocation.** For clerk/neon/supabase/understand tasks, invoke the router skill and let it pick the sub-skill.

6. **GitHub writes always go through the skills.** Every issue is filed via `gh-issue` and every PR via `github-pr` — never ad-hoc `gh issue create`/`gh pr create`. Both skills carry repo detection and preflight verification, and together they enforce one naming vocabulary — Conventional Commits: commits are `<type>: <subject>` ≤50 chars, branches are ticket-linked `<type>/#<n>-<slug>` where `<type>` is the commit type (`feat`/`fix`/`chore`/`docs`/`refactor`/`perf`/`test`/`ci`/`build`, plus `hotfix`), issue titles are `<type>: <thing + behavior>` ≤72 chars, and PR titles are `<type>: #<issue> <description>` (e.g. `fix: #59 CIT issued certificates missing after supervisor approval`).

## Lifecycle Sequence

For a complete feature, the typical skill sequence is:

```
0.  analysis-<slug>.md          → Temp analysis file — user verifies (feature/bugfix gate, Core Behavior 7)
    issue-<slug>.md             → GitHub issue body file — user verifies before it's posted
    <slug>-plan.md              → Local implementation plan — user approves before work starts
1.  interview-me                → Extract what the user actually wants
2.  idea-refine                 → Refine vague ideas
3.  spec-driven-development     → Define what we're building
4.  planning-and-task-breakdown → Break into verifiable chunks
5.  gh-issue                    → File the tracking ticket from issue-<slug>.md (feat:/fix: template), then branch off its number
6.  context-engineering         → Load the right context
7.  source-driven-development   → Verify against official docs
8.  incremental-implementation  → Build slice by slice
9.  observability-and-instrumentation → Instrument as you build (runs parallel with 8-10, not after)
10. doubt-driven-development    → Cross-examine non-trivial decisions in-flight
11. tdd                         → Prove each slice works (python-testing-patterns for Python test code)
12. code-review-and-quality     → Review before EVERY commit — writes review-<slug>.md (Core Behavior 12)
13. code-simplification         → Reduce unnecessary complexity while preserving behavior
14. git-workflow-and-versioning → Clean commit history
15. github-pr                   → Open or merge the PR — title carries the ticket # after the prefix (`fix: #59 ...`)
16. documentation-and-adrs      → Document decisions
17. deprecation-and-migration   → Retire old systems and move users safely when needed
18. shipping-and-launch         → Deploy safely
```

Not every task needs every skill. A bug fix might only need: analysis .md → `debugging-and-error-recovery` → `tdd` → `code-review-and-quality`.

## Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|-----------------|
| Define | interview-me | Surface what the user actually wants before any plan, spec, or code exists |
| Define | idea-refine | Refine ideas through structured divergent and convergent thinking |
| Define | spec-driven-development | Requirements and acceptance criteria before code |
| Plan | planning-and-task-breakdown | Decompose into small, verifiable tasks |
| Plan | gh-issue | Create GitHub issue from the feature/bugfix ticket template via gh CLI |
| Build | incremental-implementation | Thin vertical slices, test each before expanding |
| Build | source-driven-development | Verify against official docs before implementing |
| Build | doubt-driven-development | Adversarial fresh-context review of every non-trivial decision |
| Build | context-engineering | Right context at the right time |
| Build | frontend-ui-engineering | Production-quality UI with accessibility |
| Build | api-and-interface-design | Stable interfaces with clear contracts |
| Build | codebase-design | Deep-module vocabulary for interface/seam design |
| Verify | tdd | Failing test first at a pre-agreed seam, then make it pass |
| Verify | python-testing-patterns | pytest fixtures, mocking, Python test strategy |
| Verify | playwright-cli, browser-testing-with-devtools | Real-browser verification — CLI drives the flow and captures artifacts, DevTools MCP inspects DOM/console/network |
| Verify | debugging-and-error-recovery | Reproduce → localize → fix → guard |
| Review | code-review-and-quality | Five-axis review — mandatory before every commit, writes `review-<slug>.md` |
| Review | code-simplification | Preserve behavior while reducing unnecessary complexity |
| Review | security-and-hardening | OWASP prevention, input validation, least privilege |
| Review | security-review | Adversarial vulnerability review, confidence-scored findings |
| Review | security-audit | Security guidance by default; explicit audit/pen test → six-phase workflow, coverage ledger, sandboxed proof, report artifacts |
| Review | accessibility | WCAG 2.2 audit and remediation for web UI |
| Review | python-anti-patterns | Python-specific code smells checklist |
| Review | python-code-style | Python style, naming, docstring standards |
| Review | performance-optimization | Measure first, optimize only what matters (+ `python-performance-optimization` for Python) |
| Ship | git-workflow-and-versioning | Atomic commits, clean history |
| Ship | github-pr | Verified PR creation and merge for the current branch |
| Ship | ci-cd-and-automation | Automated quality gates on every change |
| Ship | deprecation-and-migration | Remove old systems and migrate users safely |
| Ship | documentation-and-adrs | Document the why, not just the what |
| Ship | observability-and-instrumentation | Structured logs, RED metrics, traces, symptom-based alerts |
| Ship | shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |
