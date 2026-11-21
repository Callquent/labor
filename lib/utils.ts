import { Candidature, CONTRATS, ETAPES, Etape, RESULTATS } from "@/types/candidature";

export const ETAPE_COULEUR: Record<Etape, string> = {
  "Je dois postuler": "#64748b",
  "Postulé": "#2563eb",
  "Je relance": "#d97706",
  "Entretien": "#7c3aed",
  "Finalisation": "#be185d",
};

// Étapes accessibles depuis chaque étape (boutons de la carte)
export const SUITES: Record<Etape, Etape[]> = {
  "Je dois postuler": ["Postulé"],
  "Postulé": ["Je relance", "Entretien"],
  "Je relance": ["Entretien"],
  "Entretien": ["Finalisation"],
  "Finalisation": [],
};

// Étapes vers lesquelles on peut revenir en arrière
export const PRECEDENTES: Record<Etape, Etape[]> = {
  "Je dois postuler": [],
  "Postulé": ["Je dois postuler"],
  "Je relance": ["Postulé"],
  "Entretien": ["Postulé", "Je relance"],
  "Finalisation": ["Entretien"],
};

// Accepté / Refusé = candidature clôturée, plus modifiable
export const estCloturee = (c: Candidature) => c.resultat !== "En attente";

// Pas de résultat possible tant qu’on n’a pas postulé
export const peutAvoirResultat = (etape: Etape) => etape !== "Je dois postuler";

// « Je dois postuler » : ni résultat, ni date de candidature
export const coherent = (c: Candidature): Candidature => {
  let r = c;
  if (r.etape === "Je dois postuler") r = { ...r, resultat: "En attente", dateCandidature: "", anciennesDates: [] };
  // La date d’entretien n’existe qu’à partir de l’étape « Entretien »
  if (r.etape !== "Entretien" && r.etape !== "Finalisation") r = { ...r, dateEntretien: "" };
  // Date et motif du refus : seulement pour une candidature refusée
  if (r.resultat !== "Refusé" && (r.dateRefus || r.motifRefus)) r = { ...r, dateRefus: "", motifRefus: "" };
  return r;
};

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString("fr-FR") : "";
};

// « 2026-11-12T14:30 » → « 12/11/2026 à 14h30 »
export const formatDateHeure = (v: string) => {
  const [d, h] = v.split("T");
  if (!d) return "";
  return `${formatDate(d)}${h ? ` à ${h.slice(0, 5).replace(":", "h")}` : ""}`;
};

// Date et historique quand une candidature passe de base.etape à cible.
// - sortie de « Je dois postuler » : la date choisie devient la date de candidature
// - « Je relance » → « Postulé » : la date choisie est la nouvelle ; l’ancienne est gardée dans l’historique
// - retour à « Je dois postuler » : date et historique effacés
export function transition(
  base: Candidature,
  cible: Etape,
  date: string
): Pick<Candidature, "etape" | "dateCandidature" | "anciennesDates"> {
  if (cible === "Je dois postuler") return { etape: cible, dateCandidature: "", anciennesDates: [] };
  if (base.etape === "Je dois postuler") return { etape: cible, dateCandidature: date, anciennesDates: [] };
  if (base.etape === "Je relance" && cible === "Postulé") {
    return {
      etape: cible,
      dateCandidature: date,
      anciennesDates: base.dateCandidature ? [...base.anciennesDates, base.dateCandidature] : base.anciennesDates,
    };
  }
  return { etape: cible, dateCandidature: base.dateCandidature, anciennesDates: base.anciennesDates };
}

// crypto.randomUUID n’existe pas en HTTP hors localhost : repli si absent
export const nouvelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

const deux = (n: number) => String(n).padStart(2, "0");

export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
};

export const vide = (etape: Etape = "Je dois postuler"): Candidature => ({
  id: nouvelId(),
  titre: "",
  // Pas de date tant qu’on n’a pas postulé
  dateCandidature: etape === "Je dois postuler" ? "" : aujourdhui(),
  anciennesDates: [],
  spontanee: false,
  dateEntretien: "",
  adresse: "",
  dateRefus: "",
  motifRefus: "",
  statutEntreprise: "",
  nbSalaries: "",
  activiteEntreprise: "",
  nomRecruteur: "",
  emailRecruteur: "",
  telRecruteur: "",
  entreprise: "",
  typeContrat: "CDI",
  localisation: "",
  sourceLien: "",
  etape,
  resultat: "En attente",
});

