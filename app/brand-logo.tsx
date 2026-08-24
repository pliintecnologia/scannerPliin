import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ href = "/app", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link className={`brandLogo${compact ? " brandLogoCompact" : ""}`} href={href} aria-label="Scanner Pliin">
      <Image className="brandSignature" src="/marca/logo-assinatura.png" width={790} height={316} alt="Scanner Pliin" priority unoptimized />
    </Link>
  );
}
