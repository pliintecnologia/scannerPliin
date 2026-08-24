"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { EffectiveAccess } from "../../lib/billing";
import type { BillingType } from "../../lib/plans";

type Charge = { id: string; status: string; value: number; dueDate: string; billingType: string; invoiceUrl?: string | null; bankSlipUrl?: string | null };

function accessLabel(access: EffectiveAccess) {
  if (access.source === "paid" && access.status === "overdue_grace") return "Pagamento em atraso — tolerância ativa";
  if (access.source === "paid") return "Assinatura ativa";
  if (access.source === "coupon") return "Acesso gratuito por cupom";
  if (access.source === "legacy") return "Acesso legado permanente";
  return "Assinatura necessária";
}

export function BillingClient({ initialAccess, canManage, user }: { initialAccess: EffectiveAccess; canManage: boolean; user: { name: string; email: string } }) {
  const [access, setAccess] = useState(initialAccess);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [coupon, setCoupon] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState<Charge[]>([]);

  async function refresh() {
    const [accessResponse, chargesResponse] = await Promise.all([
      fetch("/api/billing/access", { cache: "no-store" }),
      fetch("/api/billing/charges", { cache: "no-store" })
    ]);
    if (accessResponse.ok) {
      const data = await accessResponse.json() as { access: EffectiveAccess };
      setAccess(data.access);
    }
    if (chargesResponse.ok) {
      const data = await chargesResponse.json() as { charges?: Charge[] };
      setCharges(data.charges ?? []);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function applyCoupon() {
    setBusy(true); setError(""); setMessage("");
    try {
      const preview = await fetch("/api/billing/coupons/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon }) });
      const previewData = await preview.json() as { valid?: boolean; message?: string };
      if (!preview.ok || !previewData.valid) throw new Error(previewData.message || "Cupom inválido.");
      const response = await fetch("/api/billing/coupons/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon }) });
      const data = await response.json() as { error?: string; access?: EffectiveAccess };
      if (!response.ok) throw new Error(data.error || "Não foi possível aplicar o cupom.");
      if (data.access) setAccess(data.access);
      setMessage("Cupom aplicado. Nenhuma cobrança foi criada.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao aplicar cupom."); }
    finally { setBusy(false); }
  }

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const customer = { name: values.name, email: values.email, cpfCnpj: values.cpfCnpj, phone: values.phone };
    const payload: Record<string, unknown> = { billingType, customer };
    if (billingType === "CREDIT_CARD") {
      payload.creditCard = { holderName: values.holderName, number: values.number, expiryMonth: values.expiryMonth, expiryYear: values.expiryYear, ccv: values.ccv };
      payload.creditCardHolderInfo = { name: values.name, email: values.email, cpfCnpj: values.cpfCnpj, phone: values.phone, postalCode: values.postalCode, addressNumber: values.addressNumber };
    }
    try {
      const key = crypto.randomUUID();
      const response = await fetch("/api/billing/subscriptions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a assinatura.");
      setMessage(billingType === "CREDIT_CARD" ? "Assinatura criada. O acesso será liberado após a confirmação do pagamento." : "Cobrança criada. Abra a cobrança abaixo para pagar; o acesso será liberado após a confirmação.");
      await refresh();
      event.currentTarget.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao assinar."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!window.confirm("Cancelar a assinatura recorrente?")) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/billing/subscriptions/cancel", { method: "POST" });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error || "Falha ao cancelar.");
    else { setMessage("Assinatura cancelada."); await refresh(); }
    setBusy(false);
  }

  return <>
    <section className="billingHero">
      <div><p className="eyebrow">Plano Scanner Pliin</p><h1>Premium</h1><p>Auditorias completas para toda a sua conta.</p></div>
      <div className="billingPrice"><strong>R$ 50</strong><span>/mês</span></div>
    </section>
    <section className="billingGrid">
      <article className="billingCard statusCard"><h2>Seu acesso</h2><strong>{accessLabel(access)}</strong>{access.expiresAt ? <p>Válido até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(access.expiresAt))}.</p> : null}{access.allowed ? <Link className="primaryLink" href="/app">Ir para consultas</Link> : null}</article>
      {!canManage ? <article className="billingCard"><h2>Gerenciamento</h2><p>Somente owner ou admin podem contratar, cancelar ou aplicar cupons.</p></article> : <>
        <article className="billingCard"><h2>Cupom de acesso</h2><p>Um cupom vigente libera o Premium sem criar cobrança.</p><div className="couponRow"><input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={64} placeholder="CÓDIGO"/><button type="button" onClick={applyCoupon} disabled={busy || !coupon.trim()}>Aplicar</button></div></article>
        <article className="billingCard checkoutCard"><h2>Assinar Premium</h2><div className="billingMethods">{(["PIX", "BOLETO", "CREDIT_CARD"] as const).map((type) => <button type="button" className={billingType === type ? "selected" : "ghostButton"} onClick={() => setBillingType(type)} key={type}>{type === "CREDIT_CARD" ? "Cartão" : type === "BOLETO" ? "Boleto" : "PIX"}</button>)}</div>
          <form onSubmit={subscribe} autoComplete="off"><div className="billingFields"><label>Nome do titular<input name="name" defaultValue={user.name} required/></label><label>E-mail<input name="email" type="email" defaultValue={user.email} required/></label><label>CPF ou CNPJ<input name="cpfCnpj" inputMode="numeric" required/></label><label>Telefone<input name="phone" inputMode="tel" required/></label></div>
          {billingType === "CREDIT_CARD" ? <div className="cardFields"><label>Nome no cartão<input name="holderName" required autoComplete="off"/></label><label>Número do cartão<input name="number" inputMode="numeric" required autoComplete="off"/></label><label>Mês<input name="expiryMonth" inputMode="numeric" required/></label><label>Ano<input name="expiryYear" inputMode="numeric" required/></label><label>CVV<input name="ccv" type="password" inputMode="numeric" required autoComplete="off"/></label><label>CEP<input name="postalCode" inputMode="numeric" required/></label><label>Número do endereço<input name="addressNumber" required/></label></div> : null}
          <button disabled={busy} type="submit">{busy ? "Aguarde..." : "Assinar por R$ 50/mês"}</button></form>
          <small>Dados de cartão são enviados diretamente ao Asaas e não são armazenados pelo Scanner Pliin.</small>
        </article>
      </>}
      {message ? <p className="billingNotice success" role="status">{message}</p> : null}{error ? <p className="billingNotice alert" role="alert">{error}</p> : null}
      <article className="billingCard chargesCard"><div className="panelHead"><h2>Cobranças</h2>{canManage && charges.length ? <button className="ghostButton" type="button" onClick={cancel} disabled={busy}>Cancelar assinatura</button> : null}</div>{charges.length ? <div className="chargeList">{charges.map((charge) => <div key={charge.id}><span>{charge.dueDate}</span><strong>R$ {Number(charge.value).toFixed(2).replace(".", ",")}</strong><span>{charge.status}</span>{charge.invoiceUrl || charge.bankSlipUrl ? <a href={charge.invoiceUrl || charge.bankSlipUrl || "#"} target="_blank" rel="noreferrer">Abrir cobrança</a> : null}</div>)}</div> : <p>Nenhuma cobrança disponível.</p>}</article>
    </section>
  </>;
}
