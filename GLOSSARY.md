# Jazz Trane'R

Application de pratique quotidienne pour musiciens de jazz : on prépare une séance minutée, on la joue avec ses partitions et outils, et on suit sa progression dans le temps.

## Vues de travail

**Vue Séance** :
L'écran qui liste tous les exercices de la séance du jour, chacun avec son propre chronomètre.
_Éviter_ : Mode Pupitre, vue Pratique

**Mode Immersif** :
La vue focalisée sur un seul exercice en cours, qui présente les éléments de bibliothèque correspondants (liste ou tirage au sort).
_Éviter_ : Mode Pupitre, mode focus

**Lecteur de Partition** :
La vue plein écran qui affiche une partition (PDF, image, cahier manuscrit) avec ses outils d'annotation.
_Éviter_ : Mode Pupitre, visionneuse, plein écran

**Mode Live** :
L'état du Lecteur de Partition ouvert depuis une Setlist, pour enchaîner les morceaux en situation de concert.
_Éviter_ : Mode Concert, Mode Pupitre, gig mode

**Cadre** :
Un bloc visuel distinct qui regroupe une section d'une vue (délimité par un fond de carte et une bordure, avec un en-tête en petites majuscules).
_Éviter_ : encart, panneau, boîte, form-section

## Contenu

**Item** :
Toute fiche stockée dans la bibliothèque de l'utilisateur (morceau, lick, voicing, pattern, relevé, exercice technique, cahier manuscrit).
_Éviter_ : vocabulaire, élément de bibliothèque, ressource

**Attributs d'un item** :
Les quatre métadonnées musicales facultatives attachées à un item : `compositeur` (ou artiste/source), `style` (incluant la sensation rythmique comme Waltz ou Ballad), `tonalite` et `tempo`. Distincts des catégories et sous-catégories de classement.
_Éviter_ : métadonnées, tags, propriétés, métrique

**Setlist** :
Une liste ordonnée de morceaux destinée à être travaillée en séance ou jouée d'affilée en Mode Live.
_Éviter_ : playlist

**Routine** :
Un programme de séance réutilisable, enregistré pour être rechargé tel quel lors de la préparation d'une séance.
_Éviter_ : modèle, template

## Organisation du travail (méthode de développement)

**Série** :
Le nombre de jours consécutifs où au moins une séance de pratique a été menée à son terme.
_Éviter_ : streak, suite, flamme

**Calendrier de pratique** :
La grille mensuelle interactive visualisant les jours où des séances ont été réalisées et le volume d'assiduité.
_Éviter_ : heatmap, agenda, tableau de bord des jours

**Roadmap** :
La vision globale et à long terme du produit : ce à quoi l'application répond, son contenu cible et ses grandes orientations.
_Éviter_ : feuille de route (pour un patch), plan

**Spec** :
Un lot d'évolutions à moyen terme, cohérent et livrable, découpé en tickets.
_Éviter_ : patch, jalon principal, milestone

**Ticket** :
Une unité de travail d'une spec, implémentée dans une conversation dédiée et conclue par un commit.
_Éviter_ : jalon, tâche, étape

## Import

**Trieur Express** :
L'assistant d'import qui range un lot de fichiers (partitions, audio, grilles iReal Pro) dans la bibliothèque : chaque fichier crée un nouvel item ou enrichit un item existant.
_Éviter_ : inbox, importeur

**Correspondance Exacte** :
Deux titres considérés comme identiques malgré les variantes de casse, d'accents, de ponctuation ou d'article (`Bags' Groove` = `Bag's Groove`). Le fichier enrichit alors l'item existant, sans demander.
_Éviter_ : doublon strict

**Doublon Probable** :
Un titre très proche, mais pas identique, d'un item existant (faute de frappe). Le Trieur Express propose « Vous vouliez dire … ? » et laisse l'utilisateur décider.
_Éviter_ : quasi-doublon, match flou

**Mode Rapide / Mode Prudent** :
Les deux façons de lancer un import. Rapide : tout est traité sans interruption. Prudent : l'import s'arrête sur chaque nouvel item et chaque Doublon Probable pour demander quoi faire. Les Correspondances Exactes sont enrichies automatiquement dans les deux modes.
_Éviter_ : appliquer à tous, import automatique
