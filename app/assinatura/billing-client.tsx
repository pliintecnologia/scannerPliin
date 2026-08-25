"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { EffectiveAccess } from "../../lib/billing";
import type { BillingType } from "../../lib/plans";
import type { MonthlyAuditUsage } from "../../lib/usage";

type Charge = { id: string; status: string; value: number; dueDate: string; billingType: string; invoiceUrl?: string | null; bankSlipUrl?: string | null };
type CouponPreview = { code: string; name: string | null; endsAt: string; alreadyRedeemed: boolean };
type BillingSection = "coupon" | "payment" | null;
type PendingCharge = { billingType: string; dueDate: string; value: number };
type ChargesStatus = "loading" | "empty" | "pending" | "ready" | "error";

const paymentCopy: Record<BillingType, { title: string; description: string }> = {
  PIX: { title: "PIX", description: "Gere a cobrança e pague pelo aplicativo do seu banco." },
  BOLETO: { title: "Boleto", description: "Gere um boleto com vencimento para concluir o pagamento." },
  CREDIT_CARD: { title: "Cartão", description: "Use o cartão para a cobrança mensal recorrente." }
};

function accessLabel(access: EffectiveAccess) {
  if (access.source === "paid" && access.status === "overdue_grace") return "Pagamento em atraso — tolerância ativa";
  if (access.source === "paid") return "Assinatura ativa";
  if (access.source === "coupon") return "Acesso gratuito por cupom";
  if (access.source === "legacy") return "Acesso legado permanente";
  return "Assinatura necessária";
}

