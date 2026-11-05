## Les modules, et ce qu'ils changent dans un vrai projet

Un module s'installe en une commande (ou depuis le store) et apporte ses écrans, ses données et ses automatisations — sans toucher au code du projet.

| Module | À quoi il sert | Dans un cas concret |
| --- | --- | --- |
| **SaaS** | Inscription en libre-service, offres, abonnements Stripe, espace client, back-office de l'éditeur | Vendre votre outil métier en abonnement à plusieurs entreprises |
| **Automatisation** | Procédures visuelles : déclencheurs, actions, conditions | « Un ticket urgent arrive → le technicien de garde est assigné et prévenu » |
| **Mailing** | Modèles d'e-mails éditables par blocs, envois, statistiques | Devis envoyé, facture émise, relance — sans développeur pour changer un texte |
| **Marketing** | Mesure d'audience sans cookie, heatmaps, funnels, tests A/B | Voir où vos utilisateurs cliquent et où ils abandonnent |
| **Médiathèque** | Fichiers en dossiers, droits par dossier, variantes d'images | Photos de chantier, fiches techniques, documents partagés avec les clients |
| **Traductions** | Langues et traductions du tableau de bord et des contenus | Une plateforme en français, néerlandais et anglais |
| **Base de données** | Explorateur, schémas, requêtes, corrections ligne par ligne | Diagnostiquer une donnée sans ouvrir un client Mongo |
| **API** | Catalogue des routes, journaux, santé, essais en direct | Suivre les intégrations d'un client et leurs erreurs |
| **Assistant** | Un agent IA qui connaît votre projet et ses modules | Ajouter une page ou corriger un formulaire en le demandant |
| **Builder** | Modifier pages, tableaux et formulaires depuis l'interface | Ajuster un écran sans redéployer |

### Le module SaaS, activé sur cette démo

Helio n'est pas seulement un back-office : avec le module **SaaS**, il devient un **produit qu'on peut vendre**.

- **Pages publiques** — `/pricing` et `/register` : un visiteur compare les offres, crée son compte et son premier espace de travail, avec ou sans carte selon l'offre.
- **Offres qui pilotent les droits** — une offre liste les permissions d'un espace : passer de Starter à Business ouvre de nouveaux écrans, automatiquement.
- **Facturation Stripe** — abonnements, factures, avoirs, essais, sièges ; les erreurs de paiement sont expliquées au client.
- **Espace client** — dans *Paramètres › Espace de travail* : membres, sièges, changement d'offre, paiement, export des données.
- **Back-office de l'éditeur** — dans *Modules › SaaS* : revenu récurrent, espaces par statut, migrations d'offres, règles de facturation.

> [!TIP]
> Sur cette démo, Stripe n'est pas branché (clés fictives) : l'inscription à l'offre gratuite fonctionne sans carte, et les offres payantes expliquent clairement qu'un paiement nécessite Stripe. Avec de vraies clés, le parcours complet s'active sans changer de code.
