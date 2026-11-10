# Prototype UI et Logique du Métronome Inner Clock, du Drone harmonique et du Studio Call & Response

Type: prototype
Status: open
Blocked by: 02

## Question

En s'appuyant sur [Briques WebAudio DSP et rendu musical sous Vite et Capacitor](02-briques-audio-web-dsp-et-rendu-musical.md), construire un prototype fonctionnel (via `/prototype`) pour valider le comportement sonore et l'ergonomie des 3 outils audio de la **Spec 2** :

1. **Métronome Jazz *Inner Clock*** : Comment présenter et piloter sans encombrer l'écran les modes *2 & 4*, *Et du 4*, *Gap Click* (ex. 3 mesures jouées / 1 mesure de silence avec indicateur visuel de mesure) et *Tempo Ladder* (progression par paliers de BPM) ?
2. **Drone Harmonique continu (inspiré de *Sonofield*)** : Quelle texture sonore WebAudio (fondamentale + quinte + octaves douces filtrées) et quelle interface compacte permettent de lancer un drone sur la tonalité courante ou selon un cycle programmé ?
3. **Studio Audio *Call & Response* & Transposition** : Comment fonctionne la machine d'états d'une boucle A-B qui insère automatiquement une plage de silence équivalente (*Auto-Gap*) pour laisser le musicien répéter la phrase à l'instrument, combinée aux contrôles de ralentissement (*Time-Stretch*) et de transposition (*Pitch-Shift*) ?
