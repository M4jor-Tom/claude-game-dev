import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync, mkdirSync, mkdtempSync, readFileSync,
	readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";

const script = new URL("../scripts/update-plugins.sh", import.meta.url);

function fixture(t: TestContext, settings: unknown) {
	const root = mkdtempSync(join(tmpdir(), "pi plugin updates "));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "scripts"));
	mkdirSync(join(root, "bin"));
	copyFileSync(script, join(root, "scripts/update-plugins.sh"));
	const manifest = join(root, "settings.json");
	const original = `${JSON.stringify(settings, null, 2)}\n`;
	writeFileSync(manifest, original, { mode: 0o640 });
	writeFileSync(join(root, "bin/npm"), `#!/bin/sh
set -eu
if [ "\${NPM_FAIL-}" = "$2" ]; then
  echo "registry lookup failed: $2" >&2
  exit 41
fi
if [ -n "\${NPM_EDIT-}" ]; then printf '%s\\n' "$NPM_EDIT" > settings.json; fi
case "$*" in
  'view pi-subagents@latest version --json'|'view pi-subagents@0.89.0 version --json')
    printf '%s\\n' "\${NPM_REPLY-\\\"0.89.0\\\"}" ;;
  'view @example/tool@latest version --json') printf '"2.0.0"\\n' ;;
  *) echo "unexpected npm lookup: $*" >&2; exit 42 ;;
esac
`, { mode: 0o755 });
	const env = {
		...process.env,
		PATH: `${join(root, "bin")}:${process.env.PATH}`,
		GIT_CONFIG_GLOBAL: "/dev/null",
		GIT_CONFIG_NOSYSTEM: "1",
	};
	return {
		root, manifest, original,
		run: (args: string[] = [], overrides: Record<string, string> = {}) => spawnSync(
			"sh", [join(root, "scripts/update-plugins.sh"), ...args],
			{ cwd: tmpdir(), env: { ...env, ...overrides }, encoding: "utf8" },
		),
		read: () => JSON.parse(readFileSync(manifest, "utf8")),
		git: (...args: string[]) => execFileSync("git", args, { env, encoding: "utf8" }).trim(),
	};
}

function upstream(f: ReturnType<typeof fixture>) {
	const repo = join(f.root, "git upstream");
	f.git("init", "--quiet", repo);
	const commit = (message: string) => f.git("-C", repo,
		"-c", "user.name=Test", "-c", "user.email=test@example.test", "-c", "commit.gpgsign=false",
		"commit", "--quiet", "--allow-empty", "-m", message);
	commit("first");
	const first = f.git("-C", repo, "rev-parse", "HEAD");
	f.git("-C", repo, "-c", "user.name=Test", "-c", "user.email=test@example.test",
		"-c", "tag.gpgsign=false", "tag", "-a", "v1.0.0", "-m", "release");
	commit("second");
	const head = f.git("-C", repo, "rev-parse", "HEAD");
	return { source: `git:file://${repo}`, first, head };
}

test("updates all pins while preserving other settings and package filters", (t) => {
	const f = fixture(t, {});
	const git = upstream(f);
	const settings = {
		theme: "dark",
		packages: [
			"npm:pi-subagents@0.67.0",
			{ source: "npm:@example/tool@1.0.0", extensions: [], skills: ["skills/custom"] },
			{ source: `${git.source}@${git.first}`, prompts: [] },
		],
	};
	writeFileSync(f.manifest, `${JSON.stringify(settings, null, 2)}\n`);
	const result = f.run();
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(f.read(), {
		theme: "dark",
		packages: [
			"npm:pi-subagents@0.89.0",
			{ source: "npm:@example/tool@2.0.0", extensions: [], skills: ["skills/custom"] },
			{ source: `${git.source}@${git.head}`, prompts: [] },
		],
	});
	assert.match(result.stdout, /pi-subagents@0\.67\.0.*pi-subagents@0\.89\.0/);
	assert.equal(statSync(f.manifest).mode & 0o777, 0o640);
});

test("updates only the selected plugin, with an optional exact npm version", (t) => {
	for (const args of [["pi-subagents"], ["npm:pi-subagents", "0.89.0"]]) {
		const f = fixture(t, { packages: ["npm:pi-subagents@0.67.0", "npm:@example/tool@1.0.0"] });
		const result = f.run(args);
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(f.read().packages, ["npm:pi-subagents@0.89.0", "npm:@example/tool@1.0.0"]);
	}
});

