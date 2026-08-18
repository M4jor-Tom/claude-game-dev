# Game project — ontology-driven

- This repo is developed **ontology-first**: every new gameplay feature starts with the
  `game-from-ontology` skill (which chains `ontology` then `router`).
- `ontology/` at the repo root is the source of truth: development consumes it and never
  drifts ahead of it.
- **Sync rule (step 0):** before implementing any domain-touching task, land the change in
  `ontology/` first — new or modified classes, relations, constraints, generators, or
  instances — then implement by consuming it. Skip only for tasks that don't touch the
  domain (debugging, build/export, tooling).
- For any gamedev implementation task, go through the `router` skill — don't pick
  engine/genre skills by hand.
- **Exemption:** `prototype-fast` spikes and `game-jam` builds are pre-ontology: timeboxed,
  on a separate branch or repo, never merged. A spike that proves fun feeds the *ontology*
  (model the mechanic); the spike code is deleted, not promoted.