export function BillingClient({ initialAccess, initialUsage, canManage, user }: { initialAccess: EffectiveAccess; initialUsage: MonthlyAuditUsage; canManage: boolean; user: { name: string; email: string } }) {
  const [access, setAccess] = useState(initialAccess);
  const [usage, setUsage] = useState(initialUsage);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [openSection, setOpenSection] = useState<BillingSection>(null);
  const [coupon, setCoupon] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [pendingCharge, setPendingCharge] = useState<PendingCharge | null>(null);
  const [chargesStatus, setChargesStatus] = useState<ChargesStatus>("loading");
  const [chargesError, setChargesError] = useState("");

  async function refresh() {
    try {
      const [accessResponse, chargesResponse] = await Promise.all([fetch("/api/billing/access", { cache: "no-store" }), fetch("/api/billing/charges", { cache: "no-store" })]);
      if (accessResponse.ok) {
        const data = (await accessResponse.json()) as { access: EffectiveAccess; usage: MonthlyAuditUsage };
        setAccess(data.access); setUsage(data.usage);
      }
      const chargeData = await chargesResponse.json().catch(() => ({})) as { charges?: Charge[]; pending?: PendingCharge | null; error?: string };
      if (!chargesResponse.ok) throw new Error(chargeData.error || "Não foi possível consultar as cobranças no Asaas.");
      const nextCharges = chargeData.charges ?? [];
      setCharges(nextCharges);
      setPendingCharge(chargeData.pending ?? null);
      setChargesStatus(nextCharges.length ? "ready" : chargeData.pending ? "pending" : "empty");
      setChargesError("");
      return nextCharges;
    } catch (reason) {
      setChargesStatus("error");
      setChargesError(reason instanceof Error ? reason.message : "Não foi possível consultar as cobranças no Asaas.");
      return [];
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function validateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/billing/coupons/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon }) });
      const data = await response.json() as { valid?: boolean; message?: string; code?: string; name?: string | null; endsAt?: string; alreadyRedeemed?: boolean };
      if (!response.ok || !data.valid) throw new Error(data.message || "Cupom inválido.");
      setCouponPreview({ code: data.code!, name: data.name ?? null, endsAt: data.endsAt!, alreadyRedeemed: Boolean(data.alreadyRedeemed) });
    } catch (reason) { setCouponPreview(null); setError(reason instanceof Error ? reason.message : "Não foi possível validar o cupom."); }
    finally { setBusy(false); }
  }

  async function applyCoupon() {
    if (!couponPreview) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/billing/coupons/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon }) });
      const data = await response.json() as { error?: string; access?: EffectiveAccess };
      if (!response.ok) throw new Error(data.error || "Não foi possível aplicar o cupom.");
      if (data.access) setAccess(data.access);
      setCouponPreview(null); setCoupon(""); setMessage("Cupom ativado. Seu acesso já está disponível e nenhuma cobrança foi criada.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível ativar o cupom."); }
    finally { setBusy(false); }
  }

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const payload: Record<string, unknown> = { billingType, customer: { name: values.name, email: values.email, cpfCnpj: values.cpfCnpj, phone: values.phone } };
    if (billingType === "CREDIT_CARD") {
      payload.creditCard = { holderName: values.holderName, number: values.number, expiryMonth: values.expiryMonth, expiryYear: values.expiryYear, ccv: values.ccv };
      payload.creditCardHolderInfo = { name: values.name, email: values.email, cpfCnpj: values.cpfCnpj, phone: values.phone, postalCode: values.postalCode, addressNumber: values.addressNumber };
    }
    try {
      const response = await fetch("/api/billing/subscriptions", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a assinatura.");
      setChargesStatus("pending");
      setPendingCharge({ billingType, dueDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), value: 50 });
      setMessage("Assinatura criada. Aguarde enquanto o Asaas gera a primeira cobrança...");
      let generatedCharges: Charge[] = [];
      for (let attempt = 0; attempt < 6 && generatedCharges.length === 0; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 1500));
        generatedCharges = await refresh();
      }
      setMessage(generatedCharges.length
        ? billingType === "CREDIT_CARD" ? "Assinatura criada. A cobrança será confirmada pelo Asaas." : "Cobrança pronta. Use o link abaixo para pagar."
        : "Assinatura criada. O Asaas ainda está gerando a cobrança; atualize a lista em alguns instantes.");
      form.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao assinar."); }
    finally {
      delete payload.creditCard;
      delete payload.creditCardHolderInfo;
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Cancelar a assinatura recorrente?")) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/billing/subscriptions/cancel", { method: "POST" });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error || "Falha ao cancelar."); else { setMessage("Assinatura cancelada."); await refresh(); }
    setBusy(false);
  }

  return <section className="billingGrid">
    <article className="billingCard statusCard"><h2>Seu acesso</h2><strong>{accessLabel(access)}</strong>{access.expiresAt ? <p>Válido até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(access.expiresAt))}.</p> : null}{access.allowed ? <Link className="primaryLink" href="/app">Ir para consultas</Link> : null}</article>
    <article className="billingCard usageCard">
      <div className="usageHead"><div><span>Uso mensal</span><strong>{usage.remaining}</strong><small>pesquisas disponíveis</small></div><b>{usage.used} de {usage.limit}</b></div>
      <div className="usageTrack" role="progressbar" aria-label="Pesquisas usadas no mês" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.used}><i style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }} /></div>
      <p>O saldo é renovado automaticamente no início de cada mês.</p>
    </article>
    {!canManage ? <article className="billingCard"><h2>Gerenciamento</h2><p>Somente administradores podem contratar, cancelar ou aplicar cupons.</p></article> : <article className="billingCard checkoutCard">
      <div className="planSummary"><div><span>Premium</span><h1>R$ 50 <small>/mês</small></h1></div><p>100 pesquisas por mês para toda a sua conta.</p></div>
      <div className="billingChoices">
        <section className={openSection === "coupon" ? "billingChoice open" : "billingChoice"}>
          <button type="button" className="billingChoiceTrigger" aria-expanded={openSection === "coupon"} aria-controls="coupon-content" onClick={() => setOpenSection(openSection === "coupon" ? null : "coupon")}><span><strong>Tenho um cupom</strong><small>Ative o acesso sem cadastrar pagamento.</small></span><b aria-hidden="true">{openSection === "coupon" ? "−" : "+"}</b></button>
          <div id="coupon-content" className="billingChoiceContent" hidden={openSection !== "coupon"}>
            <form className="couponForm" onSubmit={validateCoupon}><label htmlFor="coupon-code">Código do cupom</label><div className="couponRow"><input id="coupon-code" value={coupon} onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponPreview(null); setError(""); }} maxLength={64} placeholder="Ex.: CORTESIA-2026" autoComplete="off"/><button type="submit" disabled={busy || !coupon.trim()}>{busy ? "Validando..." : "Validar cupom"}</button></div></form>
            {couponPreview ? <div className="couponPreview" role="status"><div><span>Cupom validado</span><strong>{couponPreview.name || couponPreview.code}</strong></div><p>Acesso disponível até <strong>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(couponPreview.endsAt))}</strong>.</p><button type="button" onClick={applyCoupon} disabled={busy}>{busy ? "Ativando..." : "Ativar acesso"}</button></div> : null}
          </div>
        </section>
        <section className={openSection === "payment" ? "billingChoice open" : "billingChoice"}>
          <button type="button" className="billingChoiceTrigger" aria-expanded={openSection === "payment"} aria-controls="payment-content" onClick={() => setOpenSection(openSection === "payment" ? null : "payment")}><span><strong>Quero assinar</strong><small>Pague por PIX, boleto ou cartão.</small></span><b aria-hidden="true">{openSection === "payment" ? "−" : "+"}</b></button>
          <div id="payment-content" className="billingChoiceContent" hidden={openSection !== "payment"}>
            <h2>Como deseja pagar?</h2>
            <div className="billingMethods">{(["PIX", "BOLETO", "CREDIT_CARD"] as const).map((type) => <button type="button" className={billingType === type ? "selected" : "ghostButton"} onClick={() => setBillingType(type)} key={type}><strong>{paymentCopy[type].title}</strong><small>{paymentCopy[type].description}</small></button>)}</div>
            <div className="billingCustomerIntro"><strong>Dados do responsável pela cobrança</strong><p>Preencha os campos abaixo para identificar o titular e gerar o pagamento com segurança.</p></div>
            <form onSubmit={subscribe} autoComplete="off"><div className="billingFields"><label>Nome do titular<input name="name" defaultValue={user.name} required/></label><label>E-mail<input name="email" type="email" defaultValue={user.email} required/></label><label>CPF ou CNPJ<input name="cpfCnpj" inputMode="numeric" required/></label><label>Telefone<input name="phone" inputMode="tel" required/></label></div>{billingType === "CREDIT_CARD" ? <div className="cardFields"><label>Nome no cartão<input name="holderName" required autoComplete="off"/></label><label>Número do cartão<input name="number" inputMode="numeric" required autoComplete="off"/></label><label>Mês<input name="expiryMonth" inputMode="numeric" required/></label><label>Ano<input name="expiryYear" inputMode="numeric" required/></label><label>CVV<input name="ccv" type="password" inputMode="numeric" required autoComplete="off"/></label><label>CEP<input name="postalCode" inputMode="numeric" required/></label><label>Número do endereço<input name="addressNumber" required/></label></div> : null}<button disabled={busy} type="submit">{busy ? "Aguarde..." : `Continuar com ${paymentCopy[billingType].title}`}</button></form>
            {billingType === "CREDIT_CARD" ? <small>Os dados do cartão são processados pelo Asaas e não ficam armazenados aqui.</small> : null}
          </div>
        </section>
      </div>
    </article>}
    {message ? <p className={message.includes("ainda está gerando") ? "billingNotice info" : "billingNotice success"} role="status">{message}</p> : null}{error ? <p className="billingNotice alert" role="alert">{error}</p> : null}
    <article className="billingCard chargesCard"><div className="panelHead"><h2>Cobranças</h2><div className="panelActions"><button className="ghostButton" type="button" onClick={() => void refresh()} disabled={busy || chargesStatus === "loading"}>{chargesStatus === "loading" ? "Atualizando..." : "Atualizar cobranças"}</button>{canManage && charges.length ? <button className="ghostButton" type="button" onClick={cancel} disabled={busy}>Cancelar assinatura</button> : null}</div></div>
      {chargesStatus === "error" ? <div className="chargeStateError" role="alert"><strong>Não foi possível carregar as cobranças</strong><p>{chargesError}</p><button type="button" onClick={() => void refresh()}>Tentar novamente</button></div> : null}
      {chargesStatus === "pending" && pendingCharge ? <div className="chargePreview" role="status"><span className="chargeSpinner" aria-hidden="true"/><div><small>Primeira cobrança</small><strong>{pendingCharge.dueDate}</strong></div><div><small>Valor</small><strong>R$ {Number(pendingCharge.value).toFixed(2).replace(".", ",")}</strong></div><div><small>Pagamento</small><strong>{paymentCopy[pendingCharge.billingType as BillingType]?.title || pendingCharge.billingType}</strong></div><span className="chargePendingBadge">Gerando no Asaas</span></div> : null}
      {chargesStatus === "empty" ? <p className="emptyCharges">Nenhuma cobrança criada.</p> : null}
      {chargesStatus === "ready" ? <div className="chargeList">{charges.map((charge) => <div key={charge.id}><span>{charge.dueDate}</span><strong>R$ {Number(charge.value).toFixed(2).replace(".", ",")}</strong><span>{charge.status}</span>{charge.invoiceUrl || charge.bankSlipUrl ? <a href={charge.invoiceUrl || charge.bankSlipUrl || "#"} target="_blank" rel="noreferrer">Abrir cobrança</a> : null}</div>)}</div> : null}
    </article>
  </section>;
}