test("matches scoped npm names without treating their scope as a version", (t) => {
	const f = fixture(t, { packages: ["npm:@example/tool@1.0.0", "npm:pi-subagents@0.67.0"] });
	const result = f.run(["@example/tool"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(f.read().packages, ["npm:@example/tool@2.0.0", "npm:pi-subagents@0.67.0"]);
});

test("resolves an explicitly selected annotated Git tag to its commit", (t) => {
	const f = fixture(t, {});
	const git = upstream(f);
	writeFileSync(f.manifest, `${JSON.stringify({ packages: [`${git.source}@${git.head}`] }, null, 2)}\n`);
	const result = f.run(["git upstream", "v1.0.0"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(f.read().packages, [`${git.source}@${git.first}`]);
});

test("leaves the manifest unchanged and cleans up when a later lookup fails", (t) => {
	const f = fixture(t, { packages: ["npm:@example/tool@1.0.0", "npm:pi-subagents@0.67.0"] });
	const before = readdirSync(f.root).sort();
	const result = f.run([], { NPM_FAIL: "pi-subagents@latest" });
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /registry lookup failed: pi-subagents@latest/);
	assert.equal(readFileSync(f.manifest, "utf8"), f.original);
	assert.deepEqual(readdirSync(f.root).sort(), before);
});

test("rejects unknown or ambiguous plugins and non-exact npm versions", (t) => {
	const cases = [
		{ args: ["missing"], packages: ["npm:pi-subagents@0.67.0"], error: /not found|unknown/i },
		{ args: ["tool"], packages: ["git:example.test/a/tool@abc", "git:example.test/b/tool@abc"], error: /ambiguous/i },
		{ args: ["pi-subagents", "^0.89.0"], packages: ["npm:pi-subagents@0.67.0"], error: /exact|version/i },
		{ args: ["pi-subagents", "0.89.0", "extra"], packages: ["npm:pi-subagents@0.67.0"], error: /usage/i },
	];
	for (const { args, packages, error } of cases) {
		const f = fixture(t, { packages });
		const result = f.run(args);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, error);
		assert.equal(readFileSync(f.manifest, "utf8"), f.original);
	}
});

test("rejects empty, floating, or malformed registry versions without writing", (t) => {
	for (const reply of ["", '"latest"', '"0.89.0-beta.1"', '{"error":"bad metadata"}']) {
		const f = fixture(t, { packages: ["npm:pi-subagents@0.67.0"] });
		const result = f.run([], { NPM_REPLY: reply });
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /version/i);
		assert.equal(readFileSync(f.manifest, "utf8"), f.original);
	}
});

test("leaves pins unchanged when a Git ref cannot be resolved", (t) => {
	const f = fixture(t, {});
	const git = upstream(f);
	const original = `${JSON.stringify({ packages: ["npm:pi-subagents@0.67.0", `${git.source}@${git.first}`] }, null, 2)}\n`;
	writeFileSync(f.manifest, original);
	const result = f.run(["git upstream", "missing-tag"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /cannot resolve Git ref/i);
	assert.equal(readFileSync(f.manifest, "utf8"), original);
});

test("does not overwrite settings edited during a lookup", (t) => {
	const f = fixture(t, { packages: ["npm:pi-subagents@0.67.0"] });
	const edited = '{"theme":"edited","packages":["npm:pi-subagents@0.67.0"]}';
	const result = f.run([], { NPM_EDIT: edited });
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /changed during lookup/i);
	assert.equal(readFileSync(f.manifest, "utf8"), `${edited}\n`);
});

test("rejects malformed package manifests without changing them", (t) => {
	for (const settings of [{ packages: {} }, { packages: [null] }, { packages: [{ source: 42 }] }]) {
		const f = fixture(t, settings);
		const result = f.run();
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /invalid packages/i);
		assert.equal(readFileSync(f.manifest, "utf8"), f.original);
	}
});

test("accepts a singleton JSON array from newer npm versions", (t) => {
	const f = fixture(t, { packages: ["npm:pi-subagents@0.67.0"] });
	const result = f.run([], { NPM_REPLY: '["0.89.0"]' });
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(f.read().packages, ["npm:pi-subagents@0.89.0"]);
});

test("does not rewrite the file when every pin is already current", (t) => {
	const f = fixture(t, { packages: ["npm:pi-subagents@0.89.0"] });
	const before = statSync(f.manifest);
	const result = f.run();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(f.manifest, "utf8"), f.original);
	assert.equal(statSync(f.manifest).ino, before.ino);
	assert.match(result.stdout, /no.*updates|up.to.date/i);
});
