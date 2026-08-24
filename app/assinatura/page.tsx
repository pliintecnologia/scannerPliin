import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { getEffectiveAccess } from "../../lib/billing";
import { BrandLogo } from "../brand-logo";
import { BillingClient } from "./billing-client";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/app/login");
  const access = await getEffectiveAccess(user.tenantId);
  return <main className="billingShell">
    <header className="appHeader">
      <BrandLogo />
      <nav aria-label="Navegação principal"><Link href="/app">Consultas</Link><form action="/api/auth/logout" method="post"><button type="submit" className="ghostButton">Sair</button></form></nav>
    </header>
    <BillingClient initialAccess={access} canManage={user.role === "owner" || user.role === "admin"} user={{ name: user.name, email: user.email }} />
  </main>;
}
