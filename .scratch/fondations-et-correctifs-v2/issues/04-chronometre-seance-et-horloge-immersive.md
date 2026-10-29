# 04: Machine à états Chronomètre de Séance & Horloge discrète du Mode Immersif

**What to build:** Extraire et tester en TDD le **deep module** `session-timer` (piloté par une horloge `now` injectée) qui unifie dans une seule machine à états le chronomètre de l'exercice actif, le passage en dépassement (`overtime`), le cumul des pauses, le minuteur Pomodoro, la Pause café, la clôture automatique après 60 minutes d'inactivité (AFK) en `overtime`, et la formule unique de durée réelle de la séance. Brancher ce module sur la **Vue Séance** et le **Mode Immersif**, et ajouter tout en haut au centre du **Mode Immersif** l'horloge discrète au format 24h (`HH:MM`).

**Blocked by:** 01: Socle Vitest, Ménage du dépôt & Finitions UI Tablette

**Recommended model:** **Gemini 4 Argon (Medium)** — Conception d'une machine à états temporelle déterministe remplaçant 5 états globaux concurrents.

**Status:** resolved

- [x] Le module `session-timer` est testé de façon déterministe sous `vitest` (sans `setTimeout` réel, par injection de timestamps `now`) sur : l'exclusivité d'un seul exercice actif à la fois, le passage en `overtime`, la suspension automatique de l'exercice et du cumul de séance pendant une Pause café, le déclenchement Pomodoro, et la clôture automatique AFK au bout de 60 minutes sans interaction en `overtime` (avec soustraction exacte des 3 600 secondes d'inactivité).
- [x] La **Vue Séance** et le **Mode Immersif** délèguent leurs transitions temporelles et le calcul de la durée réelle au module `session-timer`.
- [x] En **Mode Immersif** uniquement (ni dans la **Vue Séance**, ni dans le **Lecteur de Partition**), l'heure courante au format 24h (`HH:MM`) s'affiche centrée tout en haut en très petit et en couleur secondaire atténuée, mise à jour automatiquement chaque minute.
