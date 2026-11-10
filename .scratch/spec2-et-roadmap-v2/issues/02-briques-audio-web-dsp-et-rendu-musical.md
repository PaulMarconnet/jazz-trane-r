# Briques WebAudio DSP et rendu musical sous Vite et Capacitor

Type: research
Status: resolved

## Question

La **Spec 2** et la **Spec 3** requièrent des capacités audio et de gravure musicale 100 % hors-ligne exécutables dans une WebView Android Capacitor et un navigateur desktop après migration vers Vite :

1. **Time-Stretch & Pitch-Shift indépendants hors-ligne** : Quelles solutions WebAudio / WebAssembly open-source (ex. `soundtouchjs` / AudioWorklet SoundTouch, `signalsmith-stretch`, `rubberband-wasm`, `tone`) permettent de ralentir un fichier audio local (MP3/WAV/M4A) de 50 % à 150 % ET de le transposer de $\pm 12$ demi-tons en temps réel avec bouclage A-B et insertion automatique de silence (*Call & Response*) sans décodage complet bloquant la RAM sur Android ?
2. **Métronome Jazz Sample-Accurate & Synthèse de Drone Harmonique (façon *Sonofield*)** : Quelle architecture WebAudio (*lookahead scheduler* + oscillateurs/échantillons filtrés + `AudioWorklet`) garantit un métronome sans jitter (2&4, *et* du 4, *Gap Click* N mesures jouées / M mesures muettes, *Tempo Ladder*) et un bourdon harmonique riche, chaleureux et continu inspiré de *Sonofield* ?
3. **Gravure de Partition Dynamique & Synthèse d'Accords/Voicings** : Quel est le comparatif factuel (poids du bundle, licence, support du curseur temps réel synchronisé au tempo, API de construction programmatique pour la saisie au clavier virtuel vs import `.musicxml`) entre `VexFlow`, `OpenSheetMusicDisplay` (OSMD), `Verovio` et `AlphaTab`, ainsi que les options légères de lecture SoundFont/échantillons piano hors-ligne ?

## Answer

Le rapport complet, les tableaux comparatifs (licences, poids de bundles, algorithmes DSP, architectures WebAudio) et les sources primaires sont consignés dans [`docs/research/webaudio-dsp-and-music-engraving.md`](../../../docs/research/webaudio-dsp-and-music-engraving.md).

### Synthèse des choix techniques retenus

1. **Time-Stretch & Pitch-Shift indépendants + *Call & Response* (Spec 2)** :
   - **Choix retenu : `signalsmith-stretch` (MIT, ~45 Ko WASM/AudioWorklet)** en architecture hybride :
     - *Mode Flux ($O(1)$ en RAM sur Android)* : `HTMLAudioElement` (`preservesPitch = true`, `playbackRate` de `0.5` à `1.5`) connecté via `MediaElementAudioSourceNode` au worklet `SignalsmithStretch` en **Mode Effet** pour la transposition ($\pm 12$ demi-tons + accordage fin en cents). Permet une lecture instantanée sans décoder tout le fichier en mémoire.
     - *Mode Générateur (`addBuffers`)* : utilisé pour les extraits courts ou les boucles A–B exigeant un rebouclage au sample près.
     - *Boucle Call & Response (Auto-Gap Loop)* : machine à états pilotée par l'horloge WebAudio qui applique un fondu de sortie de `15 ms` en fin de boucle $B$, coupe la piste pendant $k \times \frac{t_B - t_A}{\text{rate}}$ (tout en laissant battre le métronome *Inner Clock* en option), puis relance la lecture à $t_A$.
   - *Écartés* : `rubberband-wasm` (licence GPL-2.0 incompatible avec l'App Store sans licence commerciale), `Tone.PitchShift` (artéfacts métalliques sur polyphonie), `@soundtouchjs/audio-worklet` (MPL-2.0, algorithme temporel WSOLA moins propre que le vocodeur spectral de Signalsmith au-delà de $\pm 4$ demi-tons, conservé uniquement en repli).

2. **Métronome *Inner Clock* Sample-Accurate & Synthèse de Drone Harmonique *Sonofield* (Spec 2 & Spec 4)** :
   - **Métronome *Inner Clock*** : Architecture *Lookahead Scheduler* de Chris Wilson avec timer dans un **Web Worker dédié (`25 ms`)** programmant les événements WebAudio dans une fenêtre de `100 ms` sur `audioContext.currentTime` + file FIFO `requestAnimationFrame` pour la synchronisation visuelle sans dérive. Supporte nativement *2 & 4*, *« et » du 4* (levée de résolution de Hal Galper), *Gap Click* ($N$ mesures jouées / $M$ mesures muettes) et *Tempo Ladder*, avec synthèse percussive boisée procédurale (0 Ko d'asset externe).
   - **Drone Harmonique *Sonofield*** : Synthétiseur soustractif procédural WebAudio combinant 5 oscillateurs par voix (sub-sinus $\frac{1}{2}f_0$, deux dents de scie détunées à $\pm 6\text{ cents}$, triangle à l'octave $2f_0$, et quinte commutable pure $3:2$ ou tempérée $2^{7/12}$), un filtre passe-bas (`650 Hz`) modulé par un LFO lent (`0.08 Hz`), un filtre en cloche creusant `-4 dB` à `1.5 kHz` pour laisser respirer l'instrument du musicien, et un fondu enchaîné de `1.5 s` lors des modulations sur le cycle des quartes.

3. **Gravure de Partition Dynamique & Synthèse Piano/Voicings hors-ligne (Spec 3 & Spec 4)** :
   - **Gravure de Partition Dynamique** : **`vexflow` (v4/v5, MIT, ~150 Ko + police jazz `Petaluma` ~220 Ko `.woff2`)** piloté par un **modèle JSON interne (`DynamicScoreModel`)** accompagné d'un convertisseur léger `MusicXML (.musicxml / .mxl via DOMParser + fflate) -> JSON`. Ce choix garantit une réactivité $< 5\text{ ms}$ lors de la saisie au clavier piano virtuel, de la transposition dans les 12 tonalités ($C, B\flat, E\flat$), du suivi par curseur synchronisé au tempo et du masquage dynamique de notes (*Subtraction Drill* de Bergonzi). `OpenSheetMusicDisplay` (MIT) peut être chargé en *lazy-chunk* optionnel uniquement pour les partitions `.musicxml` multi-pages complexes non destinées à l'édition cellulaire. `Verovio` (~4 Mo WASM, LGPL-3.0) et `alphaTab` (LGPL-3.0, orienté tablature guitare) sont écartés.
   - **Synthèse Piano / Voicings 100 % hors-ligne** : **Sampler WebAudio multi-échantillonné par tierces mineures** (24 fichiers Opus/OGG embarqués dans `public/audio/piano/` issus de *Splendid Grand Piano* en Public Domain ou *Salamander Grand Piano* en CC-BY 3.0, pour un poids total de **~850 Ko**). Chaque note MIDI est transposée d'au plus $\pm 1$ demi-ton (`detune` $\le \pm 100\text{ cents}$, zéro déformation de formant) et routée dans un filtre passe-bas dynamique asservi à la vélocité.