export const joursDepuis = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const debut = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const auj = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((auj - debut) / 86400000);
};

export const libelleDate = (iso: string) => {
  const j = joursDepuis(iso);
  if (j === 0) return "Aujourd’hui";
  if (j === 1) return "Hier";
  if (j > 1 && j < 30) return `Il y a ${j} j`;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

export const normaliserUrl = (v: string) => {
  const t = v.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export const hoteSource = (url: string) => {
  try {
    return new URL(normaliserUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// Valide et complète une candidature venant du stockage ou d’un fichier importé
export function nettoyer(raw: unknown): Candidature | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === "string" ? v : "");
  const dans = <T extends string>(liste: readonly T[], v: unknown, defaut: T): T =>
    liste.includes(v as T) ? (v as T) : defaut;
  const spontanee = r.spontanee === true;
  const titre = txt(r.titre).trim() || (spontanee ? "Candidature spontanée" : "");
  if (!titre) return null;
  return coherent({
    id: txt(r.id) || nouvelId(),
    titre,
    spontanee,
    dateCandidature: /^\d{4}-\d{2}-\d{2}$/.test(txt(r.dateCandidature)) ? txt(r.dateCandidature) : aujourdhui(),
    anciennesDates: Array.isArray(r.anciennesDates)
      ? r.anciennesDates.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [],
    dateEntretien: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(txt(r.dateEntretien)) ? txt(r.dateEntretien) : "",
    adresse: txt(r.adresse).trim(),
    dateRefus: /^\d{4}-\d{2}-\d{2}$/.test(txt(r.dateRefus)) ? txt(r.dateRefus) : "",
    motifRefus: txt(r.motifRefus).trim(),
    statutEntreprise: txt(r.statutEntreprise).trim(),
    nbSalaries: txt(r.nbSalaries).trim(),
    activiteEntreprise: txt(r.activiteEntreprise).trim(),
    nomRecruteur: txt(r.nomRecruteur).trim(),
    emailRecruteur: txt(r.emailRecruteur).trim(),
    telRecruteur: txt(r.telRecruteur).trim(),
    entreprise: txt(r.entreprise),
    typeContrat: dans(CONTRATS, r.typeContrat, "CDI"),
    localisation: txt(r.localisation),
    sourceLien: txt(r.sourceLien),
    etape: dans(ETAPES, r.etape, "Je dois postuler"),
    resultat: dans(RESULTATS, r.resultat, "En attente"),
  });
}

// ---------- Itinéraire vers un entretien (liens Google Maps / Waze, sans clé API) ----------
export type ModeTrajet = "driving" | "transit" | "bicycling" | "walking";

export const MODES_TRAJET: { mode: ModeTrajet; icone: string; libelle: string }[] = [
  { mode: "driving", icone: "🚗", libelle: "Voiture" },
  { mode: "transit", icone: "🚆", libelle: "Transports" },
  { mode: "bicycling", icone: "🚲", libelle: "Vélo" },
  { mode: "walking", icone: "🚶", libelle: "À pied" },
];

// Lieu de l’entretien : adresse + ville ; sans adresse, entreprise + ville ; rien si télétravail
export const destination = (c: Pick<Candidature, "adresse" | "localisation" | "entreprise">) => {
  const loc = c.localisation.trim();
  const ville = loc && !/t[ée]l[ée]travail|hybride|remote|à distance/i.test(loc) ? loc : "";
  const adresse = c.adresse.trim();
  if (adresse) return [adresse, ville].filter(Boolean).join(", ");
  return ville ? [c.entreprise.trim(), ville].filter(Boolean).join(", ") : "";
};

// Sans adresse de départ, Google Maps utilise la position actuelle de l’appareil
export const lienItineraire = (
  c: Pick<Candidature, "adresse" | "localisation" | "entreprise">,
  mode: ModeTrajet,
  depart: string
) => {
  const dest = destination(c);
  if (!dest) return "";
  const p = new URLSearchParams({ api: "1", destination: dest, travelmode: mode });
  if (depart.trim()) p.set("origin", depart.trim());
  return `https://www.google.com/maps/dir/?${p}`;
};

export const lienWaze = (c: Pick<Candidature, "adresse" | "localisation" | "entreprise">) => {
  const dest = destination(c);
  return dest ? `https://waze.com/ul?q=${encodeURIComponent(dest)}&navigate=yes` : "";
};
