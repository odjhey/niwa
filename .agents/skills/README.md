# Shared skills

Harness-neutral home for skill definitions. Each skill is a directory:
`.agents/skills/<name>/SKILL.md`. Harness-specific locations are symlinks
into this directory (`.claude/skills` → `../.agents/skills`), so every
harness picks skills up from a single source — add or edit skills here
only.

Shipped skills:

- `find-docs` — query docs by frontmatter / the `DOCS-ROOT` registry.
- `build-the-lever` — for non-trivial work, build the script/skill/template
  that does or proves it, so a reviewer reruns an artifact instead of
  redoing the work.
- `encode-lessons-in-structure` — when an instruction is written a second
  time, promote it to a gate step, test, or inherited-contract line.
- `laziness-protocol` — bias toward deletion, repair, and the smallest
  diff; never lazy about verification.
- `watchtower-loop` — the watchtower's orc+ergo cycle, standing rules,
  and the lane watchdog (`lane-watchdog.sh`), per `ORC-ERGO-DELIVERY`.
- `delivery-loop` — the ship seat's orient/work/record/report sequence.
- `orc-ledger` — the **generic**, upstream-generated orc seat protocol
  (`orc onboard` emits it; its `CHANGELOG.md` carries the version and
  content hash). Do not edit it here — regenerate; where it and
  `ORC-ERGO-DELIVERY` disagree, `ORC-ERGO-DELIVERY` governs.

Authoring guards for `SKILL.md` frontmatter (it may be parsed by strict
YAML parsers in other harnesses):

- No unquoted colon-space (`: `) inside a `description` value — strict
  parsers read it as a nested mapping and the skill silently fails to
  load. Single-quote the value if a mid-sentence colon is unavoidable.
- The `description` states **what + when** (the trigger phrases that
  should route to the skill), never a how-summary of the workflow — a
  description that lists the steps makes the agent follow the summary and
  skip loading the body.
