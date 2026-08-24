import AuditWorkspace from "../audit-workspace";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth";
import { getEffectiveAccess } from "../../../lib/billing";

export default async function NovaConsultaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/app/login");
  if (!(await getEffectiveAccess(user.tenantId)).allowed) redirect("/assinatura");
  return <AuditWorkspace />;
}
