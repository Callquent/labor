import { NextResponse } from "next/server";
import { bd } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAUT = { delai: 7, vue: "colonnes" as "colonnes" | "liste" };

export async function GET() {
  const prisma = await bd();
  const lignes = await prisma.reglage.findMany();
  const m = new Map(lignes.map((l) => [l.cle, l.valeur]));
  const delai = parseInt(m.get("delai") ?? "", 10);
  const vue = m.get("vue");
  return NextResponse.json({
    delai: delai >= 1 && delai <= 365 ? delai : DEFAUT.delai,
    vue: vue === "liste" || vue === "colonnes" ? vue : DEFAUT.vue,
    depart: m.get("depart") ?? "", // adresse de départ des itinéraires
  });
}

export async function PUT(req: Request) {
  let corps: { delai?: unknown; vue?: unknown; depart?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ erreur: "JSON invalide" }, { status: 400 });
  }
  const prisma = await bd();
  const ecritures: { cle: string; valeur: string }[] = [];
  if (typeof corps.delai === "number" && Number.isInteger(corps.delai) && corps.delai >= 1 && corps.delai <= 365) {
    ecritures.push({ cle: "delai", valeur: String(corps.delai) });
  }
  if (corps.vue === "colonnes" || corps.vue === "liste") ecritures.push({ cle: "vue", valeur: corps.vue });
  if (typeof corps.depart === "string") ecritures.push({ cle: "depart", valeur: corps.depart.trim().slice(0, 200) });
  await prisma.$transaction(
    ecritures.map((e) => prisma.reglage.upsert({ where: { cle: e.cle }, create: e, update: { valeur: e.valeur } }))
  );
  return NextResponse.json({ ok: true });
}
