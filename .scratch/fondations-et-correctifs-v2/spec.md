# Spec 1 : Fondations d'Architecture Deep, Ergonomie Tablette & Système Android

Status: ready-for-agent

## Problem Statement

Au fil des itérations rapides, l'application **Jazz Trane'R** s'est concentrée dans un monolithe JavaScript unique de près de 10 000 lignes sans suite de tests automatisés, mêlant logique métier, manipulation directe du DOM, faux routeur HTTP en mémoire et appels système Capacitor dispersés. Parallèlement, l'utilisation quotidienne sur tablette Android et sur PC met en évidence plusieurs frictions concrètes :

1. **Dette structurelle et dispersion du domaine** : la forme d'un **Item** de bibliothèque n'est pas canonique (sous-catégories tantôt chaîne tantôt tableau, styles iReal Pro polluant les sous-catégories, compteur de pratiques manipulé à 48 endroits), le calcul de durée réelle d'une séance diverge entre les cartes de l'Historique et les graphiques, et le Trieur Express triplique sa logique de fusion.
2. **Encombrement de la Bibliothèque et manque d'attributs musicaux** : le premier **Cadre** d'ajout permanent prend la moitié de l'écran, oblige à remonter tout en haut de la liste lors d'une modification (perdant la position de défilement), et les **Items** ne disposent pas d'**Attributs d'item** dédiés (`compositeur`, `style`, `tonalite`, `tempo`) séparés des sous-catégories/Setlists.
3. **Frictions d'import dans le Trieur Express** : l'utilisateur manque de repères sur l'action en cours (création vs fusion d'enrichissement) et les variantes orthographiques des standards de jazz (ex. `"Bags' Groove"` vs `"Bag's Groove"`, `"'Round Midnight"` vs `"Round Midnight"`) créent des doublons non désirés lors des imports par lot.
4. **Imperfections visuelles et tactiles sur tablette** : les boutons conservent un état de survol (« sticky hover ») après un tap tactile ; les badges de temps changent de largeur à chaque seconde ; les titres des **Cadres** d'outils (Métronome, Dictaphone, Lecteur Audio, Trieur Express) ne respectent pas la typographie `--text-muted` en petites majuscules ; il manque un repère discret de l'heure courante (`HH:MM`) en **Mode Immersif** ; le camembert des statistiques est difficile à lire lorsque les teintes du thème sont proches ; et le balayage (swipe) des partitions PDF clignote sans prévisualiser la page adjacente.
5. **Intégration système Android incomplète** : l'écran de lancement (Splash Screen) d'une seconde étire l'image sur la tablette ; l'export de sauvegarde écrit dans un cache invisible via la feuille de partage au lieu de laisser choisir un dossier ; les notifications de fin de minuteur surgissent même quand l'utilisateur est devant l'application ouverte et s'empilent sans l'icône de l'application ; et la permission microphone est demandée dès le premier démarrage à froid sans mécanisme de récupération si l'utilisateur la refuse.

## Solution

Nous refondons le cœur de **Jazz Trane'R** autour de **6 modules profonds (deep modules)** sans bundler ([ADR-0001](../../docs/adr/0001-modules-vanilla-sans-bundler.md)), couverts par une suite de tests unitaires automatisés (`vitest`), tout en livrant l'ensemble des améliorations d'interface, de fluidité PDF et d'intégration système Android/PC :

