import type { CSSProperties } from "react";
import { Candidature, Etape, Resultat } from "@/types/candidature";
import {
  estCloturee,
  ETAPE_COULEUR,
  formatDate,
  formatDateHeure,
  hoteSource,
  libelleDate,
  normaliserUrl,
  PRECEDENTES,
  peutAvoirResultat,
  SUITES,
  destination,
  lienItineraire,
  MODES_TRAJET,
} from "@/lib/utils";

type Props = {
  c: Candidature;
  onOpen: (c: Candidature) => void;
  onEtape: (c: Candidature, cible: Etape) => void;
  onResultat: (c: Candidature, r: Resultat) => void;
  depart: string; // adresse de départ des itinéraires (vide : position actuelle)
};

export default function CandidatureCard({ c, onOpen, onEtape, onResultat, depart }: Props) {
  const cloturee = estCloturee(c);
  const hote = hoteSource(c.sourceLien);
  const classe = c.resultat === "Accepté" ? "accepte" : c.resultat === "Refusé" ? "refuse" : "";

  return (
    <article className={`carte ${classe}`} style={{ "--couleur": ETAPE_COULEUR[c.etape] } as CSSProperties}>
      <button type="button" className="carte-corps" onClick={() => onOpen(c)}>
        <span className="carte-ligne">
          <span className="puce">{c.typeContrat}</span>
          {c.spontanee && <span className="puce spont">Spontanée</span>}
          {c.anciennesDates.length > 0 && (
            <span className="puce relance">
              {c.anciennesDates.length} relance{c.anciennesDates.length > 1 ? "s" : ""}
            </span>
          )}
          {c.resultat === "Accepté" && <span className="puce ok">Accepté</span>}
          {c.resultat === "Refusé" && <span className="puce ko">Refusé</span>}
          {c.dateCandidature && (
            <span className="carte-date" title={[...c.anciennesDates, c.dateCandidature].map(formatDate).join(" → ")}>
              {libelleDate(c.dateCandidature)}
            </span>
          )}
        </span>
        <span className="carte-titre">{c.titre}</span>
        <span className="carte-sous">
          {c.entreprise}
          {c.localisation ? ` · ${c.localisation}` : ""}
        </span>
        {c.dateEntretien && (
          <span className="carte-entretien">Entretien : {formatDateHeure(c.dateEntretien)}</span>
        )}
        {c.resultat === "Refusé" && (c.dateRefus || c.motifRefus) && (
          <span className="carte-refus" title={c.motifRefus || undefined}>
            Refusé{c.dateRefus ? ` le ${formatDate(c.dateRefus)}` : ""}
            {c.motifRefus ? ` · ${c.motifRefus}` : ""}
          </span>
        )}
      </button>

      <div className="carte-actions">
        {(c.nomRecruteur || c.emailRecruteur || c.telRecruteur) && (
          <div className="carte-contact">
            <span>{c.nomRecruteur || "Recruteur"}</span>
            {c.emailRecruteur && (
              <a href={`mailto:${encodeURI(c.emailRecruteur)}`} aria-label="Écrire au recruteur" title={c.emailRecruteur}>
                ✉
              </a>
            )}
            {c.telRecruteur && (
              <a href={`tel:${c.telRecruteur.replace(/[^\d+]/g, "")}`} aria-label="Appeler le recruteur" title={c.telRecruteur}>
                ☎
              </a>
            )}
          </div>
        )}
        {c.etape === "Entretien" && !cloturee && destination(c) && (
          <div className="carte-itineraire">
            <span>Itinéraire</span>
            {MODES_TRAJET.map((m) => (
              <a
                key={m.mode}
                href={lienItineraire(c, m.mode, depart)}
                target="_blank"
                rel="noreferrer"
                title={`${m.libelle} (Google Maps)`}
                aria-label={`Itinéraire : ${m.libelle}`}
              >
                {m.icone}
              </a>
            ))}
          </div>
        )}
        {!cloturee && SUITES[c.etape].length > 0 && (
          <div className="carte-avancer">
            {SUITES[c.etape].map((cible) => (
              <button
                key={cible}
                type="button"
                className="mini suite"
                style={{ "--couleur": ETAPE_COULEUR[cible] } as CSSProperties}
                onClick={() => onEtape(c, cible)}
              >
                → {cible}
              </button>
            ))}
          </div>
        )}

        {!cloturee && (PRECEDENTES[c.etape].length > 0 || peutAvoirResultat(c.etape)) && (
          <div className="carte-bas">
            {PRECEDENTES[c.etape].map((cible) => (
              <button
                key={`retour-${cible}`}
                type="button"
                className="mini retour"
                title={`Revenir à l’étape « ${cible} »`}
                onClick={() => onEtape(c, cible)}
              >
                ← {cible}
              </button>
            ))}
            {peutAvoirResultat(c.etape) && (
              <div className="carte-resultat">
                <button
                  type="button"
                  className="mini icone ok"
                  aria-label="Marquer comme accepté"
                  title="Accepté"
                  onClick={() => onResultat(c, "Accepté")}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="mini icone ko"
                  aria-label="Marquer comme refusé"
                  title="Refusé"
                  onClick={() => onResultat(c, "Refusé")}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {hote && (
          <a className="source" href={normaliserUrl(c.sourceLien)} target="_blank" rel="noreferrer" title="Ouvrir l’annonce">
            {hote} ↗
          </a>
        )}
      </div>
    </article>
  );
}
