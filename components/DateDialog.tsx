import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Etape } from "@/types/candidature";
import { aujourdhui } from "@/lib/utils";

export type ModeDate = "candidature" | "relance" | "entretien" | "refus";

type Props = {
  titre: string;
  cible: Etape;
  mode: ModeDate;
  ancienneDate: string; // relance : ancienne date « postulé », conservée dans l’historique
  onValider: (valeur: string, complement?: string) => void; // complement : motif du refus
  onClose: () => void;
};

const TEXTES: Record<ModeDate, string> = {
  candidature: "Date de candidature",
  relance: "Date de la relance",
  entretien: "Date et heure de l’entretien",
  refus: "Date du refus",
};

// Demande une date : premier envoi, relance, ou date et heure d’entretien
export default function DateDialog({ titre, cible, mode, ancienneDate, onValider, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [valeur, setValeur] = useState(mode === "entretien" ? "" : aujourdhui());
  const [motif, setMotif] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    if (valeur) onValider(valeur, mode === "refus" ? motif.trim() : undefined);
  };

  const aide =
    mode === "relance"
      ? `« ${titre} » repasse à « ${cible} ». Quelle est la date de la relance ? L’ancienne date${
          ancienneDate ? ` (${ancienneDate})` : ""
        } est conservée dans l’historique.`
      : mode === "refus"
      ? `« ${titre} » va être marquée comme refusée. Quelle est la date du refus ? Seuls la date et le motif resteront modifiables ensuite.`
      : mode === "entretien"
      ? `« ${titre} » passe à l’étape « Entretien ». Quand a lieu l’entretien ?`
      : `« ${titre} » passe à l’étape « ${cible} ». Quelle est la date de candidature ?`;

  return (
    <dialog
      ref={ref}
      className="fenetre fenetre-petite"
      aria-labelledby="date-titre"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={soumettre}>
        <div className="fenetre-corps">
          <h2 id="date-titre" className="titre-marque fenetre-titre">
            {TEXTES[mode]}
          </h2>
          <p className="aide mt-0 mb-3">{aide}</p>
          <input
            type={mode === "entretien" ? "datetime-local" : "date"}
            required
            autoFocus
            className="form-control"
            aria-label={TEXTES[mode]}
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
          />
          {mode === "refus" && (
            <>
              <label className="form-label mt-3" htmlFor="d-motif">Motif du refus (facultatif)</label>
              <textarea
                id="d-motif"
                rows={3}
                className="form-control"
                placeholder="Ex. profil non retenu, poste pourvu, pas de réponse…"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="fenetre-pied">
          <span className="espace" />
          <button type="button" className="btn-clair" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-marque">
            Valider
          </button>
        </div>
      </form>
    </dialog>
  );
}
