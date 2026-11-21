// Dates fournies à l'application « Agenda » (voir app/api/agenda/route.ts) :
// uniquement les dates d'entretien. Fonction pure : pas d'accès à la base, elle se teste seule.

export type AgendaEvent = {
  id: string; // unique pour chaque occurrence
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm ("" si l'heure n'est pas renseignée)
  status: "todo" | "done";
  category: string;
  path: string; // chemin dans l'application
};

export type LigneEntretien = {
  id: string;
  titre: string;
  entreprise: string;
  localisation: string;
  adresse: string;
  dateEntretien: string; // YYYY-MM-DD ou YYYY-MM-DDTHH:mm
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ENTRETIEN = /^(\d{4}-\d{2}-\d{2})(?:T([01]\d|2[0-3]):([0-5]\d))?$/;
const MAX_DAYS = 400;

const jour = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Valide ?from=&to= : dates réelles, ordre correct, plage limitée. Renvoie null si invalide. */
export function parseRange(from: string | null, to: string | null): { from: string; to: string } | null {
  if (!from || !to || !ISO.test(from) || !ISO.test(to)) return null;
  const a = jour(from);
  const b = jour(to);
  if (a.toISOString().slice(0, 10) !== from || b.toISOString().slice(0, 10) !== to || b < a) return null;
  return (b.getTime() - a.getTime()) / 86_400_000 > MAX_DAYS ? null : { from, to };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `now` = « YYYY-MM-DDTHH:mm » local ; un entretien dont la date/heure est passée est « fait ». */
export function agendaEvents(lignes: LigneEntretien[], from: string, to: string, now: string): AgendaEvent[] {
  const out: AgendaEvent[] = [];
  for (const l of lignes) {
    const m = ENTRETIEN.exec(l.dateEntretien);
    if (!m) continue;
    const [, date, h, min] = m;
    if (date < from || date > to) continue;
    const time = h ? `${h}:${min}` : "";
    const quoi = [l.entreprise, l.titre].map((s) => s.trim()).filter(Boolean).join(" · ") || "Candidature";
    const lieu = (l.adresse || l.localisation).trim();
    // Sans heure, l'entretien reste « à faire » toute la journée.
    const passe = time ? `${date}T${time}` < now : date < now.slice(0, 10);
    out.push({
      id: `entretien-${l.id}`,
      title: `Entretien : ${quoi}`,
      date,
      time,
      status: passe ? "done" : "todo",
      category: ["Entretien", lieu].filter(Boolean).join(" · ").slice(0, 60),
      path: "/",
    });
  }
  return out;
}

export const maintenant = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
