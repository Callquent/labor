import { spawnSync } from "node:child_process";

// Ce projet doit être compilé avec webpack : avec Turbopack (compilateur par défaut de Next.js 16), le client
// Prisma est chargé sous un nom à suffixe aléatoire via des liens symboliques (@prisma/client-xxxxxxxx), qui
// disparaissent dès que le dossier compilé est copié ou compressé (« Failed to load external module … »).
// Si `next build` est lancé sans l’option --webpack, on le relance automatiquement avec.
// (Les scripts `npm run dev` et `npm run build` passent déjà --webpack.)
const commande = process.argv[2];
if (process.env.TURBOPACK && commande === "build" && !process.env.JALON_WEBPACK) {
  console.log("Jalon : Turbopack détecté, relance avec webpack (--webpack)…");
  const { TURBOPACK, ...env } = process.env;
  const r = spawnSync(process.execPath, [process.argv[1], ...process.argv.slice(2), "--webpack"], {
    stdio: "inherit",
    env: { ...env, JALON_WEBPACK: "1" },
  });
  process.exit(r.status ?? 1);
}

const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compilation pour « Mes applications » : BASE_PATH=/apps/<id> et STANDALONE=1
  basePath,
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  // Préfixe des appels à l’API depuis le navigateur
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Modules natifs de la base SQLite : non regroupés, copiés tels quels dans le dossier compilé
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
};

export default nextConfig;
