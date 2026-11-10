# Schéma canonique de la Grille, du Profil d'Instrument et indexation harmonique des cadences

Type: grilling
Status: claimed
Blocked by: 01

## Question

En s'appuyant sur les conclusions de [Décodage complet du format irealb://, extraction d'accords MusicXML et grammaire texte de Grille](01-decodage-ireal-et-formats-grilles.md) :

1. Quel est le schéma canonique JSON de la **Grille** attachée à un **Item** dans [`www/modules/library-domain.js`](../../../www/modules/library-domain.js) pour supporter à la fois le décodage `irealb://`, l'édition texte rapide (dans et hors de l'application) et l'import d'accords depuis MusicXML ?
2. Comment modéliser le **Profil d'Instrument** de l'utilisateur (instrument en $C$, $B\flat$, $E\flat$, clé de lecture, instrument polyphonique vs monophonique) et ses règles d'enharmonie lors de la transposition d'une **Grille** ?
3. Comment calculer l'affichage en **Degrés fonctionnels** (`II - V - I`, emprunts et modulations locales) et quelles cadences types l'indexeur harmonique doit-il détecter automatiquement dans les **Grilles** de la bibliothèque pour alimenter le pont *Practice in Songs* (relier un voicing ou un lick aux **Morceaux** qui contiennent cette cadence) ?
