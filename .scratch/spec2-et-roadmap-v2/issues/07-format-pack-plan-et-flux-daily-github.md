# Spécification du format Pack, des Plans multi-séances et du flux Daily/Weekly

Type: grilling
Status: open
Blocked by: 04

## Question

En s'appuyant sur [Schéma canonique de la Grille, du Profil d'Instrument et indexation harmonique des cadences](04-modele-unifie-item-grille-et-transposition.md), définir le fonctionnement exact des **Packs**, des **Plans** et du flux de contenu distant :

1. **Format de fichier `Pack` (`.jtpack` / `.zip` + `pack.json`)** : Quelle est la structure exacte du manifeste d'un **Pack** pour encapsuler des **Items** (morceaux avec **Grille**, licks, voicings, PDF, fichiers `.musicxml`, pistes audio), des consignes pédagogiques, des **Routines** (à l'échelle d'une séance) et un **Plan** (parcours multi-séances sur plusieurs jours/semaines) ?
2. **Métadonnées Partenaires B2B (Open Studio, Jazz Lesson Videos / RealPlay)** : Quels champs et comportements d'interface permettent de mettre en valeur le créateur d'un **Pack** (bannière sobre, lien vers la vidéo de cours associée, liaison avec une piste *RealPlay*) sans polluer l'expérience des musiciens pros qui n'utilisent pas de **Packs** ?
3. **Flux automatique *Daily / Weekly Content* (GitHub Pages → Local-First)** : Quel est le schéma du manifeste distant `feed.json` et le workflow de synchronisation en arrière-plan pour que l'application détecte, télécharge et propose les nouveaux exercices hebdomadaires dès qu'une connexion est disponible ?
