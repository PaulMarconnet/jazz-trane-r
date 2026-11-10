# Contrat de données amont pour la Partition Dynamique et la banque d'accords Ear Training

Type: grilling
Status: open
Blocked by: 02, 04

## Question

Afin que l'architecture livrée en **Spec 2** n'exige aucune refonte de base de données lors des **Spec 3** (**Partition Dynamique** & **Drills**) et **Spec 4** (**Ear Training Jazz**), verrouiller dès maintenant :

1. **Modèle JSON de `Partition Dynamique` sur un `Item`** : Quelle structure de données interne unifie un trait/voicing importé depuis un fichier `.musicxml` (MuseScore) et un accord/motif saisi directement au clavier piano virtuel dans l'application (notes, durées, doigtés/voix, accord de référence pour la transposition dans les 12 tons et le défilement du curseur au tempo) ?
2. **Modèle de Voicing & Règles de Génération pour l'`Ear Training` et les `Drills`** : Comment représenter un accord/voicing (intervalles, tensions, répartition main gauche / main droite, limites strictes de tessiture grave/aiguë et renversements autorisés) pour que la même banque de voicings (pré-intégrée ou enrichie par l'utilisateur) serve à la fois aux **Drills** de la **Spec 3** et aux exercices d'**Ear Training** (reconnaissance de natures d'accords, dictées d'accords, cadences et degrés sur drone façon *Sonofield*) de la **Spec 4** ?
