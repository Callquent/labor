import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { bd, depuisLigne, versLigne } from "@/lib/db";
import { nettoyer } from "@/lib/utils";
import { Candidature } from "@/types/candidature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const prisma = await bd();
  const lignes = await prisma.candidature.findMany({ orderBy: { creeLe: "desc" } });
  return NextResponse.json(lignes.map(depuisLigne).filter((c): c is Candidature => c !== null));
}

// Synchronisation : { upserts: Candidature[], suppressions: string[] } appliqué en une seule transaction
export async function POST(req: Request) {
  let corps: { upserts?: unknown; suppressions?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ erreur: "JSON invalide" }, { status: 400 });
  }

  const aEcrire = (Array.isArray(corps.upserts) ? corps.upserts : [])
    .map(nettoyer)
    .filter((c): c is Candidature => c !== null);
  const aSupprimer = (Array.isArray(corps.suppressions) ? corps.suppressions : []).filter(
    (id): id is string => typeof id === "string"
  );

  const prisma = await bd();

  // Une candidature acceptée ou refusée n’est jamais modifiée.
  // Seule exception : la date et le motif d’un refus restent modifiables.
  const cloturees = new Map(
    (
      await prisma.candidature.findMany({
        where: { id: { in: aEcrire.map((c) => c.id) }, NOT: { resultat: "En attente" } },
        select: { id: true, resultat: true },
      })
    ).map((r) => [r.id, r.resultat])
  );

  const operations: Prisma.PrismaPromise<unknown>[] = [prisma.candidature.deleteMany({ where: { id: { in: aSupprimer } } })];
  const ignorees: string[] = [];
  for (const c of aEcrire) {
    const resultatExistant = cloturees.get(c.id);
    if (resultatExistant === undefined) {
      const d = versLigne(c);
      operations.push(prisma.candidature.upsert({ where: { id: c.id }, create: d, update: d }));
    } else if (resultatExistant === "Refusé" && c.resultat === "Refusé") {
      operations.push(
        prisma.candidature.update({ where: { id: c.id }, data: { dateRefus: c.dateRefus, motifRefus: c.motifRefus } })
      );
    } else {
      ignorees.push(c.id);
    }
  }
  await prisma.$transaction(operations);

  return NextResponse.json({ ok: true, ignorees });
}
