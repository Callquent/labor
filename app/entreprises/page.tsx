"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import Onglets from "@/components/Onglets";
import { Candidature } from "@/types/candidature";
import { ETAPE_COULEUR, formatDateHeure, libelleDate, nettoyer } from "@/lib/utils";
import { Entreprise, grouperParEntreprise, libelleEffectif } from "@/lib/entreprises";

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api`;

type Filtre = "toutes" | "actives" | "entretien" | "closes";
type Tri = "nom" | "candidatures" | "recentes";

const correspond = (e: Entreprise, f: Filtre) =>
  f === "toutes" ||
  (f === "actives" && e.actives > 0) ||
  (f === "entretien" && e.entretiens > 0) ||
  (f === "closes" && e.actives === 0);

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function PageEntreprises() {
  const [items, setItems] = useState<Candidature[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [tri, setTri] = useState<Tri>("nom");

  // Chargement depuis la base, et à chaque retour sur l’onglet
  useEffect(() => {
    let annule = false;
    const charger = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(`${API}/candidatures`);
        if (!r.ok) throw new Error("API");
        const liste = (await r.json()) as unknown[];
        if (annule) return;
        setItems((Array.isArray(liste) ? liste : []).map(nettoyer).filter((c): c is Candidature => c !== null));
        setErreur(false);
      } catch {
        if (!annule) setErreur(true);
      }
      if (!annule) setCharge(true);
    };
    charger();
    window.addEventListener("focus", charger);
    document.addEventListener("visibilitychange", charger);
    return () => {
      annule = true;
      window.removeEventListener("focus", charger);
      document.removeEventListener("visibilitychange", charger);
    };
  }, []);

  const entreprises = useMemo(() => grouperParEntreprise(items), [items]);

  const stats = useMemo(
    () => ({
      total: entreprises.length,
      actives: entreprises.filter((e) => e.actives > 0).length,
      entretien: entreprises.filter((e) => e.entretiens > 0).length,
      closes: entreprises.filter((e) => e.actives === 0).length,
    }),
    [entreprises]
  );

  const visibles = useMemo(() => {
    const q = sansAccents(recherche.trim());
    const liste = entreprises
      .filter((e) => correspond(e, filtre))
      .filter(
        (e) =>
          !q ||
          [e.nom, e.activite, e.localisation, e.adresse, e.statut, ...e.recruteurs.map((r) => r.nom)].some((v) =>
            sansAccents(v).includes(q)
          )
      );
    return liste.sort((a, b) => {
      if (tri === "candidatures") return b.candidatures.length - a.candidatures.length || a.nom.localeCompare(b.nom, "fr");
      if (tri === "recentes") return (b.derniere || "").localeCompare(a.derniere || "") || a.nom.localeCompare(b.nom, "fr");
      return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
    });
  }, [entreprises, recherche, filtre, tri]);

  return (
    <main className="conteneur">
      <header className="entete">
        <div className="marque">
          <Logo size={46} />
          <div>
            <h1 className="titre-marque">Suivi de candidatures</h1>
          </div>
        </div>
      </header>

      <Onglets />

      {erreur && (
        <div className="alerte-erreur" role="alert">
          Impossible de charger les entreprises depuis la base de données.
          <button type="button" className="btn-clair" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      )}

      {charge && entreprises.length === 0 && !erreur ? (
        <section className="vide">
          <h2 className="titre-marque">Aucune entreprise pour l’instant</h2>
          <p>Les entreprises apparaissent ici dès que tu ajoutes une candidature.</p>
          <Link href="/" className="btn-marque" style={{ textDecoration: "none", display: "inline-block" }}>
            Ajouter une candidature
          </Link>
        </section>
      ) : (
        charge && (
          <>
            <section className="stats" aria-label="Résumé">
              <div className="stat"><b>{stats.total}</b><span>Entreprises</span></div>
              <div className="stat"><b>{stats.actives}</b><span>Avec une candidature en cours</span></div>
              <div className="stat"><b>{stats.entretien}</b><span>Avec un entretien</span></div>
              <div className="stat"><b>{stats.closes}</b><span>Toutes clôturées</span></div>
            </section>

            <div className="barre">
              <div className="recherche">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Rechercher une entreprise, une activité, une ville, un recruteur"
                  aria-label="Rechercher"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              <div className="segment" role="group" aria-label="Filtre">
                {(
                  [
                    ["toutes", "Toutes"],
                    ["actives", "En cours"],
                    ["entretien", "Entretien"],
                    ["closes", "Clôturées"],
                  ] as [Filtre, string][]
                ).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={filtre === k} onClick={() => setFiltre(k)}>
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="form-select form-select-sm tri"
                aria-label="Trier"
                value={tri}
                onChange={(e) => setTri(e.target.value as Tri)}
              >
                <option value="nom">Nom (A → Z)</option>
                <option value="candidatures">Plus de candidatures</option>
                <option value="recentes">Candidature la plus récente</option>
              </select>
            </div>

            {visibles.length === 0 ? (
              <p className="text-muted text-center py-4">Aucune entreprise ne correspond.</p>
            ) : (
              <div className="entreprises">
                {visibles.map((e) => (
                  <article className="entreprise" key={e.cle}>
                    <h2 className="entreprise-nom">{e.nom}</h2>

                    {(e.statut || e.nbSalaries) && (
                      <div className="entreprise-puces">
                        {e.statut && <span className="puce">{e.statut}</span>}
                        {e.nbSalaries && <span className="puce">{libelleEffectif(e.nbSalaries)}</span>}
                      </div>
                    )}
                    {e.activite && <p className="entreprise-activite">{e.activite}</p>}

                    {(e.adresse || e.localisation) && (
                      <p className="entreprise-lieu">
                        {[e.adresse, e.localisation].filter(Boolean).join(", ")}{" "}
                        <a
                          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(
                            [e.adresse, e.localisation].filter(Boolean).join(" ")
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Carte ↗
                        </a>
                      </p>
                    )}

                    {e.recruteurs.length > 0 && (
                      <ul className="entreprise-recruteurs">
                        {e.recruteurs.map((r) => (
                          <li key={r.email || r.nom || r.tel}>
                            <span>{r.nom || "Recruteur"}</span>
                            {r.email && (
                              <a href={`mailto:${encodeURI(r.email)}`} title={r.email} aria-label={`Écrire à ${r.nom || r.email}`}>
                                ✉
                              </a>
                            )}
                            {r.tel && (
                              <a
                                href={`tel:${r.tel.replace(/[^\d+]/g, "")}`}
                                title={r.tel}
                                aria-label={`Appeler ${r.nom || r.tel}`}
                              >
                                ☎
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <h3 className="entreprise-sous-titre">
                      {e.candidatures.length} candidature{e.candidatures.length > 1 ? "s" : ""}
                    </h3>
                    <ul className="entreprise-candidatures">
                      {e.candidatures.map((c) => (
                        <li key={c.id}>
                          <Link href={`/?ouvrir=${encodeURIComponent(c.id)}`} className="lien-titre">
                            {c.titre}
                          </Link>
                          <span
                            className="puce"
                            style={
                              {
                                background: `color-mix(in srgb, ${ETAPE_COULEUR[c.etape]} 14%, #fff)`,
                                color: ETAPE_COULEUR[c.etape],
                              } as CSSProperties
                            }
                          >
                            {c.etape}
                          </span>
                          {c.resultat === "Accepté" && <span className="puce ok">Accepté</span>}
                          {c.resultat === "Refusé" && <span className="puce ko">Refusé</span>}
                          <small>
                            {c.dateEntretien && c.resultat === "En attente"
                              ? `Entretien ${formatDateHeure(c.dateEntretien)}`
                              : c.dateCandidature
                              ? libelleDate(c.dateCandidature)
                              : ""}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </>
        )
      )}
    </main>
  );
}
