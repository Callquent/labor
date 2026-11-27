type Props = { size?: number };

export default function Logo({ size = 44 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Recherche d'emploi">
      <rect width="64" height="64" rx="9" fill="#1d4ed8" />
      <g fill="#f3f7ff"><path d="M24 22 V18.5 C24 16.6 25.4 15.5 27 15.5 H37 C38.6 15.5 40 16.6 40 18.5 V22" fill="none" stroke="#f3f7ff" strokeWidth="3.5" strokeLinejoin="round"/><rect x="10" y="22" width="44" height="30" rx="5"/><circle cx="41" cy="39" r="9" fill="#1d4ed8" stroke="#1d4ed8" strokeWidth="7"/><path d="M47.5 45.5 L55 53" stroke="#1d4ed8" strokeWidth="9" strokeLinecap="round"/><circle cx="41" cy="39" r="9" fill="none" stroke="#f3f7ff" strokeWidth="3.5"/><path d="M47.5 45.5 L54 52" stroke="#f3f7ff" strokeWidth="4" strokeLinecap="round"/></g>
    </svg>
  );
}
