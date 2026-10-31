# claude-game-dev

A Claude Code config directory for **ontology-first game development**, derived
from [`claude-power-dev`](https://github.com/M4jor-Tom/claude-power-dev), the
general-purpose coding profile. It retains general development skills and plugin
links, adding game-development skills and the `game-from-ontology` workflow.

Not a game template — no engine scaffolding, only agent configuration.

## Use it

The primary setup is a standalone config directory, replacing `~/.claude` for
that launch via `CLAUDE_CONFIG_DIR`. Run Claude from your game project's
directory, not from the config repo. Fresh clones are currently affected by the
[migration gaps below](#current-migration-gaps).

With Nix:

```bash
nix run github:M4jor-Tom/claude-game-dev.app
```

[`claude-game-dev.app`](https://github.com/M4jor-Tom/claude-game-dev.app) is a
separate Nix runner. It supplies Claude Code and common CLI tools, recursively
clones this config to `~/.claude-game-dev`, sets `CLAUDE_CONFIG_DIR`, and launches
Claude. Override the clone location with `CLAUDE_GAME_DEV_DIR`. Game-engine
toolchains belong in the game project's own environment.

Without Nix, install Claude Code and the required CLI tools yourself:

```bash
git clone --recurse-submodules https://github.com/M4jor-Tom/claude-game-dev.git ~/.claude-game-dev
CLAUDE_CONFIG_DIR=~/.claude-game-dev claude
```

In this setup, this repo's `settings.json` is the **user-level** settings file.
To start ontology-first development, explicitly ask Claude to use
`game-from-ontology` for your game idea.

### Optional: project-local `.claude/`

To share the config with a single game repo instead:

```bash
git init mygame && cd mygame
git submodule add https://github.com/M4jor-Tom/claude-game-dev.git .claude
git submodule update --init --recursive
claude
```

Here, `.claude/settings.json` is **project-level** settings; no
`CLAUDE_CONFIG_DIR` override is needed.

## Layout

| Path | Role |
|---|---|
| `CLAUDE.md` → `AGENTS.md` | Shared session instructions; currently the inherited power-dev rules |
| `settings.json` | Model, workflow, status-line and plugin marketplace settings |
| `skills/` | Local skills, individual game/ontology skill links, and inherited plugin-root links |
| `vendor/` | Upstream skill and plugin repositories referenced as Git submodules |
| `scripts/check.sh` | Checks game submodule initialization and direct `SKILL.md` files; limitations below |
| `docs/adr/` | Architecture decision records for the ontology workflow and vendoring |

## Skills and plugins

Local skills are `game-from-ontology`, plus the inherited `graphify`,
`llm-council`, `markitdown`, `playwright-cli`, `prd`, and `writing-adrs`.
The links in `skills/` reference these sources:

| Source under `vendor/` | Exposed through `skills/` |
|---|---|
| `awesome-gamedev-agent-skills` | `router` and engine, discipline, genre and shipping skills |
| `claude-ontology-skill` | `ontology` — Stanford's 7-step Ontology 101 method; currently a fork |
| `claude-plugins-official` | `frontend-design`, `claude-md-management`, `github`, `playwright` |
| `superpowers` | `superpowers` |
| `ponytail` | `ponytail` |
| `claude-mem` | `claude-mem` |
| `ui-ux-pro-max-skill` | `ui-ux-pro-max` |
| `understand-anything` | `understand-anything` |
| `i-have-adhd` | `i-have-adhd` |

Game and ontology links target individual skill directories. The inherited
plugin links target plugin roots, which Claude Code's
[skills-directory plugin loading](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)
can load with their nested skills, hooks, agents and MCP servers. These are
not all standalone `SKILL.md` directories.

Keep `skills/` together with `vendor/` and preserve the symlinks; copying only
the links breaks them.

## Ontology-first workflow

The [`game-from-ontology`](skills/game-from-ontology/SKILL.md) skill specifies:

1. Run the `ontology` skill's 7-step process on the game domain before engine
   scaffolding, and validate the model with the user.
2. Persist the model in the **game repo's** `ontology/`: `domain.md` is the
   canonical semantic layer, `model.<ext>` is the engine-language model, and
   `instances/` holds content data.
3. Use `router` to select the relevant engine, discipline and genre skills.
4. Update the ontology before domain-touching changes, then derive code and
   data from it. Model procedural generators and reference externally authored
   content rather than duplicating it.

The skill exempts timeboxed `prototype-fast` spikes and `game-jam` builds on
separate branches/repos that are never merged; useful discoveries feed the
ontology, not production code. These are workflow instructions, not an automated
enforcement mechanism.

## Maintenance

For an existing clone, the normal update/check sequence is:

```bash
git submodule update --init --recursive
sh scripts/check.sh
```

CI performs recursive checkout and runs the check on pushes and pull requests.
Dependabot is configured to propose weekly submodule updates; review and check
new pins before accepting them.

### Current migration gaps

- `CLAUDE.md` currently symlinks to `AGENTS.md`, which has no ontology sync,
  router-always or spike/jam rules. The local skill references such rules, but
  they have not been restored to the session instructions.
- `.gitmodules` declares only the two game/ontology sources, while the Git
  index and inherited skill links still reference seven power-dev plugin
  submodules. Recursive submodule commands fail on the missing mappings; a
  fresh clone cannot initialize those inherited sources as-is.
- `settings.json` still enables marketplace copies of plugins also referenced
  by inherited plugin-root links. Unlike power-dev, those marketplace IDs are
  not disabled here, so duplicate plugin loading is possible once links work.
- `scripts/check.sh` assumes every skill directory has a root `SKILL.md` and
  currently fails on inherited plugin-root entries. It does not validate their
  plugin manifests or catch all dangling links; passing it alone would not
  prove the combined profile is ready.

## Runtime state

With standalone `CLAUDE_CONFIG_DIR` usage, Claude Code writes sessions, caches,
credentials and its plugin cache into this clone. `.gitignore` covers runtime
state; `plugins/` is an ignored cache, not the vendored source directory.

The Nix runner auto-pulls only a clean clone whose `origin` matches its
configured repository URL, then updates submodules after a successful pull.
Local edits or even one untracked file silently skip that auto-pull.