1. **Assainissement et Modules Deep** : extraction de la logique métier dans des modules autonomes (`library-domain`, `session-timer`, `history-analytics`, `score-navigation`, `storage-repo`, `system-host`), suppression du faux routeur HTTP, déplacement des fichiers de démonstration hors du dossier embarqué dans l'APK, et correction du cache hors-ligne.
2. **Refonte de la Bibliothèque, des Attributs d'item et du Menu `⋮`** : suppression du premier **Cadre** fixe d'ajout dans la Bibliothèque ; déplacement des boutons d'outils (*Importer et Trier*, *iReal Pro*, *Dictaphone*, *Cahier*, ainsi qu'un bouton *+ Ajouter*) dans l'en-tête ; remplacement des boutons *Modifier / Supprimer* de chaque carte par un menu d'options `⋮` ouvrant une modale unique d'ajout/édition (sans perte du scroll) prenant en charge les 4 **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`) ; suppression de la catégorie `Projets` par défaut (les **Setlists** étant les sous-catégories de `Morceaux`).
3. **Trieur Express intelligent à 2 niveaux** : ajout d'un guidage clair, d'une détection de doublons par canonisation jazz (`"Bags' Groove"` = `"Bag's Groove"`) et par proximité orthographique (*« Vous vouliez dire… ? »*), d'une fusion par enrichissement non-destructif des **Attributs d'item**, et d'un choix entre *Mode Rapide* (tout auto) et *Mode Prudent* (arrêt sur les nouveaux items et les doublons probables).
4. **Ergonomie Tablette, Horloge Immersive, Camembert & Objectif Hebdomadaire** : désactivation du survol persistant sur écran tactile, largeur tabulaire fixe sur tous les badges temporels, harmonisation typographique des titres d'outils, horloge `HH:MM` minuscule centrée tout en haut du **Mode Immersif**, réglage d'objectif hebdomadaire avec jauge sur l'Historique, et affichage direct des étiquettes (`Catégorie · %`) sur le camembert.
5. **Swipe PDF fluide par Double-Buffering** : isolation de la navigation du **Lecteur de Partition** et du **Mode Live** avec pré-rendu silencieux des pages $N-1$ et $N+1$ permettant à la page de suivre physiquement le doigt au glissement sans aucun clignotement (et verrouillage du swipe à 1 doigt lorsqu'un outil d'annotation est actif).
6. **Système Android & Sauvegardes Natives** : Splash Screen non déformé sur fond `#110d0a`, dialogue système natif « Enregistrer sous… » sur Android et PC ([ADR-0002](../../docs/adr/0002-dialogue-natif-sauvegarde-saf.md)) avec bilan détaillé après restauration, notifications silencieuses au premier plan et non-empilables en arrière-plan avec icône dédiée et interrupteur ON/OFF, et gestion contextuelle de la permission microphone à l'ouverture du Dictaphone.

## User Stories

