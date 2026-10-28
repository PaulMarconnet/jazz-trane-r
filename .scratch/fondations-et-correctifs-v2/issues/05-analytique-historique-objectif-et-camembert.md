# 05: Module Analytique d'Historique, Objectif Hebdomadaire & Camembert étiqueté

**What to build:** Extraire et tester en TDD le **deep module** `history-analytics` pour unifier tous les calculs du Tableau de bord de l'Historique (durée réelle hebdomadaire et par période sans aucune divergence entre les cartes et les graphiques, taux de complétion, série de jours consécutifs `streak`, tonalité reine par relative majeure, et pourcentages par catégorie). Ajouter le réglage d'objectif hebdomadaire dans les Paramètres avec affichage de la progression sur la carte « Cette semaine », et afficher directement le nom de la catégorie et son pourcentage (`Catégorie · XX%`) sur ou autour des parts du camembert (doughnut chart).

**Blocked by:** 01: Socle Vitest, Ménage du dépôt & Finitions UI Tablette

**Recommended model:** **Gemini 3.8 Flash (High)** *(ou **Gemini 4 Argon (Low)**)* — Module de calcul pur bien circonscrit + plugin Chart.js Canvas.

**Status:** ready-for-agent

- [ ] Le module `history-analytics` est testé sous `vitest` (avec date `now` injectée) sur : l'identité stricte du total d'heures entre les indicateurs de synthèse et les séries des graphiques, le calcul du `streak` calendaire, le regroupement par tonalité relative majeure, la progression vers l'objectif hebdomadaire et les pourcentages exacts par catégorie.
- [ ] L'utilisateur peut définir un objectif hebdomadaire (en heures/semaine) dans les Paramètres, et la carte « Cette semaine » de l'Historique affiche visuellement la progression par rapport à cet objectif.
- [ ] Le graphique en camembert (répartition par catégories) affiche directement les étiquettes `Catégorie · XX%` rattachées à chaque segment avec un contraste net entre parts adjacentes, éliminant toute ambiguïté de lecture quel que soit le thème de couleurs actif.
