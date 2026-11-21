"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Logo from "@/components/Logo";
import CandidatureCard from "@/components/CandidatureCard";
import CandidatureDialog from "@/components/CandidatureDialog";
import ChampSuggestions from "@/components/ChampSuggestions";
import Onglets from "@/components/Onglets";
import DateDialog, { type ModeDate } from "@/components/DateDialog";
import { Candidature, ETAPES, Etape, RESULTATS, Resultat } from "@/types/candidature";
import {
  aujourdhui,
  coherent,
  estCloturee,
  ETAPE_COULEUR,
  formatDate,
  formatDateHeure,
  joursDepuis,
  libelleDate,
  nettoyer,
  peutAvoirResultat,
  transition,
  vide,
} from "@/lib/utils";

// Les données sont enregistrées dans la base SQLite (API Next.js + Prisma).
// Préfixe du hub (/apps/<id>) pour les appels depuis le navigateur.
const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api`;
const JSON_HEADERS = { "Content-Type": "application/json" };

type Vue = "colonnes" | "liste";
type Statut = "tous" | "en-cours" | "acceptees" | "refusees";

const correspond = (c: Candidature, s: Statut) =>
  s === "tous" ||
  (s === "en-cours" && c.resultat === "En attente") ||
  (s === "acceptees" && c.resultat === "Accepté") ||
  (s === "refusees" && c.resultat === "Refusé");

// Date de candidature demandée : sortie de « Je dois postuler », ou nouvelle relance (« Je relance » → « Postulé »)
const demandeDate = (c: Candidature, cible: Etape) =>
  c.etape === "Je dois postuler" || (c.etape === "Je relance" && cible === "Postulé");
// Date et heure demandées au passage à « Entretien » tant qu’elles ne sont pas connues
const demandeEntretien = (c: Candidature, cible: Etape) => cible === "Entretien" && !c.dateEntretien;

export default function Page() {
  const [items, setItems] = useState<Candidature[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edition, setEdition] = useState<Candidature | null>(null);
  const [vue, setVue] = useState<Vue>("colonnes");
  const [statut, setStatut] = useState<Statut>("tous");
  const [filtreEtape, setFiltreEtape] = useState<Etape | "Toutes">("Toutes");
  const [recherche, setRecherche] = useState("");
  const [aDater, setADater] = useState<{ c: Candidature; cible: Etape; date?: string } | null>(null);
  const [aRefuser, setARefuser] = useState<Candidature | null>(null); // fenêtre date + motif du refus
  const [depart, setDepart] = useState(""); // adresse de départ des itinéraires
  const [delai, setDelai] = useState(7); // jours avant passage automatique « Postulé » → « Je relance »
  const [delaiTexte, setDelaiTexte] = useState("7");
  const fichierRef = useRef<HTMLInputElement>(null);

  // État de synchronisation avec la base
  const sauvegardees = useRef<Map<string, string>>(new Map()); // id → JSON déjà enregistré
  const itemsRef = useRef<Candidature[]>([]);
  const fileEnvoi = useRef<Promise<void>>(Promise.resolve());
  const enVol = useRef(0);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [erreurSauvegarde, setErreurSauvegarde] = useState(false);
  const [essai, setEssai] = useState(0);
  itemsRef.current = items;

  const lireListe = (donnees: unknown): Candidature[] =>
    (Array.isArray(donnees) ? donnees : []).map(nettoyer).filter((c): c is Candidature => c !== null);

  const appliquerServeur = (liste: Candidature[]) => {
    sauvegardees.current = new Map(liste.map((c) => [c.id, JSON.stringify(c)]));
    setItems(liste);
  };

  // Chargement depuis la base SQLite
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const [rc, rr] = await Promise.all([fetch(`${API}/candidatures`), fetch(`${API}/reglages`)]);
        if (!rc.ok || !rr.ok) throw new Error("API");
        const liste = lireListe(await rc.json());
        const reg = await rr.json();
        const delaiInitial: number = reg.delai;
        const vueInitiale: Vue = reg.vue === "liste" ? "liste" : "colonnes";
        const departInitial: string = typeof reg.depart === "string" ? reg.depart : "";

        if (annule) return;
        appliquerServeur(liste);
        setDelai(delaiInitial);
        setDelaiTexte(String(delaiInitial));
        setVue(vueInitiale);
        setDepart(departInitial);
      } catch {
        if (!annule) setErreurChargement(true);
      }
      if (!annule) setLoaded(true);
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lien depuis la page Entreprises (/?ouvrir=<id>) : ouvre la candidature correspondante
  useEffect(() => {
    if (!loaded) return;
    const id = new URLSearchParams(window.location.search).get("ouvrir");
    if (!id) return;
    const c = itemsRef.current.find((x) => x.id === id);
    if (c) setEdition(c);
    window.history.replaceState(null, "", window.location.pathname);
  }, [loaded]);

  // Enregistrement : seules les candidatures modifiées ou supprimées sont envoyées, dans l’ordre
  useEffect(() => {
    if (!loaded || erreurChargement) return;
    const upserts = items.filter((c) => sauvegardees.current.get(c.id) !== JSON.stringify(c));
    const presentes = new Set(items.map((c) => c.id));
    const suppressions = [...sauvegardees.current.keys()].filter((id) => !presentes.has(id));
    if (!upserts.length && !suppressions.length) return;

    const avant = new Map(sauvegardees.current);
    upserts.forEach((c) => sauvegardees.current.set(c.id, JSON.stringify(c)));
    suppressions.forEach((id) => sauvegardees.current.delete(id));

    enVol.current++;
    fileEnvoi.current = fileEnvoi.current.then(async () => {
      try {
        const r = await fetch(`${API}/candidatures`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ upserts, suppressions }),
        });
        if (!r.ok) throw new Error("API");
        setErreurSauvegarde(false);
      } catch {
        // On annule le marquage pour que « Réessayer » renvoie ces modifications
        upserts.forEach((c) => {
          const v = avant.get(c.id);
          if (v === undefined) sauvegardees.current.delete(c.id);
          else sauvegardees.current.set(c.id, v);
        });
        suppressions.forEach((id) => {
          const v = avant.get(id);
          if (v !== undefined) sauvegardees.current.set(id, v);
        });
        setErreurSauvegarde(true);
      } finally {
        enVol.current--;
      }
    });
  }, [items, loaded, erreurChargement, essai]);

  // Réglages (délai de relance, affichage)
  useEffect(() => {
    if (!loaded || erreurChargement) return;
    const t = setTimeout(() => {
      fetch(`${API}/reglages`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ delai, vue, depart }) }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [delai, vue, depart, loaded, erreurChargement]);

  // Au retour sur l’onglet : récupérer les changements faits depuis un autre appareil
  useEffect(() => {
    if (!loaded || erreurChargement) return;
    const recharger = async () => {
      if (document.visibilityState === "hidden" || enVol.current > 0) return;
      try {
        const r = await fetch(`${API}/candidatures`);
        if (!r.ok) return;
        const liste = lireListe(await r.json());
        const locales = itemsRef.current;
        const enAttenteEnvoi =
          enVol.current > 0 ||
          locales.length !== sauvegardees.current.size ||
          locales.some((c) => sauvegardees.current.get(c.id) !== JSON.stringify(c));
        if (enAttenteEnvoi) return;
        if (JSON.stringify(liste) !== JSON.stringify(locales)) appliquerServeur(liste);
      } catch {}
    };
    window.addEventListener("focus", recharger);
    document.addEventListener("visibilitychange", recharger);
    return () => {
      window.removeEventListener("focus", recharger);
      document.removeEventListener("visibilitychange", recharger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, erreurChargement]);

  // Passage automatique « Postulé » → « Je relance » après `delai` jours sans nouvelle
  const appliquerRelances = useCallback(() => {
    setItems((prev) => {
      let change = false;
      const suite = prev.map((c) => {
        if (c.etape === "Postulé" && !estCloturee(c) && c.dateCandidature && joursDepuis(c.dateCandidature) >= delai) {
          change = true;
          return { ...c, etape: "Je relance" as Etape };
        }
        return c;
      });
      return change ? suite : prev;
    });
  }, [delai]);

  useEffect(() => {
    if (!loaded) return;
    appliquerRelances();
    const h = () => document.visibilityState !== "hidden" && appliquerRelances();
    window.addEventListener("focus", h);
    document.addEventListener("visibilitychange", h);
    return () => {
      window.removeEventListener("focus", h);
      document.removeEventListener("visibilitychange", h);
    };
  }, [loaded, items, appliquerRelances]);

  // Raccourci clavier : N = nouvelle candidature
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setEdition(vide());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const stats = useMemo(() => {
    const attente = items.filter((i) => i.resultat === "En attente");
    return {
      aPostuler: attente.filter((i) => i.etape === "Je dois postuler").length,
      enCours: attente.filter((i) => i.etape !== "Je dois postuler").length,
      entretiens: attente.filter((i) => i.etape === "Entretien").length,
      relances: attente.filter((i) => i.etape === "Je relance").length,
    };
  }, [items]);

  const compteStatut = useMemo(
    () => ({
      tous: items.length,
      "en-cours": items.filter((c) => correspond(c, "en-cours")).length,
      acceptees: items.filter((c) => correspond(c, "acceptees")).length,
      refusees: items.filter((c) => correspond(c, "refusees")).length,
    }),
    [items]
  );

  const base = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return items
      .filter((c) => correspond(c, statut))
      .filter((c) => !q || [c.titre, c.entreprise, c.localisation, c.nomRecruteur, c.activiteEntreprise, c.adresse].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.dateCandidature.localeCompare(a.dateCandidature));
  }, [items, statut, recherche]);

  const liste = useMemo(
    () => base.filter((c) => filtreEtape === "Toutes" || c.etape === filtreEtape),
    [base, filtreEtape]
  );

  // Une candidature clôturée (accepté / refusé) n’est jamais modifiée
  const maj = (id: string, patch: Partial<Candidature>) =>
    setItems((prev) => prev.map((i) => (i.id === id && !estCloturee(i) ? coherent({ ...i, ...patch }) : i)));

  const etapeVers = (c: Candidature, cible: Etape) => {
    if (cible === c.etape) return;
    if (demandeDate(c, cible) || demandeEntretien(c, cible)) {
      return setADater({ c, cible });
    }
    if (
      cible === "Je dois postuler" &&
      !confirm("Revenir à « Je dois postuler » efface la date de candidature et l’historique des relances. Continuer ?")
    )
      return;
    maj(c.id, transition(c, cible, ""));
  };

  const marquer = (c: Candidature, r: Resultat) => {
    if (r === "En attente") return;
    // Refus : on demande la date (et le motif) dans une fenêtre
    if (r === "Refusé") return setARefuser(c);
    if (!confirm(`Marquer cette candidature comme ${r.toLowerCase()} ? Elle ne pourra plus être modifiée.`)) return;
    maj(c.id, { resultat: r });
  };

  const enregistrer = (c: Candidature) => {
    setItems((prev) => {
      const existante = prev.find((i) => i.id === c.id);
      if (!existante) return [coherent(c), ...prev];
      if (estCloturee(existante)) {
        // Seule exception : la date et le motif d’un refus restent modifiables
        if (existante.resultat === "Refusé" && c.resultat === "Refusé") {
          return prev.map((i) => (i.id === c.id ? { ...i, dateRefus: c.dateRefus, motifRefus: c.motifRefus } : i));
        }
        return prev;
      }
      return prev.map((i) => (i.id === c.id ? coherent(c) : i));
    });
    setEdition(null);
  };

  const supprimer = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setEdition(null);
  };

  const exporter = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidatures-${aujourdhui()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importer = async (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      const data = JSON.parse(await fichier.text());
      const valides = (Array.isArray(data) ? data : []).map(nettoyer).filter((c): c is Candidature => c !== null);
      if (!valides.length) return alert("Aucune candidature valide dans ce fichier.");
      setItems((prev) => {
        const verrouillees = new Set(prev.filter(estCloturee).map((c) => c.id));
        const entrantes = valides.filter((c) => !verrouillees.has(c.id));
        const ids = new Set(entrantes.map((c) => c.id));
        return [...entrantes, ...prev.filter((c) => !ids.has(c.id))];
      });
      alert(`${valides.length} candidature(s) importée(s).`);
    } catch {
      alert("Fichier illisible : choisissez un export JSON de cette application.");
    }
  };

  // Fenêtre de date : d’abord la date de candidature / relance, puis (si besoin) date et heure d’entretien
  const attendDate = !!aDater && aDater.date === undefined && demandeDate(aDater.c, aDater.cible);
  const modeDialogue: ModeDate = attendDate
    ? aDater?.c.etape === "Je relance"
      ? "relance"
      : "candidature"
    : "entretien";

  const valider = (valeur: string) => {
    if (!aDater) return;
    const { c, cible } = aDater;
    if (modeDialogue !== "entretien") {
      if (demandeEntretien(c, cible)) return setADater({ ...aDater, date: valeur });
      maj(c.id, transition(c, cible, valeur));
    } else {
      maj(c.id, { ...transition(c, cible, aDater.date ?? ""), dateEntretien: valeur });
    }
    setADater(null);
  };

  const nouvelle = (etape?: Etape) => setEdition(vide(etape));

  if (!loaded) return <main className="conteneur" />;

  return (
    <main className="conteneur">
      <header className="entete">
        <div className="marque">
          <Logo size={46} />
          <div>
            <h1 className="titre-marque">Jalon</h1>
            <p>Suivi de candidatures</p>
          </div>
        </div>
        <div className="entete-actions">
          <button type="button" className="lien-discret" onClick={exporter} disabled={!items.length}>
            Exporter
          </button>
          <button type="button" className="lien-discret" onClick={() => fichierRef.current?.click()}>
            Importer
          </button>
          <input ref={fichierRef} type="file" accept="application/json,.json" hidden onChange={importer} />
          <button type="button" className="btn-marque btn-desktop" onClick={() => nouvelle()} title="Raccourci : N">
            + Nouvelle candidature
          </button>
        </div>
      </header>

      <Onglets />

      {erreurChargement && (
        <div className="alerte-erreur" role="alert">
          Impossible de joindre la base de données : rien n’est enregistré.
          <button type="button" className="btn-clair" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      )}
      {erreurSauvegarde && !erreurChargement && (
        <div className="alerte-erreur" role="alert">
          Les dernières modifications n’ont pas pu être enregistrées.
          <button type="button" className="btn-clair" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <section className="vide">
          <Logo size={76} />
          <h2 className="titre-marque">Posez votre premier jalon</h2>
          <p>Ajoutez une candidature pour suivre son avancement, de « Je dois postuler » jusqu’à la réponse finale.</p>
          <button type="button" className="btn-marque" onClick={() => nouvelle()}>
            + Ajouter une candidature
          </button>
        </section>
      ) : (
        <>
          <section className="stats" aria-label="Résumé">
            <div className="stat"><b>{stats.aPostuler}</b><span>À postuler</span></div>
            <div className="stat"><b>{stats.enCours}</b><span>En cours</span></div>
            <div className="stat"><b>{stats.entretiens}</b><span>Entretiens</span></div>
            <div className={`stat ${stats.relances ? "alerte" : ""}`}>
              <b>{stats.relances}</b>
              <span>En relance</span>
            </div>
          </section>

          <div className="barre">
            <div className="recherche">
              <input
                type="search"
                className="form-control"
                placeholder="Rechercher un poste, une entreprise, une ville"
                aria-label="Rechercher"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            <div className="segment" role="group" aria-label="Résultat">
              {(
                [
                  ["tous", "Toutes"],
                  ["en-cours", "En cours"],
                  ["acceptees", "Acceptées"],
                  ["refusees", "Refusées"],
                ] as [Statut, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={statut === k} onClick={() => setStatut(k)}>
                  {label} {compteStatut[k]}
                </button>
              ))}
            </div>
            <div className="segment" role="group" aria-label="Affichage">
              <button type="button" aria-pressed={vue === "colonnes"} onClick={() => setVue("colonnes")}>
                Colonnes
              </button>
              <button type="button" aria-pressed={vue === "liste"} onClick={() => setVue("liste")}>
                Liste
              </button>
            </div>
            <div className="depart">
              <label htmlFor="reg-depart">Départ des itinéraires</label>
              <ChampSuggestions
                id="reg-depart"
                endpoint="/adresses"
                minCaracteres={3}
                placeholder="Position actuelle si vide"
                value={depart}
                onChange={setDepart}
                onChoisir={(s) => setDepart([s.rue, s.ville].filter((x) => typeof x === "string" && x).join(", "))}
              />
            </div>
            <label className="reglage">
              Relance auto après
              <input
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                className="form-control form-control-sm"
                aria-label="Nombre de jours avant relance"
                value={delaiTexte}
                onChange={(e) => {
                  setDelaiTexte(e.target.value);
                  const n = parseInt(e.target.value, 10);
                  if (n >= 1 && n <= 365) setDelai(n);
                }}
                onBlur={() => setDelaiTexte(String(delai))}
              />
              jours
            </label>
          </div>

          {vue === "colonnes" ? (
            <div className="colonnes">
              {ETAPES.map((e) => {
                const col = base.filter((c) => c.etape === e);
                // Entretiens : les plus proches en premier
                if (e === "Entretien") col.sort((a, b) => (a.dateEntretien || "9").localeCompare(b.dateEntretien || "9"));
                return (
                  <section className="colonne" key={e} aria-label={e}>
                    <div className="colonne-tete">
                      <span className="pastille" style={{ background: ETAPE_COULEUR[e] }} />
                      {e}
                      <span className="compte">{col.length}</span>
                      <button
                        type="button"
                        className="mini icone"
                        aria-label={`Ajouter une candidature à l’étape ${e}`}
                        onClick={() => nouvelle(e)}
                      >
                        +
                      </button>
                    </div>
                    {col.length === 0 && <p className="colonne-vide">Aucune candidature</p>}
                    {col.map((c) => (
                      <CandidatureCard
                        key={c.id}
                        c={c}
                        depart={depart}
                        onOpen={(x) => setEdition(x)}
                        onEtape={etapeVers}
                        onResultat={marquer}
                      />
                    ))}
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              <div className="chips" role="group" aria-label="Filtrer par étape">
                <button type="button" aria-pressed={filtreEtape === "Toutes"} onClick={() => setFiltreEtape("Toutes")}>
                  Toutes les étapes
                </button>
                {ETAPES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={filtreEtape === e}
                    style={{ "--couleur": ETAPE_COULEUR[e] } as CSSProperties}
                    onClick={() => setFiltreEtape(e)}
                  >
                    {e} ({base.filter((c) => c.etape === e).length})
                  </button>
                ))}
              </div>
              <div className="panneau">
                <div className="table-responsive">
                  <table className="table tableau align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Candidature</th>
                        <th className="d-none d-md-table-cell">Lieu</th>
                        <th className="d-none d-md-table-cell">Contrat</th>
                        <th>Date</th>
                        <th>Étape</th>
                        <th>Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liste.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-4">
                            Aucune candidature ne correspond.
                          </td>
                        </tr>
                      )}
                      {liste.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <button type="button" className="lien-titre" onClick={() => setEdition(c)}>
                              {c.titre}
                            </button>
                            <div className="carte-sous">
                              {c.entreprise}
                              {c.anciennesDates.length > 0 && (
                                <span className="puce relance ms-2">
                                  {c.anciennesDates.length} relance{c.anciennesDates.length > 1 ? "s" : ""}
                                </span>
                              )}
                              {c.spontanee && <span className="puce spont ms-2">Spontanée</span>}
                              {c.dateRefus && <span className="puce ko ms-2">Refusé le {formatDate(c.dateRefus)}</span>}
                              {c.dateEntretien && (
                                <span className="puce ms-2" style={{ background: "#ede9fe", color: "#5b21b6" }}>
                                  Entretien {formatDateHeure(c.dateEntretien)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="d-none d-md-table-cell">{c.localisation}</td>
                          <td className="d-none d-md-table-cell">{c.typeContrat}</td>
                          <td className="text-nowrap">{c.dateCandidature ? libelleDate(c.dateCandidature) : "—"}</td>
                          <td>
                            <select
                              className="form-select form-select-sm sel-etape"
                              style={{ color: ETAPE_COULEUR[c.etape] }}
                              aria-label={`Étape de ${c.titre}`}
                              value={c.etape}
                              disabled={estCloturee(c)}
                              onChange={(e) => etapeVers(c, e.target.value as Etape)}
                            >
                              {ETAPES.map((e) => (
                                <option key={e}>{e}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {peutAvoirResultat(c.etape) ? (
                              <select
                                className={`form-select form-select-sm sel-resultat ${
                                  c.resultat === "Accepté" ? "ok" : c.resultat === "Refusé" ? "ko" : "attente"
                                }`}
                                aria-label={`Résultat de ${c.titre}`}
                                value={c.resultat}
                                disabled={estCloturee(c)}
                                onChange={(e) => marquer(c, e.target.value as Resultat)}
                              >
                                {RESULTATS.map((r) => (
                                  <option key={r}>{r}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <button type="button" className="fab" aria-label="Nouvelle candidature" onClick={() => nouvelle()}>
        +
      </button>

      {aDater && (
        <DateDialog
          key={`${aDater.c.id}-${modeDialogue}`}
          titre={aDater.c.titre}
          cible={aDater.cible}
          mode={modeDialogue}
          ancienneDate={formatDate(aDater.c.dateCandidature)}
          onClose={() => setADater(null)}
          onValider={valider}
        />
      )}

      {aRefuser && (
        <DateDialog
          key={`${aRefuser.id}-refus`}
          titre={aRefuser.titre}
          cible={aRefuser.etape}
          mode="refus"
          ancienneDate=""
          onClose={() => setARefuser(null)}
          onValider={(date, motif) => {
            maj(aRefuser.id, { resultat: "Refusé", dateRefus: date, motifRefus: motif ?? "" });
            setARefuser(null);
          }}
        />
      )}

      {edition && (
        <CandidatureDialog
          key={edition.id}
          initial={edition}
          depart={depart}
          existe={items.some((i) => i.id === edition.id)}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
          onDelete={supprimer}
        />
      )}
    </main>
  );
}
