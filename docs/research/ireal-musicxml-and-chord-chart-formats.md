# Recherche : Décodage du protocole `irealb://`, extraction `<harmony>` MusicXML et grammaire texte bidirectionnelle de Grille

Ce document consigne les résultats de recherche sur les sources primaires pour l'ingestion, la représentation canonique et l'édition d'une **Grille** dans **Jazz Trane'R**.

---

## Sources primaires consultées

1. **Protocole et spécification iReal Pro** :
   - Documentation officielle Technimo : *iReal Pro Custom Chord Chart Protocol* (`irealpro.com/ireal-pro-custom-chord-chart-protocol`).
   - Implémentations de référence open-source (rétro-ingénierie de l'obfuscation `1r34LbKcu7` / `obfusc50` et de l'automate de cellules) :
     - Stephen Irons, `ironss/accompaniser` (`irealb_parser.lua` — implémentation historique ayant documenté la permutation `obfusc50`).
     - `jazzbox/irealpro_unobfuscate.swift` (portage fonctionnel de `partition(s, 50)` et `obfusc50`).
     - `pianosnake/ireal-reader` (`unscramble.js`, `Parser.js` — parseur JavaScript de référence).
     - Karim Ratib, `infojunkie/ireal-musicxml` (convertisseur TypeScript iReal Pro $\rightarrow$ MusicXML).
     - Johan Vromans, `sciurius/perl-Data-iRealPro` et `drs251/pyRealParser` (parseurs Perl et Python).
     - `chordsketch_ireal` / `ireal_parser` (crates Rust modélisant l'AST complet d'une **Grille** iReal Pro).