1. En tant que musicien sur tablette tactile, je veux que les boutons (comme *Ajouter à la séance*) reviennent immédiatement à leur aspect de repos après un tap, afin qu'ils ne restent pas visuellement enfoncés ou illuminés.
2. En tant que musicien en **Mode Immersif**, je veux voir l'heure actuelle au format 24h (`HH:MM`) affichée en tout petit et centrée tout en haut de l'écran, afin de ne pas rater l'heure de fin de réservation de ma salle de répétition sans être distrait.
3. En tant qu'utilisateur en **Vue Séance** ou en préparation de séance, je veux que tous les badges affichant un temps ou un compte à rebours conservent une largeur strictement fixe à chaque seconde, afin que les boutons voisins ne tremblent jamais.
4. En tant qu'utilisateur ouvrant le Métronome, le Dictaphone, le Lecteur Audio ou le Trieur Express, je veux que les titres de sections internes utilisent le même style en petites majuscules espacées et couleur secondaire (`--text-muted`) que les **Cadres** principaux de l'application, afin que la direction artistique soit homogène.
5. En tant qu'utilisateur ouvrant la Bibliothèque, je veux accéder directement à la liste de mes **Items** sans qu'un grand **Cadre** de formulaire d'ajout occupe le haut de la page, afin de voir immédiatement mon répertoire.
6. En tant qu'utilisateur dans la Bibliothèque, je veux retrouver les boutons d'action (*+ Ajouter*, *Importer et Trier*, *iReal Pro*, *Dictaphone*, *Cahier*) regroupés proprement en haut de la vue, afin de déclencher n'importe quel outil en un tap.
7. En tant qu'utilisateur ajoutant ou modifiant un **Item**, je veux que le formulaire s'ouvre dans une modale dédiée, afin de pouvoir modifier un morceau au milieu de ma bibliothèque sans perdre ma position de défilement.
8. En tant qu'utilisateur parcourant ma Bibliothèque, je veux que chaque carte d'**Item** affiche un unique bouton d'options `⋮` (3 petits points) ouvrant le choix entre *Modifier* et *Supprimer*, afin d'alléger visuellement chaque ligne de la bibliothèque.
9. En tant que musicien de jazz, je veux pouvoir renseigner et modifier quatre **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`) sur mes morceaux et exercices, afin de conserver les informations musicales essentielles sans polluer mes sous-catégories.
10. En tant qu'utilisateur consultant ma Bibliothèque, je veux que les **Attributs d'item** renseignés s'affichent sobrement sous le titre (séparés par un point médian) et que leur absence sur certains **Items** ne crée aucun vide ni déséquilibre visuel.
11. En tant qu'utilisateur configurant mes séances et ma bibliothèque, je veux que les catégories par défaut bilingues (FR/EN) soient propres et génériques (`Voicings`, `Patterns`, `Licks`, `Morceaux`, `Relevés`, `Technique`), sans la catégorie redondante `Projets` ni d'anciennes références personnelles, et que les sous-catégories de `Morceaux` correspondent à mes **Setlists**.
12. En tant qu'utilisateur ouvrant le Trieur Express via *Importer et Trier* ou un partage iReal Pro, je veux lire un court bandeau explicatif en haut de la modale et voir clairement si le fichier courant va créer un nouvel **Item** ou enrichir un **Item** existant, afin de comprendre immédiatement l'action proposée.
13. En tant qu'utilisateur important une salve de morceaux dont le titre comporte des variantes de ponctuation ou d'article (ex. `"Bags' Groove"` vs `"Bag's Groove"`, `"'Round Midnight"` vs `"Round Midnight"`, `"Autumn Leaves, The"`), je veux que l'application les reconnaisse automatiquement comme une correspondance exacte, afin d'éviter la création de doublons.
14. En tant qu'utilisateur important un fichier dont le titre est très proche mais non identique à un **Item** existant (ex. faute de frappe d'une ou deux lettres), je veux que le Trieur Express me signale un « Doublon probable » (*« Vous vouliez dire [Titre] ? »*) permettant de fusionner en un clic, afin de garder ma bibliothèque propre.
15. En tant qu'utilisateur fusionnant un import (iReal Pro, PDF, audio ou catalogue JSON) avec un **Item** existant, je veux que la fusion enrichisse les **Attributs d'item** manquants (`compositeur`, `style`, `tonalite`, `tempo`), la grille et les fichiers liés sans jamais écraser les données déjà présentes ni injecter le style musical dans les sous-catégories.
16. En tant qu'utilisateur traitant un lot de fichiers dans le Trieur Express, je veux pouvoir choisir entre un **Mode Rapide** (qui fusionne les doublons exacts et crée automatiquement tous les nouveaux **Items**) et un **Mode Prudent** (qui fusionne les doublons exacts en silence mais s'arrête pour me demander confirmation sur chaque nouvel **Item** ou doublon probable).
17. En tant que musicien lisant une partition PDF multi-pages dans le **Lecteur de Partition** ou en **Mode Live**, je veux que le glissement de mon doigt fasse coulisser fluidement la page courante vers la page suivante ou précédente déjà pré-rendue, sans aucun écran vide ni clignotement.
18. En tant que musicien annotant une partition au stylet ou au doigt (crayon, surligneur ou gomme actif), je veux que le glissement à un doigt dessine sur la partition sans jamais déclencher de tourné de page involontaire.
19. En tant que musicien jouant une **Setlist** en **Mode Live**, je veux que tourner la dernière page d'un morceau m'amène sans accroc à la première page du morceau suivant de la **Setlist**.
20. En tant qu'utilisateur consultant le Tableau de bord de l'Historique, je veux que la durée totale affichée sur les cartes de synthèse et dans les graphiques repose sur une formule unique et identique, afin qu'il n'y ait jamais d'écart entre les indicateurs.
21. En tant qu'utilisateur ouvrant le graphique de répartition par catégories (camembert / doughnut), je veux voir le nom de la catégorie et son pourcentage directement rattachés à chaque part du graphique avec un contraste net entre segments voisins, afin d'identifier chaque part au premier coup d'œil quel que soit le thème actif.
22. En tant que musicien soucieux de ma régularité, je veux pouvoir définir un objectif hebdomadaire d'heures de pratique dans les Paramètres et visualiser ma progression sur la carte « Cette semaine » de l'Historique.
23. En tant qu'utilisateur sauvegardant mes données (Sauvegarde rapide `.json` ou Sauvegarde complète `.zip`) sur tablette Android ou sur PC, je veux que l'application ouvre systématiquement l'explorateur système natif « Enregistrer sous… » me permettant de choisir le dossier de destination, afin de savoir exactement où se trouve mon fichier.
24. En tant qu'utilisateur restaurant une sauvegarde `.json` ou `.zip`, je veux voir s'afficher un récapitulatif clair du nombre d'**Items**, de partitions/médias et de séances restaurés une fois l'opération terminée.
25. En tant que musicien pratiquant devant ma tablette avec l'application ouverte au premier plan, je veux qu'aucune bannière de notification système Android ne vienne doubler l'alerte sonore interne à la fin d'un minuteur.
26. En tant que musicien ayant mis l'application en arrière-plan ou verrouillé l'écran pendant un minuteur, je veux recevoir une unique notification Android arborant le logo de **Jazz Trane'R** qui remplace toute notification précédente sans s'empiler et s'efface dès que je reviens dans l'application.
27. En tant qu'utilisateur dans les Paramètres, je veux disposer d'un interrupteur ON/OFF permettant d'activer ou de désactiver les notifications système de fin de minuteur.
28. En tant qu'utilisateur lançant l'application sur tablette Android, je veux que l'écran de démarrage initial (Splash Screen) affiche le logo centré sans aucune déformation sur le fond sombre chaud `#110d0a` pendant la première seconde de chargement.
29. En tant qu'utilisateur au premier lancement de l'application, je ne veux pas être interrompu à froid par une demande de permission microphone tant que je n'ai pas ouvert le Dictaphone.
30. En tant qu'utilisateur ayant refusé la permission microphone par le passé et tentant d'enregistrer avec le Dictaphone, je veux voir une modale explicative claire dotée d'un bouton ouvrant directement les paramètres de permissions Android de l'application, afin de pouvoir réactiver le micro sans être bloqué.

