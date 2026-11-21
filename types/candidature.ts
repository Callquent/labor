export const ETAPES = [
  "Je dois postuler",
  "Postulé",
  "Je relance",
  "Entretien",
  "Finalisation",
] as const;

export const CONTRATS = ["CDI", "CDD", "Alternance", "Stage", "Freelance", "Intérim"] as const;

export const RESULTATS = ["En attente", "Accepté", "Refusé"] as const;

export type Etape = (typeof ETAPES)[number];
export type Contrat = (typeof CONTRATS)[number];
export type Resultat = (typeof RESULTATS)[number];

export interface Candidature {
  id: string;
  titre: string;
  dateCandidature: string; // YYYY-MM-DD, date « postulé » en cours ("" avant d’avoir postulé)
  anciennesDates: string[]; // anciennes dates « postulé » ; leur nombre = nombre de relances faites
  spontanee: boolean; // candidature spontanée (titre facultatif)
  adresse: string; // numéro et rue du lieu de travail
  dateRefus: string; // YYYY-MM-DD, renseignée quand la candidature est refusée
  motifRefus: string;
  statutEntreprise: string; // forme juridique ou type (SAS, SARL, association, public…)
  nbSalaries: string; // effectif, libre (« 50 », « 10-50 »)
  activiteEntreprise: string;
  nomRecruteur: string;
  emailRecruteur: string;
  telRecruteur: string;
  dateEntretien: string; // YYYY-MM-DDTHH:mm, demandée à partir de l’étape « Entretien »
  entreprise: string;
  typeContrat: Contrat;
  localisation: string;
  sourceLien: string;
  etape: Etape;
  resultat: Resultat;
}
