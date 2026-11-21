import { Candidature } from "@/types/candidature";
import { estCloturee } from "@/lib/utils";

export type Recruteur = { nom: string; email: string; tel: string };

export type Entreprise = {
  cle: string;
  nom: string;
  candidatures: Candidature[]; // les plus récentes d’abord
  statut: string;
  nbSalaries: string;
  activite: string;
  adresse: string;
  localisation: string;
  recruteurs: Recruteur[];
  derniere: string; // date de la candidature la plus récente ("" si aucune date)
  actives: number; // candidatures en attente de résultat
  entretiens: number; // en attente, à l’étape Entretien ou Finalisation
  acceptees: number;
  refusees: number;
};

// « Échirolles Tech », « echirolles tech » et « Échirolles  Tech » désignent la même entreprise
export const cleEntreprise = (nom: string) =>
  nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Plus récentes d’abord ; sans date (« Je dois postuler ») après celles qui en ont une
const parRecence = (a: Candidature, b: Candidature) => {
  if (!a.dateCandidature && !b.dateCandidature) return 0;
  if (!a.dateCandidature) return 1;
  if (!b.dateCandidature) return -1;
  return b.dateCandidature.localeCompare(a.dateCandidature);
};

const premier = (liste: Candidature[], champ: (c: Candidature) => string) =>
  liste.map(champ).find((v) => v.trim() !== "") ?? "";

// Les entreprises ne sont pas stockées à part : elles sont déduites des candidatures
export function grouperParEntreprise(items: Candidature[]): Entreprise[] {
  const groupes = new Map<string, Candidature[]>();
  for (const c of items) {
    const cle = cleEntreprise(c.entreprise);
    if (!cle) continue;
    groupes.set(cle, [...(groupes.get(cle) ?? []), c]);
  }

  return [...groupes.entries()].map(([cle, liste]) => {
    const triees = [...liste].sort(parRecence);

    const recruteurs = new Map<string, Recruteur>();
    for (const c of triees) {
      if (!c.nomRecruteur && !c.emailRecruteur && !c.telRecruteur) continue;
      // Même recruteur d’une candidature à l’autre : le nom (sinon l’e-mail, sinon le téléphone) sert de clé
      const id = (c.nomRecruteur ? cleEntreprise(c.nomRecruteur) : c.emailRecruteur || c.telRecruteur).toLowerCase();
      const existant = recruteurs.get(id);
      recruteurs.set(id, {
        nom: existant?.nom || c.nomRecruteur,
        email: existant?.email || c.emailRecruteur,
        tel: existant?.tel || c.telRecruteur,
      });
    }

    return {
      cle,
      nom: premier(triees, (c) => c.entreprise.trim()),
      candidatures: triees,
      // Informations de l’entreprise : celles de la candidature la plus récente qui les renseigne
      statut: premier(triees, (c) => c.statutEntreprise),
      nbSalaries: premier(triees, (c) => c.nbSalaries),
      activite: premier(triees, (c) => c.activiteEntreprise),
      adresse: premier(triees, (c) => c.adresse),
      localisation: premier(triees, (c) => c.localisation),
      recruteurs: [...recruteurs.values()],
      derniere: triees.find((c) => c.dateCandidature)?.dateCandidature ?? "",
      actives: triees.filter((c) => !estCloturee(c)).length,
      entretiens: triees.filter((c) => !estCloturee(c) && (c.etape === "Entretien" || c.etape === "Finalisation")).length,
      acceptees: triees.filter((c) => c.resultat === "Accepté").length,
      refusees: triees.filter((c) => c.resultat === "Refusé").length,
    };
  });
}

// « 50 » → « 50 salariés », « 10-50 » → « 10-50 salariés », « 1 » → « 1 salarié »
export const libelleEffectif = (v: string) => {
  const t = v.trim();
  if (!t) return "";
  if (/salari/i.test(t)) return t;
  return `${t} ${t === "1" ? "salarié" : "salariés"}`;
};
