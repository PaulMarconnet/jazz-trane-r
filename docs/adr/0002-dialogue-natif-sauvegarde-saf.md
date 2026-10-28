# 0002 — Dialogue système natif « Enregistrer sous… » pour les sauvegardes

L'export de sauvegardes (`.json` rapide ou `.zip` complet) utilise systématiquement le sélecteur d'emplacement natif du système d'exploitation : `Intent.ACTION_CREATE_DOCUMENT` (Storage Access Framework via `MainActivity.java`) sur Android, et `window.showSaveFilePicker` (avec repli sur `<a download>`) sur PC.

Nous écartons l'écriture silencieuse dans `Directory.Cache` + feuille de partage Android (`@capacitor/share`) ainsi que l'écriture forcée dans un dossier fixe (`Documents`), car la feuille de partage induit l'utilisateur en erreur sur l'emplacement réel du fichier et le Scoped Storage d'Android 11+ restreint l'écrasement de fichiers dans les dossiers publics sans action explicite de l'utilisateur.
