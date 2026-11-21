import fs from "node:fs";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { Candidature } from "@/types/candidature";
import { nettoyer } from "@/lib/utils";

// Base SQLite : dans DATA_DIR (fourni par le hub, conservé lors des mises à jour), sinon ./data en développement
const dossier = process.env.DATA_DIR || path.join(process.cwd(), "data");
fs.mkdirSync(dossier, { recursive: true });

// Fichier de la base : base.db. Les versions précédentes utilisaient jalon.db : on le renomme pour garder les données.
const fichier = path.join(dossier, "base.db");
const ancien = path.join(dossier, "jalon.db");
if (!fs.existsSync(fichier) && fs.existsSync(ancien)) {
  for (const suffixe of ["", "-wal", "-shm", "-journal"]) {
    if (fs.existsSync(ancien + suffixe)) fs.renameSync(ancien + suffixe, fichier + suffixe);
  }
}
const url = `file:${fichier.replace(/\\/g, "/")}`;

const globale = globalThis as unknown as { prisma?: PrismaClient; prismaPret?: Promise<void> };

const prisma = globale.prisma ?? new PrismaClient({ adapter: new PrismaLibSql({ url }) });
if (process.env.NODE_ENV !== "production") globale.prisma = prisma;

const COLONNES_AJOUTEES = [
  "adresse",
  "dateRefus",
  "motifRefus",
  "statutEntreprise",
  "nbSalaries",
  "activiteEntreprise",
  "nomRecruteur",
  "emailRecruteur",
  "telRecruteur",
];

// Le dossier compilé n’embarque pas la CLI Prisma : les tables sont créées au premier appel
// (même structure que prisma/schema.prisma).
async function initialiser() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Candidature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titre" TEXT NOT NULL,
    "spontanee" BOOLEAN NOT NULL DEFAULT false,
    "dateCandidature" TEXT NOT NULL DEFAULT '',
    "anciennesDates" TEXT NOT NULL DEFAULT '[]',
    "entreprise" TEXT NOT NULL DEFAULT '',
    "typeContrat" TEXT NOT NULL DEFAULT 'CDI',
    "localisation" TEXT NOT NULL DEFAULT '',
    "sourceLien" TEXT NOT NULL DEFAULT '',
    "etape" TEXT NOT NULL DEFAULT 'Je dois postuler',
    "resultat" TEXT NOT NULL DEFAULT 'En attente',
    "dateEntretien" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "dateRefus" TEXT NOT NULL DEFAULT '',
    "motifRefus" TEXT NOT NULL DEFAULT '',
    "statutEntreprise" TEXT NOT NULL DEFAULT '',
    "nbSalaries" TEXT NOT NULL DEFAULT '',
    "activiteEntreprise" TEXT NOT NULL DEFAULT '',
    "nomRecruteur" TEXT NOT NULL DEFAULT '',
    "emailRecruteur" TEXT NOT NULL DEFAULT '',
    "telRecruteur" TEXT NOT NULL DEFAULT '',
    "creeLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" DATETIME NOT NULL
  )`);
  // Base créée par une version précédente : ajout des colonnes manquantes
  const existantes = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Candidature")`);
  const noms = new Set(existantes.map((c) => c.name));
  for (const colonne of COLONNES_AJOUTEES) {
    if (!noms.has(colonne)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Candidature" ADD COLUMN "${colonne}" TEXT NOT NULL DEFAULT ''`);
    }
  }
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Reglage" (
    "cle" TEXT NOT NULL PRIMARY KEY,
    "valeur" TEXT NOT NULL
  )`);
}

export async function bd() {
  globale.prismaPret ??= initialiser();
  await globale.prismaPret;
  return prisma;
}

export const versLigne = (c: Candidature) => ({
  id: c.id,
  titre: c.titre,
  spontanee: c.spontanee,
  dateCandidature: c.dateCandidature,
  anciennesDates: JSON.stringify(c.anciennesDates),
  entreprise: c.entreprise,
  typeContrat: c.typeContrat,
  localisation: c.localisation,
  sourceLien: c.sourceLien,
  etape: c.etape,
  resultat: c.resultat,
  dateEntretien: c.dateEntretien,
  adresse: c.adresse,
  dateRefus: c.dateRefus,
  motifRefus: c.motifRefus,
  statutEntreprise: c.statutEntreprise,
  nbSalaries: c.nbSalaries,
  activiteEntreprise: c.activiteEntreprise,
  nomRecruteur: c.nomRecruteur,
  emailRecruteur: c.emailRecruteur,
  telRecruteur: c.telRecruteur,
});

export const depuisLigne = (r: { anciennesDates: string; [champ: string]: unknown }): Candidature | null => {
  let anciennes: unknown = [];
  try {
    anciennes = JSON.parse(r.anciennesDates);
  } catch {}
  return nettoyer({ ...r, anciennesDates: anciennes });
};
