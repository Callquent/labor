import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import ChampSuggestions from "@/components/ChampSuggestions";
import { Candidature, CONTRATS, ETAPES, RESULTATS, Resultat } from "@/types/candidature";
import {
  aujourdhui,
  estCloturee,
  ETAPE_COULEUR,
  formatDate,
  normaliserUrl,
  peutAvoirResultat,
  transition,
  destination,
  lienItineraire,
  lienWaze,
  MODES_TRAJET,
} from "@/lib/utils";

type Props = {
  initial: Candidature;
  depart: string; // adresse de départ des itinéraires (vide : position actuelle)
  existe: boolean;
  onClose: () => void;
  onSave: (c: Candidature) => void;
  onDelete: (id: string) => void;
};

const COULEUR_RESULTAT: Record<Resultat, string> = {
  "En attente": "#64748b",
  "Accepté": "#15803d",
  "Refusé": "#b91c1c",
};

export default function CandidatureDialog({ initial, depart, existe, onClose, onSave, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<Candidature>(initial);
  const lecture = estCloturee(initial); // accepté ou refusé : plus modifiable
  const refusModifiable = lecture && initial.resultat === "Refusé"; // date et motif du refus restent modifiables
  // Groupes facultatifs : ouverts d’emblée si déjà renseignés
  const [ouvrirEntreprise] = useState(!!(initial.statutEntreprise || initial.nbSalaries || initial.activiteEntreprise));
  const [ouvrirRecruteur] = useState(!!(initial.nomRecruteur || initial.emailRecruteur || initial.telRecruteur));

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const champ = <K extends keyof Candidature>(k: K, v: Candidature[K]) => setF((p) => ({ ...p, [k]: v }));

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      ...f,
      titre: f.titre.trim() || (f.spontanee ? "Candidature spontanée" : ""),
      entreprise: f.entreprise.trim(),
      localisation: f.localisation.trim(),
      sourceLien: normaliserUrl(f.sourceLien),
    });
  };

  return (
    <dialog
      ref={ref}
      className="fenetre"
      aria-labelledby="fenetre-titre"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={soumettre}>
        <div className="fenetre-corps">
          <h2 id="fenetre-titre" className="titre-marque fenetre-titre">
            {lecture ? "Détail de la candidature" : existe ? "Modifier la candidature" : "Nouvelle candidature"}
          </h2>

          {lecture && (
            <p className="bandeau-lecture">
              Candidature clôturée ({initial.resultat}) :{" "}
              {refusModifiable ? "seuls la date et le motif du refus restent modifiables." : "elle n’est plus modifiable."}
            </p>
          )}

          <fieldset disabled={lecture} className="m-0 p-0 border-0">
          <div className="row g-3">
            <div className="col-12">
              <div className="titre-ligne">
                <label className="form-label" htmlFor="f-titre">Titre de la candidature</label>
                <label className="interrupteur" htmlFor="f-spont">
                  <input
                    id="f-spont"
                    type="checkbox"
                    role="switch"
                    checked={f.spontanee}
                    onChange={(e) => champ("spontanee", e.target.checked)}
                  />
                  <span className="piste" aria-hidden="true" />
                  Candidature spontanée
                </label>
              </div>
              <input
                id="f-titre"
                required={!f.spontanee}
                autoFocus
                className="form-control"
                placeholder={f.spontanee ? "Poste visé (facultatif)" : "Ex. Développeur full-stack"}
                value={f.titre}
                onChange={(e) => champ("titre", e.target.value)}
              />

            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="f-ent">Entreprise</label>
              <input
                id="f-ent"
                required
                className="form-control"
                value={f.entreprise}
                onChange={(e) => champ("entreprise", e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="f-loc">Localisation</label>
              <ChampSuggestions
                id="f-loc"
                endpoint="/villes"
                placeholder="Ville, télétravail…"
                value={f.localisation}
                onChange={(v) => champ("localisation", v)}
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="f-adresse">Adresse (numéro et rue)</label>
              <ChampSuggestions
                id="f-adresse"
                endpoint="/adresses"
                minCaracteres={3}
                // oriente la recherche vers la ville déjà choisie (« Échirolles (38) » → « Échirolles »)
                params={{ ville: /^(.*?)\s*\((\d{2,3}|2[AB])\)$/.exec(f.localisation.trim())?.[1] ?? "" }}
                placeholder="Ex. 12 rue de la République"
                value={f.adresse}
                onChange={(v) => champ("adresse", v)}
                // choisir une adresse renseigne aussi la ville
                onChoisir={(s) => typeof s.ville === "string" && s.ville && champ("localisation", s.ville)}
              />
              {f.adresse && (
                <a
                  className="source d-inline-block mt-1"
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${f.adresse} ${f.localisation}`.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir sur la carte ↗
                </a>
              )}
            </div>
            {f.etape !== "Je dois postuler" && (
              <div className="col-6">
                <label className="form-label" htmlFor="f-date">Date de candidature</label>
                <input
                  id="f-date"
                  type="date"
                  required
                  className="form-control"
                  value={f.dateCandidature}
                  onChange={(e) => champ("dateCandidature", e.target.value)}
                />
              </div>
            )}
            <div className="col-6">
              <label className="form-label" htmlFor="f-contrat">Type de contrat</label>
              <select
                id="f-contrat"
                className="form-select"
                value={f.typeContrat}
                onChange={(e) => champ("typeContrat", e.target.value as Candidature["typeContrat"])}
              >
                {CONTRATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="f-lien">Source du lien</label>
              <input
                id="f-lien"
                inputMode="url"
                className="form-control"
                placeholder="Collez l’adresse de l’annonce"
                value={f.sourceLien}
                onChange={(e) => champ("sourceLien", e.target.value)}
              />
            </div>
            <div className="col-12">
              <span className="form-label d-block">Étape</span>
              <div className="choix" role="group" aria-label="Étape">
                {ETAPES.map((e) => (
                  <button
                    type="button"
                    key={e}
                    aria-pressed={f.etape === e}
                    style={{ "--couleur": ETAPE_COULEUR[e] } as CSSProperties}
                    onClick={() =>
                      setF((p) => ({
                        ...p,
                        resultat: e === "Je dois postuler" ? "En attente" : p.resultat,
                        // La date est demandée à chaque nouvelle date « postulé » (premier envoi ou relance)
                        ...transition(initial, e, p.etape !== initial.etape && p.dateCandidature ? p.dateCandidature : aujourdhui()),
                      }))
                    }
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            {(f.etape === "Entretien" || f.etape === "Finalisation") && (
              <div className="col-md-6">
                <label className="form-label" htmlFor="f-entretien">Date et heure de l’entretien</label>
                <input
                  id="f-entretien"
                  type="datetime-local"
                  required={f.etape === "Entretien"}
                  className="form-control"
                  value={f.dateEntretien}
                  onChange={(e) => champ("dateEntretien", e.target.value)}
                />
              </div>
            )}
            {(f.etape === "Entretien" || f.etape === "Finalisation") && destination(f) && (
              <div className="col-12">
                <span className="form-label d-block">Itinéraire vers l’entretien</span>
                <div className="choix">
                  {MODES_TRAJET.map((m) => (
                    <a
                      key={m.mode}
                      className="lien-puce"
                      href={lienItineraire(f, m.mode, depart)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.icone} {m.libelle}
                    </a>
                  ))}
                  <a className="lien-puce" href={lienWaze(f)} target="_blank" rel="noreferrer">
                    Waze
                  </a>
                </div>
                <p className="aide">
                  Vers : {destination(f)}. Départ : {depart.trim() || "votre position actuelle"}.
                </p>
              </div>
            )}
            {f.anciennesDates.length > 0 && (
              <div className="col-12">
                <span className="form-label d-block">
                  Historique : {f.anciennesDates.length} relance{f.anciennesDates.length > 1 ? "s" : ""}
                </span>
                <ul className="historique">
                  {[...f.anciennesDates, f.dateCandidature].filter(Boolean).map((d, i) => (
                    <li key={i}>
                      {i === 0 ? "Candidature" : `Relance ${i}`} : {formatDate(d)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {peutAvoirResultat(f.etape) && (
            <div className="col-12">
              <span className="form-label d-block">Résultat</span>
              <div className="choix" role="group" aria-label="Résultat">
                {RESULTATS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    aria-pressed={f.resultat === r}
                    style={{ "--couleur": COULEUR_RESULTAT[r] } as CSSProperties}
                    onClick={() =>
                      setF((p) => ({
                        ...p,
                        resultat: r,
                        dateRefus: r === "Refusé" ? p.dateRefus || aujourdhui() : "",
                        motifRefus: r === "Refusé" ? p.motifRefus : "",
                      }))
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
              {!lecture && (
                <p className="aide">Accepté ou refusé : la candidature sera ensuite verrouillée.</p>
              )}
            </div>
            )}
          </div>
          </fieldset>

          {f.resultat === "Refusé" && (
            <div className="row g-3 mt-0">
              <div className="col-md-6">
                <label className="form-label" htmlFor="f-date-refus">Date du refus</label>
                <input
                  id="f-date-refus"
                  type="date"
                  required
                  className="form-control"
                  value={f.dateRefus}
                  onChange={(e) => champ("dateRefus", e.target.value)}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="f-motif">Motif du refus</label>
                <textarea
                  id="f-motif"
                  rows={2}
                  className="form-control"
                  placeholder="Ex. profil non retenu, poste pourvu, pas de réponse…"
                  value={f.motifRefus}
                  onChange={(e) => champ("motifRefus", e.target.value)}
                />
              </div>
            </div>
          )}

          <fieldset disabled={lecture} className="m-0 p-0 border-0">
            <details className="groupe" open={ouvrirEntreprise}>
              <summary>Entreprise : statut, effectif, activité</summary>
              <div className="row g-3 mt-0">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="f-statut">Statut de l’entreprise</label>
                  <input
                    id="f-statut"
                    list="statuts-entreprise"
                    className="form-control"
                    placeholder="SAS, SARL, association…"
                    value={f.statutEntreprise}
                    onChange={(e) => champ("statutEntreprise", e.target.value)}
                  />
                  <datalist id="statuts-entreprise">
                    {["SAS", "SARL", "SA", "EURL", "Auto-entrepreneur", "Association", "Public", "Collectivité", "Autre"].map(
                      (s) => (
                        <option key={s} value={s} />
                      )
                    )}
                  </datalist>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="f-effectif">Nombre de salariés</label>
                  <input
                    id="f-effectif"
                    className="form-control"
                    placeholder="Ex. 50 ou 10-50"
                    value={f.nbSalaries}
                    onChange={(e) => champ("nbSalaries", e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="f-activite">Activité de l’entreprise</label>
                  <input
                    id="f-activite"
                    className="form-control"
                    placeholder="Ex. édition de logiciels, e-commerce…"
                    value={f.activiteEntreprise}
                    onChange={(e) => champ("activiteEntreprise", e.target.value)}
                  />
                </div>
              </div>
            </details>

            <details className="groupe" open={ouvrirRecruteur}>
              <summary>Recruteur : nom, e-mail, téléphone</summary>
              <div className="row g-3 mt-0">
                <div className="col-12">
                  <label className="form-label" htmlFor="f-recruteur">Nom du recruteur</label>
                  <input
                    id="f-recruteur"
                    className="form-control"
                    value={f.nomRecruteur}
                    onChange={(e) => champ("nomRecruteur", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="f-email">E-mail du recruteur</label>
                  <input
                    id="f-email"
                    type="email"
                    className="form-control"
                    value={f.emailRecruteur}
                    onChange={(e) => champ("emailRecruteur", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="f-tel">Téléphone du recruteur</label>
                  <input
                    id="f-tel"
                    type="tel"
                    className="form-control"
                    value={f.telRecruteur}
                    onChange={(e) => champ("telRecruteur", e.target.value)}
                  />
                </div>
              </div>
            </details>
          </fieldset>
          {(f.emailRecruteur || f.telRecruteur) && (
            <p className="contacts mt-2 mb-0">
              {f.emailRecruteur && <a href={`mailto:${encodeURI(f.emailRecruteur)}`}>✉ Écrire</a>}
              {f.telRecruteur && <a href={`tel:${f.telRecruteur.replace(/[^\d+]/g, "")}`}>☎ Appeler</a>}
            </p>
          )}
          {lecture && f.sourceLien && (
            <p className="mt-3 mb-0">
              <a className="source" href={normaliserUrl(f.sourceLien)} target="_blank" rel="noreferrer">
                Ouvrir l’annonce ↗
              </a>
            </p>
          )}
        </div>

        <div className="fenetre-pied">
          {existe && (
            <button
              type="button"
              className="supprimer"
              onClick={() => {
                if (confirm("Supprimer cette candidature ?")) onDelete(f.id);
              }}
            >
              Supprimer
            </button>
          )}
          <span className="espace" />
          <button type="button" className="btn-clair" onClick={onClose}>
            {lecture ? "Fermer" : "Annuler"}
          </button>
          {(!lecture || refusModifiable) && (
            <button type="submit" className="btn-marque">
              Enregistrer
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
