type Props = { size?: number };

// Deux personnes de part et d’autre d’une table ronde : l’entretien
function Personne() {
  return (
    <>
      <circle cx="13" cy="24.5" r="5.6" />
      <path d="M6 49 V43.5 C6 37.5 9.2 34 13 34 C16.8 34 20 37.5 20 43.5 V49 Z" />
    </>
  );
}

export default function Logo({ size = 44 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Jalon">
      <rect width="64" height="64" rx="9" fill="#1d4ed8" />
      <g transform="translate(32 32) scale(.96) translate(-32 -35)" fill="#f3f7ff">
        <Personne />
        <g transform="translate(64 0) scale(-1 1)">
          <Personne />
        </g>
        <ellipse cx="32" cy="38.5" rx="10" ry="3.4" />
        <rect x="31" y="40.5" width="2" height="8.5" />
        <ellipse cx="32" cy="49.8" rx="5.5" ry="1.8" />
      </g>
    </svg>
  );
}
