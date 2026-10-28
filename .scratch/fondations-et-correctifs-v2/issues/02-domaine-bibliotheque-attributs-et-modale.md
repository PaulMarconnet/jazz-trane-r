# 02: Domaine Bibliothèque, Attributs d'item, Menu ⋮ & Modale d'Ajout/Édition

**What to build:** Extraire et tester en TDD le **deep module** du domaine de la Bibliothèque (`library-domain`), qui impose un contrat canonique sur chaque **Item** et ses 4 **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`), purge les faux styles iReal Pro des sous-catégories, supprime la catégorie par défaut `Projets` / `Projects` ainsi que les anciennes références personnelles en dur, gère les **Setlists** comme les sous-catégories de `Morceaux`, et exécute l'algorithme ensembliste de tirage du **Mode Immersif**. Côté interface, supprimer le premier **Cadre** fixe « Ajouter à la bibliothèque » pour afficher directement le répertoire avec une barre d'actions en haut (*+ Ajouter*, *Importer et Trier*, *iReal Pro*, *Dictaphone*, *Cahier*), remplacer les boutons *Modifier* et *Supprimer* de chaque carte par un menu `⋮` (*Modifier*, *Supprimer*), afficher sobrement les **Attributs d'item** sous le titre, et ouvrir l'ajout comme l'édition dans une modale dédiée sans perte de la position de défilement.

**Blocked by:** 01: Socle Vitest, Ménage du dépôt & Finitions UI Tablette

**Recommended model:** **Gemini 4 Argon (Medium)** — Chirurgie importante dans le monolithe et refonte de la vue Bibliothèque + création du premier grand module métier avec ses tests.

**Status:** done

- [x] Le module `library-domain` est testé unitairement via `vitest` sur : la normalisation canonique d'un **Item** (incluant la migration transparente des anciens champs vers les 4 **Attributs d'item** `compositeur`, `style`, `tonalite`, `tempo`), l'exclusion automatique des styles iReal Pro hors de `sous_categories`, et l'algorithme de tirage du **Mode Immersif** (intersection Catégorie ∩ Favoris ∩ Setlists/Sous-catégories et tri multicritère).
- [x] La catégorie `Projets` / `Projects` est retirée des catégories par défaut FR/EN et toute référence en dur à d'anciennes sous-catégories personnelles (`aem`, `jazz 1460`) est supprimée.
- [x] En ouvrant la Bibliothèque, le premier **Cadre** permanent de formulaire a disparu : l'utilisateur voit immédiatement ses **Items**, et les boutons *+ Ajouter*, *Importer et Trier*, *iReal Pro*, *Dictaphone* et *Cahier* sont accessibles dans l'en-tête.
- [x] Cliquer sur *+ Ajouter* ou sur *Modifier* depuis le menu `⋮` d'un **Item** ouvre une modale dédiée permettant de saisir ou modifier le titre, la catégorie, les sous-catégories/**Setlists**, les 4 **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`), la partition et l'audio, sans faire remonter le défilement de la page.
- [x] Sur chaque carte d'**Item** dans la Bibliothèque, les boutons crayon et poubelle sont remplacés par un unique bouton `⋮` ouvrant le menu *Modifier / Supprimer*, et les **Attributs d'item** renseignés s'affichent sobrement sous le titre séparés par ` · ` (sans laisser d'espace vide lorsqu'ils sont absents).
