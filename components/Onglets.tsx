import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation entre les deux pages ; Link ajoute tout seul le préfixe du hub (/apps/<id>)
export default function Onglets() {
  const pathname = usePathname() ?? "/";
  const entreprises = pathname.startsWith("/entreprises");
  return (
    <nav className="onglets" aria-label="Pages">
      <Link href="/" aria-current={entreprises ? undefined : "page"}>
        Candidatures
      </Link>
      <Link href="/entreprises" aria-current={entreprises ? "page" : undefined}>
        Entreprises
      </Link>
    </nav>
  );
}
