# 08: Refonte ergonomique du Trieur Express, préparation du lot & affichage bibliothèque

**What to build:** Refondre l'ergonomie du **Trieur Express** avec un écran initial de préparation (sélection de catégorie globale, choix de setlists, création automatique/optionnelle de setlist iReal Pro, cartes Mode Rapide / Mode Prudent inspirées des cartes de sauvegarde des paramètres, bouton « Lancer l'import »). Moderniser l'en-tête (compteur texte discret et barre de progression au lieu d'un badge). Supprimer « Appliquer à tous », l'icône éclair et la détection de préfixes `Categorie_Titre`. En Mode Rapide, exécuter l'import et afficher un bilan final complet (créés, enrichis, doublons probables créés). En Mode Prudent, s'arrêter uniquement sur les nouveaux items et doublons probables avec boutons adaptés (« Ignorer », « Créer », « Fusionner »). Ajuster le regroupement : les PDF ne sont jamais regroupés multipages (gardent `26-2`), seules les images avec $\ge 2$ fichiers partageant la base sont regroupées. Normaliser les compositeurs iReal Pro en `Prénom Nom` (ex: `Coltrane John` -> `John Coltrane`). Dans la bibliothèque, intégrer « Pratiqué X fois » sur la ligne des attributs avec point médian, et masquer quand 0 fois.

**Blocked by:** 03: Module d'Ingestion iReal Pro / ZIP & Trieur Express intelligent à 2 niveaux

**Recommended model:** Gemini 3.8 Flash (High)

**Status:** done

- [x] `LibraryDomain.groupImportFiles` ne regroupe jamais les fichiers PDF multipages (chacun reste un item distinct avec son nom d'origine sans tronquer les suffixes tels que `-2`), et ne regroupe les images que s'il y a au moins 2 fichiers partageant la même base.
- [x] `LibraryDomain.normalizeComposerName` (ou au sein de `parseIRealLink`) inverse `Nom Prénom` en `Prénom Nom` pour les imports iReal Pro (sauf si composé avec `&`, `/` ou `,`).
- [x] Le Trieur Express s'ouvre sur un écran de préparation clair : choix de la catégorie globale (Morceaux par défaut), sélection de setlists existantes, option de création de setlist préremplie pour iReal Pro, cartes de sélection Mode Rapide / Mode Prudent, bouton « Lancer l'import ».
- [x] En-tête du Trieur Express avec texte sobre « Fichier X sur Y » et fine barre de progression, sans badge.
- [x] Les boutons d'action sont centrés, adaptés à la taille du texte, respectant la DA des modales (« Ignorer », « Créer », « Fusionner »).
- [x] Bilan récapitulatif en fin de traitement (notamment en Mode Rapide : créés, enrichis, doublons probables créés).
- [x] L'affichage des items dans la bibliothèque fusionne « Pratiqué X fois » sur la même ligne que les attributs (` · Pratiqué X fois`), et ne l'affiche pas si 0 fois.
- [x] Tests vitest complets pour le regroupement PDF/images, l'inversion de nom compositeur et les bilans de lot.
