import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Base Adresse Nationale (données publiques de l’État) : gratuite, sans clé ni inscription.
// Géoplateforme en premier, ancienne adresse en secours. ADRESSE_API_URL (liste séparée par des virgules)
// permet de changer les adresses (tests, miroir interne).
const BASES = (process.env.ADRESSE_API_URL || "https://data.geopf.fr/geocodage,https://api-adresse.data.gouv.fr")
  .split(",")
  .map((b) => b.trim().replace(/\/$/, ""))
  .filter(Boolean);

type Suggestion = { label: string; detail: string; rue: string; ville: string };
type Feature = {
  properties?: {
    type?: string;
    name?: string;
    postcode?: string;
    city?: string;
    context?: string;
  };
};

const cache = new Map<string, { t: number; v: Suggestion[] }>();
const DUREE = 3600 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const ville = (url.searchParams.get("ville") ?? "").trim().slice(0, 60); // oriente la recherche vers cette ville
  if (q.length < 3) return NextResponse.json([]);

  const cle = `${q.toLowerCase()}|${ville.toLowerCase()}`;
  const enCache = cache.get(cle);
  if (enCache && Date.now() - enCache.t < DUREE) return NextResponse.json(enCache.v);

  const params = new URLSearchParams({ q: ville ? `${q} ${ville}` : q, limit: "6", autocomplete: "1" });

  for (const base of BASES) {
    try {
      const r = await fetch(`${base}/search/?${params}`, {
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const donnees = (await r.json()) as { features?: Feature[] };

      const vus = new Set<string>();
      const resultat: Suggestion[] = [];
      for (const f of Array.isArray(donnees.features) ? donnees.features : []) {
        const p = f.properties;
        // On garde les numéros et les rues (pas les communes seules)
        if (!p?.name || p.type === "municipality") continue;
        const detail = [p.postcode, p.city].filter(Boolean).join(" ");
        const cleLigne = `${p.name}|${detail}`;
        if (vus.has(cleLigne)) continue;
        vus.add(cleLigne);
        const dep = (p.context ?? "").split(",")[0].trim(); // « 38, Isère, … » → « 38 »
        const codeDep = /^(\d{2,3}|2[AB])$/.test(dep) ? dep : "";
        resultat.push({
          label: p.name,
          detail,
          rue: p.name,
          ville: p.city ? (codeDep ? `${p.city} (${codeDep})` : p.city) : "",
        });
      }

      if (cache.size >= 500) cache.delete(cache.keys().next().value as string);
      cache.set(cle, { t: Date.now(), v: resultat });
      return NextResponse.json(resultat);
    } catch {
      // essai suivant
    }
  }
  // Hors ligne ou service indisponible : pas de suggestions, la saisie libre reste possible
  return NextResponse.json([]);
}
