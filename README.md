# pi-power-dev

A [pi](https://pi.dev) agent directory: general-purpose coding profile,
ported from `M4jor-Tom/claude-power-dev`.

## Use it

Without Nix — this repo *is* the agent dir:

```bash
git clone https://github.com/M4jor-Tom/pi-power-dev.git ~/.pi-power-dev
PI_CODING_AGENT_DIR=~/.pi-power-dev pi
```

With Nix, which also supplies every CLI the skills shell out to:

```bash
nix run github:M4jor-Tom/pi-power-dev.app
```

`PI_CODING_AGENT_DIR` replaces pi's `agent` subdirectory, so this repo's
`settings.json` is what `~/.pi/agent/settings.json` would normally be.

## Layout

| Path | Role |
|---|---|
| `AGENTS.md` | Global memory, loaded at every session start |
| `settings.json` | pi settings, and the pinned `packages[]` manifest |
| `mcp.json` | MCP servers, read by `pi-mcp-adapter` |
| `skills/` | Locally authored skills |
| `prompts/` | Slash commands |
| `extensions/` | TypeScript extensions (pi's replacement for hooks) |
| `tests/` | `node --test` unit tests for the extensions |
| `scripts/check.sh` | Integrity check, also run in CI |

Auth, sessions and memory are per-profile: because `PI_CODING_AGENT_DIR`
points here, `auth.json`, `sessions/` and `pi-hermes-memory/` all land in
this directory and are gitignored. Nothing is shared with `~/.pi` or with
`pi-game-dev`.

## Updating pinned packages

Use the dev tool (requires `jq`, `npm`, and `git`):

```bash
./scripts/update-plugins.sh                       # update every pin
./scripts/update-plugins.sh pi-subagents          # update one npm package
./scripts/update-plugins.sh pi-subagents 0.89.0   # choose an exact npm version
./scripts/update-plugins.sh superpowers          # update one Git package
```

With no version, npm packages resolve their `latest` release and Git packages
resolve the remote default branch's HEAD. npm versions must be numeric `X.Y.Z`
(no ranges or prereleases). For Git, an optional second argument selects a
published tag; refs are saved as full commit hashes. Select Git packages by
repository name, or use a full source without its `@pin` to
resolve ambiguous names. Scoped npm names such as `@scope/package` also work.

The script updates only `settings.json`, preserving package resource filters.
It installs nothing, writes only after all selected lookups succeed, and aborts
if the settings changed during lookup. Review `git diff`, run
`sh scripts/check.sh`, then commit the new pins.

Start a fresh Pi session to install and load the new pins:

```bash
PI_CODING_AGENT_DIR="$PWD" pi
```

For one known version, Pi also provides a native command that changes the pin
and installs it while preserving resource filters:

```bash
PI_CODING_AGENT_DIR="$PWD" pi install npm:pi-subagents@0.89.0
```

`pi update --extensions` does not advance pins: it skips exact npm versions
and reconciles Git checkouts to their configured refs.

## Not ported from Claude Code

pi has no equivalent, by design, for these — each was dropped deliberately:

| Claude Code | Why it is gone |
|---|---|
| `permissions.allow` (41 entries) | pi has no permission prompts. Tool scoping is `defaultTools` / `--tools`. |
| `statusLine: bunx ccstatusline` | pi's footer already shows cwd, session, tokens, cache, cost, context and model. |
| `worktree`, `enableWorkflows`, `sandbox` | No analogue. |
| `cleanupPeriodDays`, `spinnerTipsEnabled` | No analogue. |
| `skipDangerousModePermissionPrompt`, `skipWorkflowUsageWarning` | Nothing to skip — there is no prompt. |
| `github` MCP | Replaced by the `gh` CLI, which `AGENTS.md` already mandates. |
| `playwright` MCP | Replaced by the `playwright-cli` skill. |
| `understand-anything` | Its `prepare` script needs a pnpm + TypeScript build that pi's `npm install --omit=dev` cannot run, so installing it crashes pi at startup. Its skills' helper scripts and 7 of its 10 agents depend on that build too. The `graphify` skill covers the same "codebase to queryable knowledge graph" ground. To recover it, build the upstream monorepo out-of-band and point `skills` at the result. |

## Known version gap

`skills/graphify/.graphify_version` pins graphify 0.8.30; nixpkgs ships
0.4.23. The app also ships `uv`, so the skill's own
`uv tool install --upgrade graphifyy` path can take over.
