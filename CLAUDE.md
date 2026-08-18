# Game project — ontology-driven

- Ce repo est développé **ontology-first** : toute nouvelle feature de gameplay commence par
  le skill `game-from-ontology` (qui enchaîne `ontology` puis `router`).
- `ontology/` à la racine du repo est la source de vérité : le router la met à jour d'abord
  (step 0), puis le développement la consomme. Jamais l'inverse.
- Pour toute tâche d'implémentation gamedev, passer par le skill `router` — ne pas choisir
  les skills moteur/genre à la main.
- Exemption : les spikes `prototype-fast` et les builds `game-jam` sont pré-ontologie, sur
  branche/repo séparé, jamais mergés.
