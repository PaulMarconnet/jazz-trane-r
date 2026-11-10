# Décodage complet du format irealb://, extraction d'accords MusicXML et grammaire texte de Grille

Type: research
Status: resolved

## Question

Aujourd'hui, [`www/modules/library-domain.js`](../../../www/modules/library-domain.js) extrait uniquement les métadonnées (`titre`, `compositeur`, `style`, `tonalite`) d'un lien `irealb://` et stocke la chaîne brute sans décoder les mesures ni les accords.

1. Quel est l'algorithme exact de désobfuscation de la chaîne de progression iReal Pro (`1r34LbKcu7` + table de permutation symétrique par blocs de 50 caractères) et quelle est la grammaire complète des jetons de **Grille** iReal Pro (barres de mesure `|`, `[`, `]`, `{`, `}`, `Z`, métriques `T44`/`T34`/`T54`, étiquettes de sections `*A`/`*B`/`*C`/`*i`/`*v`, fins `N1`/`N2`, signes `Q` Coda / `S` Segno, répétitions `x`/`r`, silences `n`, slash chords, accords alternatifs entre parenthèses, espacements `s`/`l`/`p`) ?
2. Comment extraire proprement une **Grille** mesurée à partir des balises `<measure>`, `<attributes>` et `<harmony>` (`<root>`, `<kind>`, `<bass>`, `<degree>`) d'un fichier `.musicxml` exporté depuis MuseScore ?
3. Quelle grammaire texte lisible par l'humain (permettant d'éditer une **Grille** aussi bien hors de l'application dans un éditeur de texte que dans l'éditeur intégré de **Jazz Trane'R**) permet une conversion bidirectionnelle sans perte vers un modèle JSON canonique de **Grille** ?

## Answer

Rapport complet documenté dans [docs/research/ireal-musicxml-and-chord-chart-formats.md](../../../docs/research/ireal-musicxml-and-chord-chart-formats.md) :

1. **Décodage `irealb://` (`unobfuscateIReal`) et grammaire iReal Pro** :
   - Après retrait du préfixe `1r34LbKcu7`, la chaîne est découpée par blocs de 50 caractères. **Condition de bord critique** : un bloc de 50 caractères ne subit l'involution symétrique `permuteBlock50` ($\text{swap}(i, 49-i)$ pour $i \in [0..4]$ et $i \in [10..23]$, laissant $[5..9]$, $[24..25]$ et $[40..44]$ intacts) **que s'il reste au moins 2 caractères après ce bloc** (`remaining.length > 51`).
   - Après permutation des blocs, les séquences substituées sont restaurées : `Kcl` $\rightarrow$ `| x`, `LZ` $\rightarrow$ `' |'`, `XyQ` $\rightarrow$ `'   '` (3 espaces).
   - Le flux résultant décrit une grille de 16 cellules par ligne où chaque accord, espace `' '`, silence `n`, slash de temps `p` ou répétition de mesure (`x`, `r`) consomme 1 cellule, tandis que les barres (`|`, `[`, `]`, `{`, `}`, `Z`), métriques (`T44`, `T34`, `T12`...), sections (`*A`..`*D`, `*i`, `*v`), voltas (`N1`..`N3`, `N0`), signes (`S`, `Q`, `f`, `U`), modificateurs de taille (`s`, `l`), espacements verticaux (`Y`..`YYY`) et annotations `<...>` s'attachent sans consommer de cellule.
2. **Extraction `<harmony>` depuis MusicXML (`.musicxml`)** :
   - `<harmony>` n'avance pas le curseur temporel de `<measure>` : il faut suivre `cursorDivisions` via `<note><duration>` (en ignorant `<grace/>` et `<chord/>`), `<forward>` et `<backup>`, puis calculer le temps exact $\text{beat} = 1 + \max(0, \text{cursorDivisions} + \text{offset}) / (\text{divisions} \times 4 / \text{beatType})$.
   - Le chiffrage est reconstruit de manière déterministe à partir de `<root>` (`step` + `alter`), des 33 valeurs normalisées de `<kind>` (avec repli sur `<kind text="...">` pour `other`), des modificateurs `<degree>` (`add`, `alter`, `subtract`) et de `<bass>`, complétés par `<barline>` (`<repeat>`, `<ending>`, `<bar-style>`) et `<direction>` (`<rehearsal>`, `<segno/>`, `<coda/>`, `<words>`).
3. **Grammaire texte bidirectionnelle et modèle JSON canonique de Grille** :
   - Une grammaire texte ASCII lisible et sans perte (`[A]`, `|: Cm7 | F7 | [1. Bbmaj7 | % :|`, `/` pour prolonger d'un temps, `_` pour sous-diviser un temps, `N.C.`, `(G7)`, `@segno`, `@coda`, `@fermata`, `<D.C. al Coda>`) se convertit de façon bijective vers un AST JSON canonique (`measures[]` $\rightarrow$ `events[]` avec `chord: { root, quality, alterations, bass, alternate }`) supportant nativement la transposition dans les 12 tonalités et l'affichage en degrés fonctionnels.
