# 03: Module d'Ingestion iReal Pro / ZIP & Trieur Express intelligent à 2 niveaux

**What to build:** Étendre le module `library-domain` (avec tests TDD) pour y replier tout le pipeline d'ingestion (liens/fichiers `irealb://`, archives ZIP multipages, lots de fichiers PDF/images/audio et catalogues JSON) ainsi que la détection de doublons à 2 niveaux et la fusion par enrichissement non-destructif des **Attributs d'item**. Dans la modale du Trieur Express, ajouter un bandeau de guidage clair, afficher explicitement si l'action va créer un nouvel **Item** ou enrichir un **Item** existant, proposer en un clic les doublons probables (*« Vous vouliez dire [Titre] ? »*), et offrir le choix entre le **Mode Rapide** (tout auto) et le **Mode Prudent** (arrêt sur les nouveaux **Items** et les doublons probables).

**Blocked by:** 02: Domaine Bibliothèque, Attributs d'item, Menu ⋮ & Modale d'Ajout/Édition

**Recommended model:** **Gemini 4 Argon (Medium)** — Logique algorithmique fine (canonisation jazz, distance de Levenshtein, déduplication de 380 lignes dans le Trieur Express).

**Status:** ready-for-agent

- [ ] L'algorithme d'appariement à 2 niveaux est couvert par des tests `vitest` : le Niveau 1 (Canonisation Jazz : ignore casse, accents, apostrophes, ponctuation, inversion `, The` / `, Le`, `St.` ↔ `Saint`) identifie `"Bags' Groove"` et `"Bag's Groove"` ou `"'Round Midnight"` et `"Round Midnight"` comme une **Correspondance Exacte** ; le Niveau 2 (similarité de Levenshtein $\ge 0.80$) identifie les titres proches comme **Doublon Probable**.
- [ ] La fusion d'un import (iReal Pro, PDF, audio ou JSON) avec un **Item** existant enrichit de manière non-destructive les **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`), la grille `ireal_data`, les fichiers médias et les **Setlists**, sans jamais écraser un attribut déjà présent ni injecter le style dans `sous_categories`.
- [ ] Les ~380 lignes tripliquées dans le code du Trieur Express (aperçu, validation unitaire, validation par lot) sont unifiées derrière l'interface du module.
- [ ] La modale du Trieur Express affiche un bandeau pédagogique concis, distingue visuellement la création d'un nouvel **Item** de l'enrichissement d'un **Item** existant, et affiche une bannière cliquable *« Vous vouliez dire [Titre existant] ? »* lorsqu'un doublon probable est détecté.
- [ ] L'action de traitement par lot du Trieur Express permet de choisir entre le **Mode Rapide** (fusionne les doublons exacts et crée automatiquement tous les nouveaux **Items**) et le **Mode Prudent** (fusionne silencieusement les doublons exacts et s'arrête pour demander confirmation sur chaque nouvel **Item** ou doublon probable).
