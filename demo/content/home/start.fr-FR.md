## Démarrer un projet proprement

```bash
ajs project init mon-projet --template "DMS Demo" --yes
cd mon-projet
pnpm dev            # backend sur :5010
pnpm frontend:dev   # tableau de bord sur :3001
```

1. **Partez du modèle** plutôt que d'une page blanche : la structure, les scripts et la configuration sont déjà justes.
2. **Créez l'administrateur** au premier lancement, puis votre espace de travail.
3. **Déclarez votre métier** : une collection, un contrôleur de données, une page faite de blocs. Le DMS génère les routes, les droits et les écrans.
4. **Ajoutez des modules** depuis *Modules › Accéder au store*, ou en ligne de commande avec `ajs project modules add`. Ils sont écrits dans `antelope.config.ts`, où leur configuration reste modifiable.
5. **Gardez les blocs** : un composant sur mesure seulement pour ce qu'aucun bloc ne couvre. C'est ce qui garde l'écran éditable, traduisible et cohérent.