2. **Spécification W3C MusicXML 4.0** :
   - W3C MusicXML Community Group Specification — éléments [`<harmony>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/harmony/), [`<root>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/root/), [`<kind>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/kind/) (type [`kind-value`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/kind-value/)), [`<bass>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/bass/), [`<degree>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/degree/), [`<offset>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/offset/), [`<barline>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/barline/) et [`<direction>`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/direction/).
3. **Codebase actuelle** :
   - [`www/modules/library-domain.js`](../../www/modules/library-domain.js) (`parseIRealLink`, lignes 497–539).

---

## 1. Décodage complet du format `irealb://` (iReal Pro)

### 1.1 Structure de l'enveloppe URI (`irealb://` et `irealbook://`)

Après décodage URL (`decodeURIComponent`) et retrait du schéma (`irealb://`, `irealbook://` ou `irealpro://`), la charge utile contient un ou plusieurs morceaux séparés par `===`. Si le dernier segment après `===` ne contient aucun caractère `=`, il s'agit du nom de la playlist (ou **Setlist**).

Chaque morceau est découpé par le délimiteur `=` selon deux variantes historiques :

| Variante | Structure des champs séparés par `=` | Description des indices (`parts = chunk.split('=')`) |
| :--- | :--- | :--- |
| **Moderne (`irealb://`)** | `Titre=Compositeur==Style=Tonalité=n=Grille=CompStyle=BPM=Repeats` | `parts[0]` : Titre (`Nom, The` $\rightarrow$ `The Nom`)<br>`parts[1]` : Compositeur (`Nom Prénom` $\rightarrow$ `Prénom Nom`)<br>`parts[2]` : `""` (vide)<br>`parts[3]` : Style (`Medium Swing`, etc.)<br>`parts[4]` : Tonalité d'origine (`C`, `Bb`, `F-`, `A-`, etc.)<br>`parts[5]` : Transposition ou `n` (souvent vide ou `n`)<br>`parts[6]` : Chaîne de **Grille** (préfixée par `1r34LbKcu7`)<br>`parts[7]` : Style d'accompagnement optionnel<br>`parts[8]` : Tempo (BPM, `0` si par défaut)<br>`parts[9]` : Nombre de répétitions (`0` si par défaut) |
| **Historique (`irealbook://`)** | `Titre=Compositeur=Style=Tonalité=n=Grille` | `parts[0]` : Titre<br>`parts[1]` : Compositeur<br>`parts[2]` : Style<br>`parts[3]` : Tonalité<br>`parts[4]` : `n` (non utilisé)<br>`parts[5]` : Chaîne de **Grille** en clair (sans `1r34LbKcu7`) |

> [!IMPORTANT]
> Pour extraire de manière robuste le corps de la **Grille** quel que soit le nombre de champs vides intercalés, il faut :
> 1. Chercher le champ commençant par le préfixe magique `1r34LbKcu7` (format obfusqué moderne).
> 2. À défaut (format `irealbook://` en clair), prendre le premier champ à partir de `parts[4]` (ou `parts[5]`) qui contient des jetons de **Grille** (`|`, `[`, `{`, `T44`, `*A`, etc.).
> 3. Si `parts[8]` (ou l'avant-dernier champ numérique après la **Grille**) est un entier strictement positif (`> 0`), il fournit directement l'attribut `tempo` (BPM) de l'**Item**.

---

### 1.2 Algorithme exact de désobfuscation (`1r34LbKcu7` + `obfusc50`)

Lorsqu'une chaîne de **Grille** commence par les 10 caractères `1r34LbKcu7`, le reste de la chaîne (`payload = raw.slice(10)`) a subi l'algorithme d'obfuscation d'iReal Pro :

1. **À l'encodage (obfuscation par iReal Pro)** :
   - **Étape A (Substitutions littérales de compression/masquage)** :
     - `' |'` (espace + barre simple) $\rightarrow$ `'LZ'`
     - `'   '` (3 espaces consécutifs) $\rightarrow$ `'XyQ'`
     - `'| x'` (barre + espace + répétition de mesure) $\rightarrow$ `'Kcl'`
   - **Étape B (Permutation symétrique `obfusc50` / *hussle* par blocs de 50 caractères)** :
     - La chaîne est parcourue par blocs de 50 caractères (indices `0..49` relatifs au bloc).
     - **Condition de bord critique** (identifiée dans `ironss/accompaniser`, `pianosnake/ireal-reader` et `jazzbox/irealpro_unobfuscate.swift`) : un bloc de 50 caractères n'est permuté **que s'il reste au moins 2 caractères après ce bloc** (autrement dit, la longueur restante à partir du début du bloc doit être $\ge 52$, soit `remainingLength > 51`). Les 1 à 51 derniers caractères de la chaîne ne sont **jamais** permutés par `obfusc50`.
     - Dans chaque bloc de 50 caractères éligible, la permutation est une **involution symétrique** ($\forall i$, les échanges se font entre $i$ et $49 - i$) :
       - Les indices `0..4` (5 caractères) sont échangés et inversés avec les indices `45..49` ($\text{bloc}[i] \leftrightarrow \text{bloc}[49 - i]$ pour $0 \le i < 5$).
       - Les indices `5..9` (5 caractères) et leurs symétriques `40..44` restent **inchangés**.
       - Les indices `10..23` (14 caractères) sont échangés et inversés avec les indices `26..39` ($\text{bloc}[i] \leftrightarrow \text{bloc}[49 - i]$ pour $10 \le i < 24$).
       - Les indices centraux `24..25` (2 caractères) restent **inchangés**.

2. **Au décodage (désobfuscation dans Jazz Trane'R)** :
   - Puisque les substitutions (`LZ`, `XyQ`, `Kcl`) ont été faites *avant* la permutation `obfusc50` (ce qui inverse par exemple `LZ` en `ZL` lorsqu'il tombe dans les tranches `0..4` ou `10..23`), le décodage doit impérativement exécuter **d'abord** l'involution `obfusc50` sur chaque bloc de 50 caractères tant qu'il reste $\ge 52$ caractères, **puis** restaurer `'LZ'` $\rightarrow$ `' |'`, `'XyQ'` $\rightarrow$ `'   '` et `'Kcl'` $\rightarrow$ `'| x'`.

#### Code JavaScript exact et autonome (`unobfuscateIReal` & `obfuscateIReal`)

```javascript
const IREAL_MAGIC_PREFIX = '1r34LbKcu7';

/**
 * Applique l'involution symétrique sur un bloc de 50 caractères (indices 0..49).
 * Échange et inverse :
 *   - [0..4]   <-> [45..49] (pour i = 0..4,  swap(i, 49 - i))
 *   - [10..23] <-> [26..39] (pour i = 10..23, swap(i, 49 - i))
 * Les tranches [5..9], [24..25] et [40..44] restent intactes.
 *
 * @param {string} block50 - Chaîne d'exactement 50 caractères
 * @returns {string} Bloc permuté de 50 caractères
 */
function permuteBlock50(block50) {
    const chars = block50.split('');
    for (let i = 0; i < 5; i++) {
        const tmp = chars[i];
        chars[i] = chars[49 - i];
        chars[49 - i] = tmp;
    }
    for (let i = 10; i < 24; i++) {
        const tmp = chars[i];
        chars[i] = chars[49 - i];
        chars[49 - i] = tmp;
    }
    return chars.join('');
}

/**
 * Désobfusque une chaîne de progression iReal Pro (avec ou sans préfixe 1r34LbKcu7).
 *
 * @param {string} raw - Chaîne brute extraite du champ grille d'un lien irealb://
 * @returns {string} Chaîne de grille iReal Pro en clair
 */
function unobfuscateIReal(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    const body = trimmed.startsWith(IREAL_MAGIC_PREFIX)
        ? trimmed.slice(IREAL_MAGIC_PREFIX.length)
        : trimmed;

    // Si la chaîne ne portait pas le préfixe 1r34LbKcu7, elle est déjà en clair (format irealbook://)
    if (!trimmed.startsWith(IREAL_MAGIC_PREFIX)) {
        return body;
    }

    let result = '';
    let remaining = body;

    // Un bloc de 50 caractères n'est permuté que s'il reste au moins 2 caractères après lui (> 51)
    while (remaining.length > 51) {
        const chunk = remaining.slice(0, 50);
        remaining = remaining.slice(50);
        result += permuteBlock50(chunk);
    }
    result += remaining;

    // Restauration des séquences littérales substituées avant la permutation
    return result
        .replace(/Kcl/g, '| x')
        .replace(/LZ/g, ' |')
        .replace(/XyQ/g, '   ');
}

/**
 * Obfusque une chaîne de progression iReal Pro en clair vers le format 1r34LbKcu7.
 * Utile pour l'export vers iReal Pro et les tests de round-trip.
 *
 * @param {string} plain - Chaîne de grille iReal Pro en clair
 * @returns {string} Chaîne obfusquée préfixée par 1r34LbKcu7
 */
function obfuscateIReal(plain) {
    if (!plain || typeof plain !== 'string') return IREAL_MAGIC_PREFIX;
    const substituted = plain
        .replace(/\| x/g, 'Kcl')
        .replace(/ \|/g, 'LZ')
        .replace(/   /g, 'XyQ');

    let result = '';
    let remaining = substituted;
    while (remaining.length > 51) {
        const chunk = remaining.slice(0, 50);
        remaining = remaining.slice(50);
        result += permuteBlock50(chunk);
    }
    result += remaining;
    return IREAL_MAGIC_PREFIX + result;
}
```

---

### 1.3 Modèle de mise en page d'iReal Pro (grille de cellules)

Dans iReal Pro, la chaîne désobfusquée décrit une **grille visuelle de 16 cellules par ligne** (en général 4 mesures de 4 cellules par ligne) :
- Chaque accord, silence (`n`), répétition de temps (`p`), répétition de mesure (`x`, `r`) ou espace (`' '`) consomme **1 cellule** de la ligne courante.
- Les modificateurs de structure (barres de mesure `|`, `[`, `]`, `{`, `}`, `Z`, métriques `T44`, étiquettes de section `*A`, voltas `N1`, signes `S`, `Q`, `f`, `U`, changements de taille `s`, `l`, commentaires `<...>`) s'attachent à la cellule courante (ou à la frontière de mesure) **sans consommer de cellule supplémentaire**.

---

### 1.4 Table exhaustive des jetons de Grille iReal Pro

#### A. Barres de mesure (frontières de mesure, 0 cellule consommée)

| Jeton | Signification musicale | Rôle dans le parseur de **Grille** |
| :---: | :--- | :--- |
| `\|` | Barre de mesure simple | Ferme la mesure précédente (si ouverte) et/ou ouvre la mesure suivante |
| `[` | Double barre ouvrante (`\|\|`) | Ouvre une section ou le début de la **Grille** avec une double barre |
| `]` | Double barre fermante (`\|\|`) | Ferme la mesure courante avec une double barre de fin de section |
| `{` | Barre de reprise ouvrante (`\|:`) | Ouvre une section répétée (`repeatStart: true` sur la mesure qui suit) |
| `}` | Barre de reprise fermante (`:\|`) | Ferme la mesure courante avec une reprise (`repeatEnd: true`) |
| `Z` | Double barre finale (`\|]`) | Ferme la dernière mesure de la **Grille** (ou de la section avant Coda) |

> [!NOTE]
> Dans le flux iReal Pro, une barre fermante (`]`, `}`, `Z`) est souvent suivie immédiatement d'une barre ouvrante (`[`, `{`, `|`) ou d'un marqueur de section (`*B[`), sans qu'une mesure vide existe entre les deux. Le parseur doit distinguer les barres fermantes (`]`, `}`, `Z`), les barres ouvrantes (`[`, `{`) et la barre ambivalente (`|`).

#### B. Signatures rythmiques / Métriques (`T`, 0 cellule consommée)

| Jeton | Métrique | Jeton | Métrique |
| :---: | :---: | :---: | :---: |
| `T44` | $4/4$ | `T22` | $2/2$ (*Cut time* / Alla breve) |
| `T34` | $3/4$ | `T32` | $3/2$ |
| `T24` | $2/4$ | `T58` | $5/8$ |
| `T54` | $5/4$ | `T68` | $6/8$ |
| `T64` | $6/4$ | `T78` | $7/8$ |
| `T74` | $7/4$ | `T98` | $9/8$ |
| `T12` | $12/8$ (exception à 2 chiffres : `12` = $12/8$) | | |

#### C. Étiquettes de sections (`*`, 0 cellule consommée)

| Jeton | Section affichée | Jeton | Section affichée |
| :---: | :--- | :---: | :--- |
| `*A` | Section **A** | `*i` | **Intro** (`In`) |
| `*B` | Section **B** | `*v` | **Verse** (`V`) |
| `*C` | Section **C** | `*D` | Section **D** |

#### D. Boîtes de reprise / Voltas (`N`, 0 cellule consommée)

| Jeton | Signification |
| :---: | :--- |
| `N1` | 1re fin (1. — première volta) |
| `N2` | 2e fin (2. — deuxième volta) |
| `N3` | 3e fin (3. — troisième volta) |
| `N0` | Crochet de fin sans numéro affiché |

#### E. Signes de navigation, points d'arrêt et texte de portée (0 cellule consommée)

| Jeton | Symbole / Rôle | Description |
| :---: | :--- | :--- |
| `S` | Segno ($\mathcal{S}$ / `𝄋`) | Point de renvoi pour *Dal Segno* (*D.S.*) |
| `Q` | Coda (`𝄌`) | En cours de morceau : indique *To Coda* ; en fin de grille (souvent après `Z` ou `Y`) : indique le début de la section **Coda** |
| `f` | Fermata (`𝄐`) | Point d'orgue sur l'accord courant |
| `U` | `END` | Arrêt explicite sur le 1er temps de la mesure lors du dernier passage |
| `<texte>` | Texte / Indication | Texte libre entre chevrons attaché à la cellule courante. Sert notamment aux renvois et compteurs de reprises : `<D.C. al Coda>`, `<D.C. al Fine>`, `<D.S. al Coda>`, `<D.S. al Fine>`, `<Fine>`, `<3x>`, `<4x>`, `<Solos on AAB>`, etc. |

#### F. Répétitions de mesures, répétitions de temps, silences et mise en page

| Jeton | Cellules consommées | Signification |
| :---: | :---: | :--- |
| `' '` (espace) | 1 | Cellule vide (prolonge la durée de l'accord précédent dans la mesure) |
| `,` | 0 | Séparateur de jeton / remplissage sans durée propre |
| `n` | 1 | **No Chord** (`N.C.`) — silence harmonique explicite |
| `p` | 1 | **Slash de temps** (`/`) — répète l'accord précédent sur un temps explicite |
| `x` | 1 (centré) | **Répétition d'une mesure** (`%`) — la mesure entière répète la mesure précédente |
| `r` | 1 (sur 2 mes.) | **Répétition de deux mesures** (`%%`) — placé à cheval sur 2 mesures consécutives |
| `s` | 0 | Active la **petite police** d'accord (accords de passage serrés dans une mesure) |
| `l` | 0 | Restaure la **police normale** (large) d'accord |
| `Y`, `YY`, `YYY` | 0 (interligne) | Espacement vertical entre systèmes (1, 2 ou 3 crans verticaux) |

#### G. Grammaire des accords iReal Pro (1 cellule consommée par accord principal)

Un jeton d'accord iReal Pro obéit à l'expression régulière structurelle suivante :
```
^(?<root>[A-G][b#]?|W)(?<quality>[\^+\-dhob#0-9susaddalt*]*)?(?<alt>\*[^*]*\*)?(?<bass>\/[A-G][b#]?)?(?< paren >\([A-G][b#]?[^)]*\))?$
```
Plus précisément :
- **Fondamentale (`root`)** : `A`–`G` suivi optionnellement de `b` ou `#`, ou `W` (fondamentale invisible utilisée uniquement devant une basse `/Note` pour indiquer un changement de basse sous l'accord précédent, ex. `W/E`).
- **Qualités et extensions (`quality`)** :
  - Majeur : `^` ($\Delta$), `^7` ($\Delta7$), `^9` ($\Delta9$), `^13` ($\Delta13$), `^7#11`, `^9#11`, `^7#5`, `6`, `69`, `add9`, `2`.
  - Mineur : `-` ($\text{m}$), `-7` ($\text{m}7$), `-9` ($\text{m}9$), `-11` ($\text{m}11$), `-6` ($\text{m}6$), `-69`, `-^7` ($\text{m}\Delta7$), `-^9` ($\text{m}\Delta9$), `-7b5` (parfois écrit `h7`).
  - Dominante : `7`, `9`, `11`, `13`, `7sus`, `9sus`, `13sus`, `sus`, `sus4`, `sus2`, `7b9`, `7#9`, `7#11`, `7b13`, `7#5`, `7b5`, `7alt`, `9#11`, `9b5`, `9#5`, `13b9`, `13#11`, `7b9sus`, `7b9#9`, `7b9b13`, `7#9b13`, `7#9#11`, `7b9#11`, `7b9#5`.
  - Demi-diminué : `h` ou `h7` ($\oslash7$ / $\text{m}7\flat5$), `h9`.
  - Diminué : `o` ou `o7` ($\circ7$ / $\text{dim}7$), `o^7`.
  - Augmenté / Power chord : `+` ($\text{aug}$), `5` (quinte / power chord).
  - Extensions libres : `*texte*` affiche `texte` en exposant personnalisé.
- **Slash chord (`bass`)** : `/Note` (ex. `D-7/G`, `C^7/E`, `W/Bb`).
- **Accord alternatif (`alternate`)** : `(Accord)` placé entre parenthèses (soit attaché à l'accord principal, soit dans sa propre cellule comme `(G7)`), affiché au-dessus en petits caractères pour les substitutions harmoniques ou *turnarounds* optionnels.

---

## 2. Extraction d'une Grille mesurée depuis un fichier MusicXML (`.musicxml`)

Lorsqu'un fichier `.musicxml` (ou `.xml` non compressé exporté depuis MuseScore) est importé pour produire une **Partition Dynamique** ou extraire une **Grille**, les accords sont encodés dans des éléments `<harmony>` enfants directs de chaque `<measure>`.

### 2.1 Calcul de la position rythmique (temps) dans `<measure>`

Dans la spécification W3C MusicXML 4.0, `<harmony>` **n'avance pas** le curseur temporel de la mesure : il est ancré à la position courante du curseur musical, éventuellement décalée par un élément enfant `<offset>`.

Pour positionner chaque accord sur le bon temps de la mesure :
1. **Échelle temporelle (`<divisions>`)** :
   - Lire `<attributes><divisions>` (persistant d'une mesure à l'autre tant qu'il n'est pas redéfini). `divisions` représente le nombre d'unités de durée par **noire** ($\quarterNote$).
   - Lire `<attributes><time><beats>` ($N$) et `<beat-type>` ($D$). La durée d'un temps en divisions est :
     $$\text{divisionsPerBeat} = \text{divisions} \times \frac{4}{D}$$
     et la durée totale d'une mesure complète est $\text{measureDivisions} = N \times \text{divisionsPerBeat}$.
2. **Suivi du curseur temporel (`cursorDivisions`) dans la mesure** :
   - Au début de chaque `<measure>`, initialiser `cursorDivisions = 0`.
   - Parcourir les éléments enfants de `<measure>` dans l'ordre du document :
     - `<note>` :
       - Si la note contient `<grace/>` : durée = `0` (n'avance pas le curseur).
       - Si la note contient `<chord/>` : il s'agit d'une note simultanée de l'accord mélodique précédent (n'avance pas le curseur).
       - Sinon : après traitement, incrémenter `cursorDivisions += Number(duration)`.
     - `<forward>` : incrémenter `cursorDivisions += Number(duration)`.
     - `<backup>` : décrémenter `cursorDivisions = Math.max(0, cursorDivisions - Number(duration))`.
     - `<harmony>` :
       - Lire l'enfant optionnel `<offset>` (en divisions, peut être positif ou négatif).
       - La position exacte de l'accord en divisions depuis le début de la mesure est :
         $$\text{harmonyDivisions} = \max(0, \text{cursorDivisions} + \text{offset})$$
       - La position en temps (1-indexée, où `1` est le 1er temps) est :
         $$\text{beat} = 1 + \frac{\text{harmonyDivisions}}{\text{divisionsPerBeat}}$$
3. **Gestion des anacrouses (`implicit="yes"`)** :
   - MuseScore marque les mesures de levée (pickup / anacrouse) avec `<measure number="0" implicit="yes">` (ou une durée totale inférieure à $\text{measureDivisions}$).

> [!WARNING]
> **Instruments transpositeurs (`<transpose>`)** : Si la partie MusicXML contient `<attributes><transpose><chromatic>k</chromatic></transpose>` (ex. `-2` pour une partition en $\text{B}\flat$), MuseScore exporte les hauteurs écrites (`<root>` et `<note>`). Pour obtenir la **Grille** en tonalité de concert (ou connaître la tonalité écrite vs concert), il faut vérifier `<transpose>` et `<key><fifths>`.

---

### 2.2 Reconstruction du chiffrage depuis `<root>`, `<kind>`, `<bass>` et `<degree>`

Chaque élément `<harmony>` contient :

#### A. Fondamentale (`<root>`) ou silence harmonique (`<kind>none</kind>`)
- `<root-step>` : lettre `A`..`G`.
- `<root-alter>` : entier ou flottant optionnel (`-2` $\rightarrow$ `bb`, `-1` $\rightarrow$ `b`, `0` $\rightarrow$ `""`, `1` $\rightarrow$ `#`, `2` $\rightarrow$ `##`).
- Si `<kind>` vaut `none` (ou si `<root>` est absent et `<kind text="N.C.">`), le jeton est `N.C.` (silence harmonique).
- *(Cas particulier)* Si `<harmony>` contient `<function>` ou `<numeral>` au lieu de `<root>`, il s'agit déjà d'un degré fonctionnel.

#### B. Table de correspondance W3C `kind-value` $\rightarrow$ symbole canonique Jazz

La spécification W3C MusicXML définit 33 valeurs pour `<kind>`. MuseScore renseigne en outre souvent l'attribut `text="..."` sur `<kind>` (ex. `<kind text="m7b5">half-diminished</kind>`).

> [!TIP]
> **Règle de priorité pour MuseScore** : Toujours partir de la valeur normalisée de `<kind>` combinée aux `<degree>` enfants (qui est sémantiquement exacte et indépendante de la police d'accords de l'utilisateur dans MuseScore), et n'utiliser l'attribut `text` de `<kind>` qu'en repli lorsque `<kind>` vaut `other`.

| Valeur W3C `<kind>` | Triade / Base implicite | Symbole canonique Jazz Trane'R | Équivalent iReal Pro |
| :--- | :--- | :--- | :--- |
| `major` | $1, 3, 5$ | `""` (ex. `C`) | `C` |
| `minor` | $1, \flat3, 5$ | `m` (ex. `Cm`) | `C-` |
| `augmented` | $1, 3, \sharp5$ | `+` ou `aug` (ex. `C+`) | `C+` |
| `diminished` | $1, \flat3, \flat5$ | `dim` (ex. `Cdim`) | `Co` |
| `dominant` | $1, 3, 5, \flat7$ | `7` (ex. `C7`) | `C7` |
| `major-seventh` | $1, 3, 5, 7$ | `maj7` (ex. `Cmaj7`) | `C^7` |
| `minor-seventh` | $1, \flat3, 5, \flat7$ | `m7` (ex. `Cm7`) | `C-7` |
| `diminished-seventh` | $1, \flat3, \flat5, \doubleflat7$ | `dim7` (ex. `Cdim7`) | `Co7` |
| `augmented-seventh` | $1, 3, \sharp5, \flat7$ | `7#5` (ex. `C7#5`) | `C7#5` |
| `half-diminished` | $1, \flat3, \flat5, \flat7$ | `m7b5` (ex. `Cm7b5`) | `Ch7` |
| `major-minor` | $1, \flat3, 5, 7$ | `m(maj7)` (ex. `Cm(maj7)`) | `C-^7` |
| `major-sixth` | $1, 3, 5, 6$ | `6` (ex. `C6`) | `C6` |
| `minor-sixth` | $1, \flat3, 5, 6$ | `m6` (ex. `Cm6`) | `C-6` |
| `dominant-ninth` | $1, 3, 5, \flat7, 9$ | `9` (ex. `C9`) | `C9` |
| `major-ninth` | $1, 3, 5, 7, 9$ | `maj9` (ex. `Cmaj9`) | `C^9` |
| `minor-ninth` | $1, \flat3, 5, \flat7, 9$ | `m9` (ex. `Cm9`) | `C-9` |
| `dominant-11th` | $1, 3, 5, \flat7, 9, 11$ | `11` (ex. `C11`) | `C11` |
| `major-11th` | $1, 3, 5, 7, 9, 11$ | `maj11` | `C^9#11` |
| `minor-11th` | $1, \flat3, 5, \flat7, 9, 11$ | `m11` (ex. `Cm11`) | `C-11` |
| `dominant-13th` | $1, 3, 5, \flat7, 9, 11, 13$ | `13` (ex. `C13`) | `C13` |
| `major-13th` | $1, 3, 5, 7, 9, 11, 13$ | `maj13` (ex. `Cmaj13`) | `C^13` |
| `minor-13th` | $1, \flat3, 5, \flat7, 9, 11, 13$ | `m13` (ex. `Cm13`) | `C-11` |
| `suspended-second` | $1, 2, 5$ | `sus2` (ex. `Csus2`) | `Csus2` |
| `suspended-fourth` | $1, 4, 5$ | `sus4` (ex. `Csus4`) | `Csus` |
| `power` | $1, 5$ | `5` (ex. `C5`) | `C5` |
| `none` | Silence harmonique | `N.C.` | `n` |
| `other` | Personnalisé | Lire `<kind text="...">` | Variable |

*(Les valeurs classiques `Neapolitan`, `Italian`, `French`, `German`, `pedal`, `Tristan` sont mappées sur leur texte ou accord équivalent).*

#### C. Application des modificateurs `<degree>` (`add`, `alter`, `subtract`)

Chaque élément `<degree>` contient :
- `<degree-value>` : entier positif (`2`, `3`, `4`, `5`, `6`, `7`, `9`, `11`, `13`).
- `<degree-alter>` : `-1` ($\flat$), `0` ($\natural$), `+1` ($\sharp$).
- `<degree-type>` : `add` | `alter` | `subtract`.

Règles de composition :
1. **Cas idiomatiques combinés** :
   - `major-sixth` + `add 9` ($\text{alter}=0$) $\rightarrow$ `6/9` (iReal `69`).
   - `minor-sixth` + `add 9` ($\text{alter}=0$) $\rightarrow$ `m6/9` (iReal `-69`).
   - `dominant` (ou `dominant-ninth` / `dominant-13th`) + `<degree-value>4</degree-value>` (`add`) + `<degree-value>3</degree-value>` (`subtract`) $\rightarrow$ `7sus4` / `9sus4` / `13sus4`.
   - `suspended-fourth` + `add 7` ($\text{alter}=-1$) $\rightarrow$ `7sus4`.
   - `major` + `add 9` ($\text{alter}=0$) $\rightarrow$ `add9`.
2. **Altérations et tensions (`alter` ou `add` avec $\text{alter} \ne 0$)** :
   - Pour $\text{value} \in \{5, 9, 11, 13\}$ et $\text{alter} \in \{-1, +1\}$ : préfixer par `b` ou `#` (ex. `b5`, `#5`, `b9`, `#9`, `#11`, `b13`).
   - Si l'accord de base est `major` (`""`) et qu'on a `alter 5 (-1)`, l'écrire `(b5)` pour éviter toute collision visuelle entre un `B` majeur bémolisé (`Bb5` = $\text{B}\flat$ power chord) et `B(b5)`.
3. **Omissions (`subtract`)** :
   - `subtract 3` (sans `sus4`/`sus2`) $\rightarrow$ `(no3)`.
   - `subtract 5` $\rightarrow$ `(no5)`.

#### D. Basse de renversement (`<bass>`)
- Si `<bass>` est présent : extraire `<bass-step>` + `<bass-alter>` et ajouter `/<Bass>` à la fin du symbole d'accord (ex. `Dm7/G`, `Cmaj7/E`).

#### E. Extraction de la structure de Grille depuis `<measure>`
- **Reprises** :
  - `<barline location="left"><repeat direction="forward"/></barline>` $\rightarrow$ reprise ouvrante (`|:`).
  - `<barline location="right"><repeat direction="backward" times="N"/></barline>` $\rightarrow$ reprise fermante (`:|`).
- **Barres doubles et finales** :
  - `<bar-style>light-light</bar-style>` $\rightarrow$ double barre (`||`).
  - `<bar-style>light-heavy</bar-style>` (sans `<repeat>`) $\rightarrow$ barre finale (`|]`).
- **Voltas (1re / 2e fins)** :
  - `<barline location="left"><ending number="1" type="start"/></barline>` $\rightarrow$ début de volta `1.` (et `type="stop"` ou `type="discontinue"` sur la barre droite).
- **Sections et navigation** :
  - `<direction><direction-type><rehearsal>A</rehearsal></direction-type></direction>` $\rightarrow$ section `[A]`.
  - `<direction><direction-type><segno/></direction-type></direction>` (ou `<sound dalsegno="..."/>`) $\rightarrow$ `@segno`.
  - `<direction><direction-type><coda/></direction-type></direction>` (ou `<sound coda="..."/>` / `tocoda`) $\rightarrow$ `@coda`.
  - `<direction><direction-type><words>D.C. al Coda</words></direction-type></direction>` $\rightarrow$ indication de navigation.

---

## 3. Grammaire texte bidirectionnelle et modèle JSON canonique de Grille

### 3.1 Objectifs de conception

Pour que l'utilisateur puisse créer, lire, copier-coller ou modifier une **Grille** aussi bien dans un fichier texte externe que dans l'éditeur intégré de **Jazz Trane'R**, la grammaire texte doit respecter 4 propriétés :
1. **Lisibilité immédiate par un musicien** : inspirée de la notation universelle des grilles ASCII jazz (`| Dm7 G7 | Cmaj7 |`), sans bruit syntaxique XML ou codes opaques iReal.
2. **Aller-retour sans perte (*lossless round-trip*)** : bijection déterministe `parseGrilleText(formatGrilleText(grille)) === grille` vers le modèle JSON canonique.
3. **Compatibilité complète avec iReal Pro et MusicXML** : supporte les sections, métriques changeantes, reprises, voltas, Segno/Coda, indications de renvoi, répétitions de mesures (`%`, `%%`), divisions de temps (`/`), `N.C.`, slash chords et accords alternatifs `(G7)`.
4. **Indépendance vis-à-vis de la tonalité d'affichage** : le modèle JSON canonique permet de transposer la **Grille** dans les 12 tonalités ou de l'afficher en degrés fonctionnels (`IIm7`, `V7`, `Imaj7`) à la volée.

---

### 3.2 Spécification de la grammaire texte Jazz Trane'R (`.grid` / bloc texte)

#### Exemple complet commenté (*Autumn Leaves* / structure avec reprises, voltas et Coda)

```text
# Métadonnées optionnelles en en-tête (ou portées par l'Item)
Title: Autumn Leaves
Composer: Joseph Kosma
Style: Medium Swing
Key: Gm
Tempo: 140
Time: 4/4

[A]
|: Cm7 | F7 | Bbmaj7 | Ebmaj7 |
| [1. Am7b5 | D7b9 | Gm6 (G7) | % :|
| [2. Am7b5 | D7b9 | Gm6 | % ||

[B]
| Am7b5 | D7b9 | Gm6 | % |
| Cm7 | F7 | Bbmaj7 | Ebmaj7 |
| Am7b5 | D7b9 | Gm7 C7 | Fm7 Bb7 |
| Am7b5 @coda | D7b9 | Gm6 <D.C. al Coda> | % |]

[Coda] @coda
| Am7b5 | D7b9 / /Eb /D | Gm6 @fermata |]
```

#### Règles lexicales et syntaxiques complètes

1. **En-têtes optionnels (`Clé: Valeur`)** :
   - Placés en début de texte avant la première section ou mesure : `Title:`, `Composer:`, `Style:`, `Key:`, `Tempo:`, `Time:` (défaut `4/4`).
   - Les lignes commençant par `#` sont des commentaires ignorés.

2. **En-têtes de sections et changements de métrique** :
   - `[A]`, `[B]`, `[C]`, `[D]`, `[Intro]`, `[Verse]`, `[Bridge]`, `[Interlude]`, `[Outro]`, `[Coda]` : déclare une section (peut être placée sur sa propre ligne au-dessus du système ou en préfixe de la première mesure).
   - Changement de métrique en cours de morceau : `(3/4)`, `(4/4)`, `(5/4)`, `(6/8)`, etc. placé en début de mesure (ou sur la ligne de section `[B] (3/4)`).

3. **Barres de mesure (délimiteurs)** :
   - `|` : barre de mesure simple.
   - `||` : double barre de section (en ouverture en début de ligne ou en fermeture en fin de mesure).
   - `|:` : barre de reprise ouvrante.
   - `:|` : barre de reprise fermante.
   - `:||:` (ou `:| |:`) : reprise fermante immédiatement suivie d'une reprise ouvrante.
   - `|]` : double barre finale.
   - Chaque ligne de mesures commence par une barre ouvrante (`|`, `||`, `|:`) et se termine par une barre fermante (`|`, `||`, `:|`, `|]`). Les sauts de ligne entre lignes de mesures définissent le découpage visuel en systèmes (typiquement 4 mesures par ligne).

4. **Contenu d'une mesure (entre deux barres)** :
   - **Voltas (boîtes de reprise)** : `[1.`, `[2.`, `[3.` (ou `[1,2.`) au début de la mesure. La volta reste active jusqu'à la prochaine barre `:||`, `:|`, `||`, ou au prochain `[N.`.
   - **Répétitions de mesures** :
     - `%` seul dans une mesure : répète intégralement la mesure précédente (équivalent iReal `x`).
     - `%%` dans deux mesures consécutives (`| %% | %% |` ou jeton `%%`) : répète les 2 mesures précédentes (équivalent iReal `r`).
   - **Accords et événements rythmiques (séparés par des espaces)** :
     - **1 événement** dans la mesure (`| Dm7 |`) : occupe toute la mesure.
     - **2 événements** en $4/4$ (`| Dm7 G7 |`) : chaque accord occupe 2 temps (temps 1 et temps 3).
     - **3 ou 4 événements** en $4/4$ : chaque jeton occupe 1 temps. Pour placer par exemple un accord sur le temps 1 et un accord sur le temps 4 (ou 1 et 2), on utilise le **slash de prolongation de temps** `/` :
       - `| Dm7 / / G7 |` $\rightarrow$ `Dm7` sur 3 temps (temps 1, 2, 3), `G7` sur le 4e temps.
       - `| Dm7 G7 / / |` $\rightarrow$ `Dm7` sur le 1er temps, `G7` sur les temps 2, 3, 4.
     - **Sous-divisions d'un temps** (accords serrés / croche) : reliés par un tiret bas `_` au sein d'un même temps, ex. `| Cmaj7 Am7 | Dm7 G7_Ab7 |` (équivalent de la petite police `s` d'iReal Pro).
     - **Silence harmonique** : `N.C.` (ou `NC`).
     - **Changement de basse seule** : `/F` ou `/Eb` (reprend l'accord précédent avec une nouvelle note de basse, équivalent iReal `W/F`).
     - **Accord alternatif** : `(G7)` immédiatement après l'accord principal (ex. `Dm7(G7)` ou `Dm7 (G7)` s'il est rattaché à l'accord précédent) ; pour un accord alternatif sur un temps distinct, l'écrire sur son temps `(G7)`.

5. **Signes et annotations de mesure** :
   - `@segno` (ou `@S`) : signe Segno ($\mathcal{S}$).
   - `@coda` (ou `@Q`) : signe Coda (`𝄌`).
   - `@fermata` : point d'orgue (`𝄐`) sur l'accord précédent.
   - `@end` : arrêt `END` (équivalent iReal `U`).
   - `<texte>` : annotation textuelle ou instruction de navigation (`<D.C. al Coda>`, `<D.S. al Fine>`, `<Fine>`, `<3x>`).

---

### 3.3 Modèle JSON canonique de Grille

Ce schéma JSON représente de manière unifiée toute **Grille** importée depuis `irealb://`, extraite depuis `.musicxml` ou saisie via la grammaire texte :

```json
{
  "version": 1,
  "tonalite": "Gm",
  "timeSignature": { "beats": 4, "beatType": 4 },
  "measures": [
    {
      "index": 1,
      "section": "A",
      "timeSignature": null,
      "barlineLeft": "repeat-start",
      "barlineRight": "single",
      "ending": null,
      "repeatMeasure": null,
      "signs": [],
      "annotations": [],
      "lineBreakAfter": false,
      "events": [
        {
          "beat": 1,
          "durationBeats": 4,
          "chord": {
            "root": "C",
            "quality": "m7",
            "alterations": [],
            "bass": null,
            "alternate": null
          },
          "isRest": false
        }
      ]
    }
  ]
}
```

#### Propriétés clés du modèle JSON canonique :
- **`measures[].barlineLeft`** : `"single"` | `"double"` | `"repeat-start"`.
- **`measures[].barlineRight`** : `"single"` | `"double"` | `"repeat-end"` | `"final"`.
- **`measures[].ending`** : `null` | `1` | `2` | `3` | `0`.
- **`measures[].repeatMeasure`** : `null` | `"single"` (`%`) | `"double-start"` | `"double-end"` (`%%`).
- **`measures[].signs`** : tableau de `"segno"` | `"coda"` | `"fine"` | `"end"`.
- **`measures[].annotations`** : tableau de chaînes (ex. `["D.C. al Coda"]`).
- **`measures[].lineBreakAfter`** : `true` en fin de ligne/système (généralement toutes les 4 mesures), permettant de conserver la mise en page exacte lors de l'aller-retour texte $\leftrightarrow$ JSON.
- **`events[].chord`** : structure décomposée (`root`, `quality`, `alterations`, `bass`, `alternate`) permettant :
  1. La **transposition instantanée** dans les 12 tonalités (en transposant `root`, `bass` et `alternate.root` / `alternate.bass` selon le cycle des quintes de la tonalité cible).
  2. La **conversion à la volée en degrés fonctionnels** (ex. en `Gm`, `Cm7` $\rightarrow$ `IVm7`, `Am7b5` $\rightarrow$ `IIm7b5`, `D7b9` $\rightarrow$ `V7b9`) par simple calcul d'intervalle entre `chord.root` et `grille.tonalite`.

---

### 3.4 Table de correspondance synthétique des 3 formats

| Concept musical | Jeton iReal Pro (`irealb://`) | Élément MusicXML (`.musicxml`) | Grammaire texte Jazz Trane'R |
| :--- | :--- | :--- | :--- |
| **Barre simple / double / finale** | `\|` / `[` `]` / `Z` | Implicite / `light-light` / `light-heavy` | `\|` / `\|\|` / `\|]` |
| **Reprise ouvrante / fermante** | `{` / `}` | `<repeat direction="forward\|backward"/>` | `\|:` / `:\|` |
| **Métrique** | `T44`, `T34`, `T68`, `T12` | `<time><beats>4</beats><beat-type>4</beat-type></time>` | `Time: 4/4` ou `(3/4)` |
| **Section** | `*A`, `*B`, `*i`, `*v` | `<rehearsal>A</rehearsal>` | `[A]`, `[B]`, `[Intro]`, `[Verse]` |
| **Volta (1re / 2e fin)** | `N1`, `N2`, `N3` | `<ending number="1" type="start"/>` | `[1.`, `[2.`, `[3.` |
| **Segno / Coda / Fermata / End** | `S` / `Q` / `f` / `U` | `<segno/>` / `<coda/>` / `<fermata/>` | `@segno` / `@coda` / `@fermata` / `@end` |
| **Texte / Renvoi (*D.C.*, *D.S.*)** | `<D.C. al Coda>` | `<words>D.C. al Coda</words>` | `<D.C. al Coda>` |
| **Répétition 1 mesure / 2 mesures** | `x` / `r` | `<measure-repeat type="start">1\|2</measure-repeat>` | `%` / `%%` |
| **Prolongation d'un temps** | `p` (ou espace `' '`) | Durée implicite entre deux `<harmony>` | `/` |
| **Silence harmonique** | `n` | `<kind text="N.C.">none</kind>` | `N.C.` |
| **Majeur 7 / Mineur 7 / Dom. 7** | `C^7` / `C-7` / `C7` | `major-seventh` / `minor-seventh` / `dominant` | `Cmaj7` / `Cm7` / `C7` |
| **Demi-diminué / Diminué 7** | `Ch7` / `Co7` | `half-diminished` / `diminished-seventh` | `Cm7b5` / `Cdim7` |
| **Slash chord / Basse seule** | `D-7/G` / `W/G` | `<bass><bass-step>G</bass-step></bass>` | `Dm7/G` / `/G` |
| **Accord alternatif** | `(G7)` | `<harmony type="alternate">` ou 2e portée | `(G7)` |
