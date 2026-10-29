# 06: Module Navigation Partition / Mode Live & Swipe PDF fluide (Double-Buffering)

**What to build:** Extraire et tester en TDD le **deep module** `score-navigation` qui gouverne la pagination du **Lecteur de Partition**, du **Mode Live** et du Cahier manuscrit (page courante, cibles de pré-rendu $N-1$ et $N+1$, bascule automatique vers le morceau suivant ou précédent d'une **Setlist** en **Mode Live**, clé d'annotation par page, et verrouillage du swipe de changement de page lorsqu'un outil d'annotation est actif). Implémenter dans le **Lecteur de Partition** le double-buffering PDF (pré-rendu silencieux des pages $N-1$ et $N+1$ dans des canvas hors-écran) et le suivi physique du doigt lors du glissement horizontal pour supprimer tout clignotement et écran vide.

**Blocked by:** 01: Socle Vitest, Ménage du dépôt & Finitions UI Tablette

**Recommended model:** **Gemini 4 Argon (Medium)** *(ou **High**)* — Gestion délicate des événements tactiles `touchmove`, du cycle de rendu asynchrone PDF.js et de la superposition du canvas d'annotations.

**Status:** done

- [x] Le module `score-navigation` est testé sous `vitest` sur : le calcul des indices de page et des voisins à pré-rendre ($N-1, N, N+1$), le passage fluide de la dernière page d'un morceau à la première page du morceau suivant (et inversement) dans une **Setlist** en **Mode Live**, et l'interdiction du tourné de page au swipe à un doigt dès qu'un outil de dessin (crayon, surligneur, gomme, texte) est actif.
- [x] Lors de la lecture d'une partition PDF multi-pages, les pages $N-1$ et $N+1$ sont pré-rendues en arrière-plan : glisser un doigt horizontalement fait coulisser la page courante et révèle immédiatement la page adjacente sans flash vide, sans spinner et sans clignotement (`clearRect`).
- [x] Lorsqu'un outil d'annotation est sélectionné dans la barre d'outils du **Lecteur de Partition**, glisser un doigt ou le stylet dessine normalement sur la partition sans jamais faire bouger ni tourner la page, et les annotations s'affichent toujours alignées sur la bonne page après chaque transition.
