import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export type Suggestion = { label: string; detail?: string; [champ: string]: unknown };

type Props = {
  id: string;
  value: string;
  onChange: (valeur: string) => void;
  endpoint: string; // ex. "/villes" (appelé sur /api, avec le préfixe du hub)
  params?: Record<string, string>; // paramètres supplémentaires envoyés avec q
  minCaracteres?: number;
  onChoisir?: (s: Suggestion) => void; // appelé après le choix d’une suggestion
  placeholder?: string;
};

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api`;

// Champ texte avec liste de suggestions venant du serveur. La saisie libre reste toujours possible.
export default function ChampSuggestions({
  id,
  value,
  onChange,
  endpoint,
  params,
  minCaracteres = 2,
  onChoisir,
  placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const saisie = useRef(false); // vrai seulement quand la valeur vient du clavier
  const listeId = useId();
  const cleParams = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!saisie.current) return;
    const q = value.trim();
    if (q.length < minCaracteres) {
      setSuggestions([]);
      setOuvert(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const requete = new URLSearchParams({ q });
        for (const [k, v] of Object.entries(JSON.parse(cleParams) as Record<string, string>)) {
          if (v) requete.set(k, v);
        }
        const r = await fetch(`${API}${endpoint}?${requete}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const liste = (await r.json()) as Suggestion[];
        setSuggestions(liste);
        setActif(-1);
        setOuvert(liste.length > 0);
      } catch {}
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, endpoint, cleParams, minCaracteres]);

  const choisir = (s: Suggestion) => {
    saisie.current = false;
    onChange(s.label);
    onChoisir?.(s);
    setOuvert(false);
    setSuggestions([]);
  };

  const touche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggestions.length) return;
      e.preventDefault();
      setOuvert(true);
      const n = suggestions.length;
      setActif((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === "Enter" && ouvert && actif >= 0) {
      e.preventDefault(); // ne pas envoyer le formulaire
      choisir(suggestions[actif]);
    } else if (e.key === "Escape" && ouvert) {
      e.preventDefault(); // ferme la liste sans fermer la fenêtre
      e.stopPropagation();
      setOuvert(false);
    }
  };

  return (
    <div className="ville">
      <input
        id={id}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && actif >= 0 ? `${listeId}-${actif}` : undefined}
        autoComplete="off"
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          saisie.current = true;
          onChange(e.target.value);
        }}
        onKeyDown={touche}
        onBlur={() => setOuvert(false)}
        onFocus={() => suggestions.length > 0 && saisie.current && setOuvert(true)}
      />
      {ouvert && (
        <ul id={listeId} role="listbox" className="suggestions">
          {suggestions.map((s, i) => (
            <li
              key={`${s.label}-${s.detail ?? ""}-${i}`}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseDown={(e) => {
                e.preventDefault(); // garde le focus dans le champ
                choisir(s);
              }}
              onMouseEnter={() => setActif(i)}
            >
              <span>{s.label}</span>
              {s.detail && <small>{s.detail}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
