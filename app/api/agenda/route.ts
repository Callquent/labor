import { NextResponse } from "next/server";
import { bd } from "@/lib/db";
import { agendaEvents, maintenant, parseRange } from "@/lib/agenda-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Flux de dates pour l'application « Agenda » : GET /api/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD
// Seules les dates d'entretien sont fournies (rien d'autre sur les candidatures).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range) return NextResponse.json({ erreur: "Paramètres from et to (YYYY-MM-DD, 400 jours maximum) requis." }, { status: 400 });

  const prisma = await bd();
  const lignes = await prisma.candidature.findMany({
    where: { dateEntretien: { not: "" } },
    select: { id: true, titre: true, entreprise: true, localisation: true, adresse: true, dateEntretien: true },
  });
  return NextResponse.json({ events: agendaEvents(lignes, range.from, range.to, maintenant()) });
}
