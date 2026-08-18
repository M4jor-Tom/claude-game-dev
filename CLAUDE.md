# Game project — ontology-driven

- This repo is developed **ontology-first**: every new gameplay feature starts with the
  `game-from-ontology` skill (which chains `ontology` then `router`).
- `ontology/` at the repo root is the source of truth: the router updates it first
  (step 0), then development consumes it. Never the other way around.
- For any gamedev implementation task, go through the `router` skill — don't pick
  engine/genre skills by hand.
- Exemption: `prototype-fast` spikes and `game-jam` builds are pre-ontology, on a
  separate branch/repo, never merged.
