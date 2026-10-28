# 0001 — Modules Vanilla sans Bundler chargés avant `script.js`

Les modules d'architecture extraits du monolithe `www/script.js` vivent dans `www/modules/` sous forme de fichiers JavaScript autonomes sans étape de transpilation ni bundler (pas de Webpack/Vite/Rollup). Chaque module s'expose à la fois sur `window` (pour l'exécution directe dans la WebView Capacitor Android et le navigateur) et via `module.exports` / ES module (pour l'exécution directe dans `vitest` sous Node).

Cela préserve l'instantanéité du cycle `npx cap sync` / déploiement Android tout en offrant une surface de test unitaire immédiate en mémoire.
