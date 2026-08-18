# claude-game-dev

A reusable `.claude/` configuration for **ontology-driven game development** with Claude
Code. Drop it into a fresh repo and ask Claude to create a game: it will build a formal
ontology of the game domain first (Stanford Ontology 101), persist it as the single source
of truth under `ontology/`, then implement by routing through engine-specific skills.

Not a game template — no engine scaffolding, only agent configuration.

## Usage

In a new game repo:

```sh
git init mygame && cd mygame
git submodule add git@github.com:M4jor-Tom/claude-game-dev.git .claude
git submodule update --init --recursive
```

(or `git clone --recurse-submodules … .claude` if you don't want the nested submodule.)

Then start Claude Code and ask for your game — the `game-from-ontology` skill picks it up.

> **Don't `cp -r` this directory**: `skills/` is symlinks into `vendor/` submodules; a copy
> without `vendor/` breaks every link.

## Structure

```
CLAUDE.md        ontology-first rules (sync rule, router-always, spike/jam exemption)
skills/          70 skills: 69 symlinks into vendor/ + game-from-ontology (ours)
vendor/          git submodules:
                   awesome-gamedev-agent-skills  — router + 67 gamedev skills (upstream)
                   claude-ontology-skill         — Ontology 101 (fork branch, upstream PR #1)
scripts/check.sh sanity check: submodules initialized, all skills resolve
docs/adr/        architecture decision records
```

## How it works

1. `game-from-ontology` runs the 7-step Ontology 101 process on the game domain and writes
   `ontology/` (`domain.md` + `model.<lang>` + `instances/`) — the format is specified in
   the skill.
2. The `router` skill detects the engine and loads only the relevant engine/discipline/genre
   skills.
3. `CLAUDE.md`'s sync rule keeps `ontology/` updated *before* any domain-touching change is
   implemented; code and data derive from it.

## Maintenance

- `sh scripts/check.sh` — run after any submodule update (CI runs it on every push).
- Dependabot bumps the submodules weekly.
- When [claude-ontology-skill PR #1](https://github.com/01clauding/claude-ontology-skill/pull/1)
  merges, repoint `vendor/claude-ontology-skill` to upstream.
