import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// API Géo (données publiques de l’État) : gratuite, sans clé ni inscription.
// GEO_API_URL permet de changer l’adresse (tests, miroir interne).
const BASE = process.env.GEO_API_URL || "https://geo.api.gouv.fr";

type Suggestion = { label: string; detail: string };
type Commune = { nom?: string; codesPostaux?: string[]; departement?: { code?: string; nom?: string } };

// Petit cache en mémoire : une même frappe n’interroge l’API qu’une fois par jour
const cache = new Map<string, { t: number; v: Suggestion[] }>();
const DUREE = 24 * 3600 * 1000;

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Formules propres à la recherche d’emploi, proposées en plus des villes
const SPECIALES: Suggestion[] = [
  { label: "Télétravail", detail: "à distance" },
  { label: "Hybride", detail: "bureau et télétravail" },
];

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json([]);

  const cle = sansAccents(q);
  const enCache = cache.get(cle);
  if (enCache && Date.now() - enCache.t < DUREE) return NextResponse.json(enCache.v);

  const speciales = SPECIALES.filter((s) => sansAccents(s.label).startsWith(cle));
  const codePostal = /^\d{5}$/.test(q);
  if (/^\d+$/.test(q) && !codePostal) return NextResponse.json([]);

  const params = new URLSearchParams({ fields: "nom,codesPostaux,departement", limit: "8" });
  if (codePostal) params.set("codePostal", q);
  else {
    params.set("nom", q);
    params.set("boost", "population"); // les grandes villes d’abord
  }

  try {
    const r = await fetch(`${BASE}/communes?${params}`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return NextResponse.json(speciales);
    const communes = (await r.json()) as Commune[];

    const vus = new Set<string>();
    const villes: Suggestion[] = [];
    for (const c of Array.isArray(communes) ? communes : []) {
      if (!c.nom) continue;
      const dep = c.departement?.code;
      const label = dep ? `${c.nom} (${dep})` : c.nom;
      if (vus.has(label)) continue;
      vus.add(label);
      villes.push({ label, detail: [c.codesPostaux?.[0], c.departement?.nom].filter(Boolean).join(" · ") });
    }

    const resultat = [...speciales, ...villes];
    if (cache.size >= 500) cache.delete(cache.keys().next().value as string);
    cache.set(cle, { t: Date.now(), v: resultat });
    return NextResponse.json(resultat);
  } catch {
    // Hors ligne ou API indisponible : pas de suggestions, la saisie libre reste possible
    return NextResponse.json(speciales);
  }
}
