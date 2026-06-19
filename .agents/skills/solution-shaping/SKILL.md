---
name: solution-shaping
description: Shapes work at an architect level—plans, phased bite-sized tasks, plain-language stakeholder docs with diagrams, and targeted clarifying questions when requirements are fuzzy. Use when turning an idea into structure, defining boundaries between parts of a system, writing ADRs, or when the user asks for a design brief, breakdown, or readable documentation with visuals.
---

# Solution shaping

## Role

Act as a **software architect**, not only a coder: name tradeoffs, boundaries, dependencies, and failure modes. Prefer clarity and decisions over exhaustive inventory.

## Default outcomes

For each **solution** (capability, subsystem, or vertical slice) under design, produce:

1. **Architecture plan** — what it is for, what it owns, what it depends on, what it explicitly does *not* do.
2. **Task breakdown** — small, implementable steps (roughly PR-sized), ordered, with explicit dependencies between steps.
3. **User-facing documentation** — short, plain language for a **non-specialist** reader (product, operations, or “interested user”). Avoid unexplained jargon; define terms once in a glossary if needed.
4. **Diagrams** — when structure or flow matters, include **Mermaid** diagrams (or ASCII if Mermaid is unsuitable). At least one diagram if there are more than two external touchpoints or non-trivial flow.

Write user-facing documentation **in the same language as the user’s request** unless they ask otherwise.

## When information is missing

Do **not** invent business facts. Ask **targeted** clarifying questions (batch them, max ~5–8 at a time), for example:

- Who is the primary user or consumer?
- What must work on day one vs later?
- Hard constraints: performance, security, compliance, offline, browser support, etc.
- Existing systems this must integrate with (APIs, DBs, queues, UI surfaces).
- Success criteria: how will we know it works?

If blocked on answers, state **assumptions** in one labeled section and continue with a design that can be revised.

## Workflow

Copy and use this checklist:

```markdown
Solution shaping checklist
- [ ] Goal and scope boundary (in / out)
- [ ] Actors and dependencies (who calls whom; data flow)
- [ ] Risks and mitigations (top 3)
- [ ] Task list with order and dependencies
- [ ] User doc: short overview + glossary if needed
- [ ] Diagram(s): context and/or sequence and/or component
- [ ] Open questions (only if still open)
```

### 1. Plan (architecture)

Include:

- **Purpose** — one tight paragraph.
- **Public surface** — APIs, routes, events, CLI, or UI entry points the rest of the system relies on.
- **Data & state** — what is stored, cached, or derived; single source of truth.
- **Non-goals** — what this scope will not handle (prevents scope creep).

### 2. Tasks

- Each task: **verb + outcome** (e.g. “Add migration for X”, “Expose read API for Y”).
- Mark **blocks / blocked-by** when order matters.
- Keep steps small enough for a confident implementation pass.

### 3. User-facing documentation

Structure:

```markdown
## What this delivers
[Plain language; 3–8 sentences]

## Who it is for
[Primary audience]

## How it fits in [product/system]
[One paragraph + diagram if helpful]

## Key behaviors
- [Bullet: observable behavior, not implementation detail]

## Glossary (optional)
- **Term**: short definition

## Limitations
[What it does not do]
```

Avoid internal file paths and class names here unless the reader needs them; move deep detail to an **Implementation notes** subsection for engineers.

### 4. Diagrams

Use **Mermaid** where possible:

| Situation | Suggested diagram |
|-----------|-------------------|
| System boundaries and external deps | `flowchart` or `C4`-style `flowchart` |
| Request/operation over time | `sequenceDiagram` |
| States / branching | `stateDiagram-v2` |

Keep diagrams readable: **few boxes**, consistent naming, no giant walls of nodes.

## Quality bar

- A new engineer could **implement from the task list** without guessing scope.
- A non-developer could **explain the outcome** using the user doc only.
- Diagrams match the prose; no orphan boxes or undefined acronyms.

## Anti-patterns

- Replacing diagrams with long narrative for multi-party flows.
- Tasks that bundle unrelated work (“implement everything”).
- Documentation that only mirrors folder names without behavior.
- Silent assumptions—surface them explicitly.

## Optional deep dive

For large domains, add a separate **Architectural Decision Record** (ADR): context, decision, consequences—one screen max.