## Implementation Decisions

1. **Architecture modulaire sans bundler ([ADR-0001](../../docs/adr/0001-modules-vanilla-sans-bundler.md))** :
   - Les nouveaux **deep modules** sont placés dans `www/modules/` et chargés dans `index.html` avant `script.js`.
   - Chaque module utilise une enveloppe universelle légère (exposant son interface sur `window` dans le navigateur et via `module.exports` sous Node) pour être directement testable par `vitest` sans étape de bundling.
   - Les fichiers de démonstration de palettes et de thèmes sont déplacés de `www/` vers la racine du dépôt afin de ne plus être copiés dans l'APK Android lors de la synchronisation Capacitor.
   - Le Service Worker met en cache l'ensemble des fichiers de code (y compris le dictionnaire d'internationalisation et les nouveaux modules).

2. **Module 1 : Domaine Bibliothèque, Setlists, Attributs d'item & Ingestion (`library-domain`)** :
   - **Contrat canonique d'un Item** : Tout **Item** entrant ou sortant du module est normalisé sous la forme :
     ```js
     {
       id: number,
       titre: string,
       type_item: string,          // Catégorie (ex: "Morceaux", "Voicings", "Licks", "Patterns", "Relevés", "Technique")
       sous_categories: string[],  // Pour "Morceaux", représente les Setlists auxquelles appartient le morceau
       attributs: {
         compositeur: string | null, // Compositeur du morceau ou Artiste/Source du relevé/lick
         style: string | null,       // Ex: "Medium Swing", "Ballad", "Waltz"
         tonalite: string | null,    // Tonalité d'origine ou de référence
         tempo: number | null        // BPM indicatif ou cible
       },
       fichier_image: string[],    // Toujours un tableau de clés/chemins de fichiers (0, 1 ou N pages)
       fichier_audio: string | null,
       ireal_data: { grille: string | null, tona_origine: string | null },
       cahier_data: object | null,
       favori: boolean,
       stats: { nb_pratiques: number, date_derniere_pratique: string | null }
     }
     ```
   - La normalisation convertit de façon transparente les anciens formats (`nom` → `titre`, `sous_categorie` chaîne → tableau, `fichier_image` séparé par `|` → tableau, anciens champs `ireal_data.compositeur` / `ireal_data.style` / `tonalite` racine → `attributs`), et purge automatiquement les noms de styles iReal Pro qui s'étaient glissés dans `sous_categories`.
   - **Catégories par défaut** : Suppression de `Projets` / `Projects` dans les dictionnaires FR et EN et suppression des références résiduelles codées en dur (`aem`, `jazz 1460`). Les **Setlists** restent les sous-catégories de `Morceaux` (avec maintien de leur ordre de passage).
   - **Tirage du Mode Immersif** : Le module encapsule l'algorithme ensembliste (filtrage strict par catégorie, intersection avec `Favoris` et union des sous-catégories/Setlists cochées, puis tri par favoris, nombre de pratiques croissant et ancienneté).
   - **Ingestion et Appariement à 2 niveaux (Trieur Express)** :
     - *Niveau 1 (Canonisation Jazz exacte)* : minuscule, suppression des accents et de toute ponctuation (`'`, `’`, `"`, `.`, `-`), normalisation des articles en fin de titre (`, The` / `, Le` / `, La` / `, Les` ramenés au début) et de `st` ↔ `saint`. Deux titres ayant la même forme canonique (ex. `"Bags' Groove"` et `"Bag's Groove"`, `"'Round Midnight"` et `"Round Midnight"`) sont traités comme une **Correspondance Exacte**.
     - *Niveau 2 (Doublon Probable)* : si aucune correspondance exacte n'existe mais qu'un **Item** de même catégorie présente une similarité de Levenshtein normalisée $\ge 0.80$ (ou inclusion de préfixe significatif), le module retourne une suggestion `probableMatch` (*« Vous vouliez dire… ? »*).
     - *Enrichissement non-destructif* : lors d'une fusion, les **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`), la grille `ireal_data`, les pages de partition, l'audio et les Setlists sont fusionnés sans jamais écraser une valeur déjà renseignée sauf demande explicite.
     - *Modes de lot* : le module supporte le **Mode Rapide** (applique les fusions exactes et crée automatiquement les nouveaux items) et le **Mode Prudent** (applique silencieusement les fusions exactes et s'arrête sur le premier item qui est soit un doublon probable, soit une nouvelle création).

3. **Refonte UI de la Bibliothèque et du Trieur Express** :
   - Suppression du premier **Cadre** permanent « Ajouter à la bibliothèque » dans la vue Bibliothèque.
   - L'en-tête de la Bibliothèque regroupe désormais le bouton principal `+ Ajouter` et les boutons d'outils (*Importer et Trier*, *iReal Pro*, *Dictaphone*, *Cahier de musique*).
   - Création d'une modale unique d'ajout/édition d'**Item** contenant le titre, la catégorie, les sous-catégories/Setlists, les 4 **Attributs d'item** (`compositeur`, `style`, `tonalite`, `tempo`), la partition et l'audio.
   - Sur chaque carte d'**Item** dans la liste de la Bibliothèque, les boutons *Modifier* et *Supprimer* sont remplacés par un unique bouton `⋮` ouvrant un menu contextuel léger (*Modifier*, *Supprimer*). Sous le titre de l'**Item**, les **Attributs d'item** présents sont affichés sur une ligne secondaire discrète séparés par ` · `.

4. **Module 2 : Machine à États Temporelle de Séance (`session-timer`)** :
   - Encapsule dans une machine à états pure (pilotée par un timestamp `now` injecté) l'exercice actif, le passage en dépassement (`overtime`), la pause d'exercice, le compteur Pomodoro, la Pause café et la détection d'inactivité (AFK).
   - Invariants garantis : démarrer un exercice met en pause tout autre exercice actif ; démarrer une Pause café met en pause l'exercice courant et suspend le décompte de la durée réelle de la séance ; atteindre 60 minutes sans interaction utilisateur alors qu'un exercice est en `overtime` déclenche la clôture AFK en retranchant 3 600 secondes d'inactivité.
   - Fournit une fonction unique de calcul de la durée réelle d'une séance, utilisée aussi bien en direct qu'à la clôture et dans l'Historique.

5. **Module 3 : Analytique d'Historique (`history-analytics`) & Camembert** :
   - Calcule de manière pure (à partir de la liste des séances terminées, de la date courante `now` et de l'objectif hebdomadaire configuré) : le temps pratiqué sur la semaine courante, le pourcentage d'atteinte de l'objectif hebdomadaire, le taux de complétion moyen, la série de jours consécutifs (`streak`), la tonalité reine (avec regroupement enharmonique et relative majeure), et les séries de données pour les 3 graphiques (Temps, Catégories, Tonalités).
   - Le graphique en anneau (camembert des catégories) utilise un plugin de dessin Canvas sur-mesure qui affiche directement sur ou autour des segments l'étiquette et le pourcentage (`Catégorie · XX%`) avec une palette contrastée dérivée du thème actif.

6. **Module 4 : Navigation du Lecteur de Partition & Double-Buffering PDF (`score-navigation`)** :
   - Isole la machine à états de pagination du **Lecteur de Partition**, du **Mode Live** et du Cahier manuscrit : calcul de la position courante, des bornes de page, de la transition automatique au morceau suivant/précédent d'une **Setlist** en **Mode Live**, et de la clé d'annotation par page.
   - Lorsqu'aucun outil d'annotation (crayon, surligneur, gomme, texte) n'est actif, le glissement horizontal à un doigt est autorisé et déplace visuellement le conteneur de page. Lorsqu'un outil d'annotation est actif, le swipe à un doigt est réservé au tracé sur le canvas d'annotation.
   - Pour les documents PDF, le **Lecteur de Partition** maintient un cache de 3 canvas (`prev`, `current`, `next`) : dès l'affichage de la page $N$, les pages $N-1$ et $N+1$ sont pré-rendues en arrière-plan afin que le glissement du doigt dévoile instantanément la page adjacente sans effacement (`clearRect`) ni clignotement.

7. **Module 5 : Persistance Locale & Archives (`storage-repo`)** :
   - Remplace le faux routeur HTTP `apiFetch` par une interface directe de dépôt gérant les stores IndexedDB (`seances`, `vocabulaire`, `routines`, `images`, `annotations`) et la cohérence du cache mémoire.
   - Encapsule derrière un **seam** interne le stockage binaire des partitions et fichiers audio (avec un **adapter** Capacitor Filesystem sur Android et un **adapter** IndexedDB sur Web/test).
   - Gère la construction et la restauration des archives de sauvegarde `.json` et `.zip` et retourne un objet de bilan (`{ itemsRestaures, mediasRestaures, seancesRestaurees, routinesRestaurees }`) affiché à l'utilisateur après import.

8. **Module 6 : Système Hôte (`system-host`) & Intégration Android (`MainActivity.java`)** :
   - **Sauvegardes ([ADR-0002](../../docs/adr/0002-dialogue-natif-sauvegarde-saf.md))** : Sur Android, le pont natif expose une méthode ouvrant le sélecteur système `Intent.ACTION_CREATE_DOCUMENT` pour écrire l'archive `.zip` ou `.json` à l'emplacement choisi par l'utilisateur ; sur PC, le module utilise `window.showSaveFilePicker` (avec repli sur téléchargement standard).
   - **Notifications** : Ajout d'un réglage ON/OFF dans les Paramètres (actif par défaut). Si l'application est au premier plan (`document.visibilityState === 'visible'`), aucune notification système n'est émise (seul le signal sonore interne joue). Si l'application est en arrière-plan, une notification unique (`id = 1000`) utilisant l'icône monochrome dédiée de **Jazz Trane'R** et la couleur `#e3a24a` est programmée, et automatiquement effacée dès le retour au premier plan.
   - **Permission Microphone** : Retrait de la demande `requestPermissions` dans `onCreate()` de `MainActivity.java`. La vérification/demande est déclenchée à l'ouverture du Dictaphone via le pont natif ; en cas de refus permanent (`!shouldShowRequestPermissionRationale`), une modale dédiée propose d'ouvrir les paramètres système de l'application (`Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)`).
   - **Splash Screen Android** : Remplacement du fond étiré dans `styles.xml` par un `layer-list` centré non déformé sur fond `#110d0a` et alignement de `capacitor.config.json` sur `#110d0a`.

9. **Finitions CSS & Ergonomie Tablette** :
   - Encapsulation des effets `:hover` des boutons dans `@media (hover: hover) and (pointer: fine)` et relâchement du focus après clic tactile.
   - Application de `font-variant-numeric: tabular-nums` et d'une largeur minimale fixe sur tous les badges de durée et chronomètres.
   - Harmonisation des titres de **Cadres** internes dans les modales d'outils avec `color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em`.
   - Ajout de l'horloge discrète `HH:MM` (24h, `11px`, `var(--text-muted)`, `opacity: 0.65`) centrée en haut du **Mode Immersif**.

## Testing Decisions

- **Qu'est-ce qu'un bon test dans ce dépôt** : Les tests s'exécutent via `vitest` et ciblent exclusivement l'**interface** publique des 6 **deep modules** (`www/modules/`). Ils vérifient les comportements observables et les invariants métier en entrée/sortie, jamais les détails d'implémentation internes ni la structure du DOM.
- **Modules testés** :
  1. `library-domain` : normalisation canonique des **Items** et des 4 **Attributs d'item**, purge des styles iReal Pro hors des sous-catégories, algorithme ensembliste de tirage du **Mode Immersif**, décodage `irealb://`, canonisation jazz (`"Bags' Groove"` = `"Bag's Groove"`) + distance de Levenshtein, fusion non-destructive et modes de lot Rapide vs Prudent.
  2. `session-timer` : transitions d'exercice, passage en `overtime`, cumul de pauses, suspension par la Pause café, déclenchement Pomodoro, clôture automatique AFK à +60 min d'`overtime` et calcul unifié de la durée réelle.
  3. `history-analytics` : calcul du temps hebdomadaire, du pourcentage d'objectif hebdomadaire, du `streak`, de la tonalité reine (relatives majeures) et des pourcentages exacts du camembert par catégorie.
  4. `score-navigation` : navigation paginée, cibles de pré-rendu ($N-1, N, N+1$), enchaînement des morceaux d'une **Setlist** en **Mode Live**, et blocage du swipe à un doigt lorsqu'un outil d'annotation est actif.
  5. `storage-repo` : opérations CRUD via un **adapter** en mémoire, sérialisation/restauration d'une sauvegarde et exactitude du compteur de bilan post-restauration.
  6. `system-host` : non-émission de notification système quand l'application est visible au premier plan, respect du bouton ON/OFF, et appel de l'**adapter** d'enregistrement de fichier.
- **Prior art** : Il s'agit de la première suite de tests automatisés du dépôt, qui servira de fondation à toutes les futures specs.

## Out of Scope

Les éléments suivants sont explicitement hors périmètre de cette Spec 1 (réservés pour la Spec 2 et la Roadmap long terme) :
- Le guide interactif de première utilisation (Onboarding Spotlight Tour), qui sera réalisé une fois l'ensemble des nouvelles fonctionnalités musicales en place.
- Le visualiseur vectoriel de grilles d'accords iReal Pro (`Bouton Grille`) et la transposition à la volée.
- Le réglage d'instrument transpositeur ($C / B\flat / E\flat$).
- Le bouton d'écoute d'extraits de 30 secondes via l'API iTunes (`Bouton Extrait`).
- Les nouvelles fonctionnalités pédagogiques issues de la recherche (Métronome *Gap Click / Inner Clock*, boucle *Call & Response* du lecteur audio, pratique entrelacée, matrice de maîtrise SRS, mode *Blindfold*).
- Le format d'échange `.jtrpack` et les intégrations B2B (*RealPlay*, *Open Studio*) ainsi que les applications sœurs (*Ear Trane'R*, *Jiz*, *Trane'R Arrange*).

## Further Notes

- Conformément aux décisions prises durant le grill, aucune migration complexe n'est ajoutée pour l'ancienne catégorie supprimée `Projets`.
- Toute la terminologie du code et de l'interface suit [GLOSSARY.md](../../GLOSSARY.md) (**Vue Séance**, **Mode Immersif**, **Lecteur de Partition**, **Mode Live**, **Cadre**, **Item**, **Attributs d'un item**, **Setlist**, **Routine**).
