# Jalon · Suivi de candidatures

Next.js 16.4.6 (App Router, TypeScript, Bootstrap 5) + Prisma 7 + SQLite (adaptateur libsql).
Ce dossier contient les **sources** (aucun fichier compilé) ; `package-lock.json` fixe les versions.

## Données
Base SQLite `base.db` (l'ancien `jalon.db` est renommé automatiquement) :
- sous le hub : dans `DATA_DIR` (dossier fourni par le hub, conservé lors des mises à jour) ;
- en développement : dans `./data/`.

Les tables (et les colonnes ajoutées par les nouvelles versions) sont créées automatiquement (`lib/db.ts`).
Aucune donnée n'est stockée dans le navigateur (pas de localStorage).

## Développement
```bash
npm install        # installe et exécute « prisma generate » (postinstall)
npm run dev        # http://localhost:3000
```

## Mes applications (hub) — Linux
À faire **sur la machine qui exécute le hub** (la base utilise un module natif, libsql).
L'identifiant (`labor` ci-dessous) doit être le même partout : c'est le nom du dossier dans `apps/`.

```bash
npm install
BASE_PATH=/apps/labor STANDALONE=1 npm run build
node chemin/vers/preparer-application.mjs . labor --nom "Jalon · Suivi de candidatures"
```
Ajouter ensuite `"icon": "/logo.svg"` dans `apps/labor/app.json`, compresser le dossier
`apps/labor` et l'importer (« Chercher de nouvelles applications »).
Si l'application existe déjà dans le hub, la supprimer d'abord pour ne pas garder d'ancien dossier compilé.

## Webpack obligatoire
Les scripts utilisent **webpack** (`--webpack`). Avec Turbopack (compilateur par défaut de Next.js 16), le client
Prisma et l'adaptateur sont chargés sous des noms à suffixe aléatoire (`@prisma/client-xxxxxxxx`) via des liens
symboliques qui disparaissent quand le dossier compilé est copié ou compressé :
« Failed to load external module @prisma/client-… ». Par sécurité, `next.config.mjs` relance `next build` avec
webpack s'il est lancé sans l'option.

## Autocomplétion des villes et des adresses
Le champ « Localisation » propose des communes françaises via l'API Géo (geo.api.gouv.fr), gratuite et sans clé.
Les appels passent par le serveur de l'application (`/api/villes`, avec un cache en mémoire) ; si l'API est
injoignable, la saisie libre reste possible. `GEO_API_URL` permet de changer l'adresse de l'API.
Le champ « Adresse (numéro et rue) » fonctionne de la même façon avec la Base Adresse Nationale
(data.geopf.fr/geocodage, ancienne adresse api-adresse.data.gouv.fr en secours) via `/api/adresses` ; choisir une
adresse renseigne aussi la ville. `ADRESSE_API_URL` (liste séparée par des virgules) change les adresses utilisées.

## Itinéraire vers un entretien
À l'étape « Entretien », la carte affiche des boutons d'itinéraire (voiture, transports, vélo, à pied) et le formulaire
ajoute un bloc « Itinéraire vers l'entretien » (plus Waze). Ce sont de simples liens Google Maps / Waze, sans clé API,
vers l'adresse (ou, à défaut, entreprise + ville) ; pas d'itinéraire en télétravail. Le champ « Départ des
itinéraires » (barre d'outils, enregistré dans la base) sert de point de départ ; vide, Google Maps utilise la position
actuelle de l'appareil.

## Lien avec l'application « Agenda »
`GET /api/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` fournit à l'agenda **uniquement les dates d'entretien**
(`dateEntretien`) : titre « Entretien : entreprise · poste », heure, lieu (adresse, sinon localisation),
« fait » une fois la date/heure passée. Rien d'autre sur les candidatures n'est exposé (`lib/agenda-feed.ts`).
