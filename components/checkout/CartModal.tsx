"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";
import { formatMoneyFromCents } from "@/lib/money";
import { AddressMap, type CheckoutAddress } from "./AddressMap";

export type CartLine = Product & { quantity: number; notes: string };

type Quote = {
  distanceMeters: number;
  durationSeconds: number;
  deliveryFeeCents: number;
  distanceLabel: string;
  durationLabel: string;
};

type Customer = {
  name: string;
  phone: string;
  email: string;
};

type CartModalProps = {
  open: boolean;
  items: CartLine[];
  mapsApiKey: string;
  mapsMapId: string;
  whatsappNumber: string;
  onClose: () => void;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onChangeNotes: (productId: string, notes: string) => void;
  onClear: () => void;
  onOrderCreated: () => void;
  notify: (message: string, kind?: "red" | "green") => void;
};

const EMPTY_ADDRESS: CheckoutAddress = {
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  complement: "",
  formattedAddress: "",
  latitude: null,
  longitude: null,
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function loadSavedCheckout<T extends "customer" | "address">(key: T) {
  const fallback = key === "customer"
    ? { name: "", phone: "", email: "" }
    : EMPTY_ADDRESS;
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem("maknas-checkout-v2") ?? "null") as {
      customer?: Customer;
      address?: CheckoutAddress;
    } | null;
    return saved?.[key] ?? fallback;
  } catch {
    return fallback;
  }
}

export function CartModal({
  open,
  items,
  mapsApiKey,
  mapsMapId,
  whatsappNumber,
  onClose,
  onChangeQuantity,
  onChangeNotes,
  onClear,
  onOrderCreated,
  notify,
}: CartModalProps) {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<Customer>(() => loadSavedCheckout("customer") as Customer);
  const [address, setAddress] = useState<CheckoutAddress>(() => loadSavedCheckout("address") as CheckoutAddress);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CARD" | "CASH">("PIX");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "error">("idle");
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [orderTotalCents, setOrderTotalCents] = useState(0);
  const [submittedItems, setSubmittedItems] = useState<CartLine[]>([]);

  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0),
    [items],
  );
  const totalCents = subtotalCents + (quote?.deliveryFeeCents ?? 0);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem("maknas-checkout-v2", JSON.stringify({ customer, address }));
    } catch {
      // Sem persistência local, os dados permanecem apenas nesta sessão.
    }
  }, [address, customer, open]);

  const updateAddress = useCallback((next: Partial<CheckoutAddress>) => {
    setAddress((current) => ({ ...current, ...next }));
    if (next.latitude === null || next.longitude === null) {
      setQuote(null);
      setQuoteError("");
      setQuoteState("idle");
    }
  }, []);

  useEffect(() => {
    if (address.latitude === null || address.longitude === null) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setQuoteState("loading");
      setQuoteError("");
      try {
        const response = await fetch("/api/delivery/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: address.latitude,
            longitude: address.longitude,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as Quote & { error?: string };
        if (!response.ok) throw new Error(data.error || "Não foi possível calcular a entrega.");
        setQuote(data);
        setQuoteState("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteState("error");
        setQuoteError(error instanceof Error ? error.message : "Não foi possível calcular a entrega.");
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [address.latitude, address.longitude]);

  useEffect(() => {
    if (
      !mapsApiKey ||
      !address.street.trim() ||
      !address.number.trim() ||
      !address.city.trim() ||
      address.state.trim().length !== 2
    ) return;

    const timeout = window.setTimeout(() => {
      setGeocodeQuery([
        address.street,
        address.number,
        address.district,
        address.city,
        address.state,
        "Brasil",
      ].filter(Boolean).join(", "));
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [
    address.city,
    address.district,
    address.number,
    address.state,
    address.street,
    mapsApiKey,
  ]);

  if (!open) return null;

  const validateDetails = () => {
    if (customer.name.trim().length < 2) return "Informe seu nome.";
    if (onlyDigits(customer.phone).length < 10) return "Informe um WhatsApp válido.";
    if (!address.street.trim() || !address.number.trim()) return "Informe rua e número.";
    if (!address.district.trim() || !address.city.trim() || address.state.length !== 2) {
      return "Complete bairro, cidade e UF.";
    }
    if (address.latitude === null || address.longitude === null) {
      return "Selecione ou confirme o endereço no mapa.";
    }
    if (!quote) return quoteError || "Aguarde o cálculo da entrega.";
    return "";
  };

  const goToReview = () => {
    const error = validateDetails();
    if (error) {
      notify(error);
      return;
    }
    setStep(3);
  };

  const whatsappUrl = (code = orderCode, finalTotal = orderTotalCents || totalCents) => {
    const messageItems = submittedItems.length > 0 ? submittedItems : items;
    const lines = messageItems.flatMap((item) => [
      `• ${item.quantity}x ${item.name} — ${formatMoneyFromCents(Math.round(item.price * 100) * item.quantity)}`,
      ...(item.notes.trim() ? [`  _Observação: ${item.notes.trim()}_`] : []),
    ]);
    const text = [
      `Olá! Fiz o pedido *${code || "pela loja online"}* na Makna's Burguer 🔥`,
      "",
      ...lines,
      "",
      `*Total:* ${formatMoneyFromCents(finalTotal)}`,
      `*Entrega:* ${address.street}, ${address.number} — ${address.district}`,
      `${address.city}-${address.state}`,
    ].join("\n");
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  };

  const submitOrder = async () => {
    const error = validateDetails();
    if (error) {
      notify(error);
      setStep(2);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: customer.name,
            phone: onlyDigits(customer.phone),
            email: customer.email,
          },
          address: {
            ...address,
            formattedAddress: address.formattedAddress || [
              address.street,
              address.number,
              address.district,
              address.city,
              address.state,
            ].filter(Boolean).join(", "),
          },
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            notes: item.notes.trim(),
          })),
          paymentMethod,
          changeForCents: paymentMethod === "CASH" && changeFor
            ? Math.round(Number(changeFor.replace(",", ".")) * 100)
            : null,
          notes,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        order?: { code: string; totalCents: number };
      };
      if (!response.ok || !data.order) throw new Error(data.error || "Não foi possível criar o pedido.");
      setOrderCode(data.order.code);
      setOrderTotalCents(data.order.totalCents);
      setSubmittedItems(items);
      setStep(4);
      onOrderCreated();
      notify(`Pedido ${data.order.code} recebido!`, "green");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Não foi possível criar o pedido.";
      setSubmitError(message);
      notify(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-full cart-modal-next" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div className="m-header">
        <div className="container">
          <Image className="logo-modal" src="/img/logo-maknas.png" width={90} height={90} alt="Makna's Burguer" />
          <button type="button" className="btn btn-white btn-sm float-right btn-fechar-carrinho" onClick={onClose}>
            Fechar <i className="fas fa-times" />
          </button>
          <div className="etapas" aria-label="Etapas do pedido">
            {[1, 2, 3].map((item) => (
              <div key={item} className={`etapa ${step >= item ? "active" : ""}`}>{item}</div>
            ))}
          </div>
          <div className="cart-title-row mt-4">
            <p className="title-carrinho mb-0" id="cart-title">
              <b>{step === 1 ? "Seu carrinho" : step === 2 ? "Entrega e pagamento" : step === 3 ? "Revise seu pedido" : "Pedido recebido"}</b>
            </p>
            {step === 1 && items.length > 0 && (
              <button type="button" className="btn-limpar-carrinho" onClick={onClear}>
                <i className="fas fa-trash" /> Limpar carrinho
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="m-body">
        <div className="container cart-step-content">
          {step === 1 && (
            <div className="cart-lines">
              {items.length === 0 ? (
                <p className="carrinho-vazio"><i className="fa fa-shopping-bag" /> Seu carrinho está vazio.</p>
              ) : items.map((item) => (
                <div className="item-carrinho" key={item.id}>
                  <div className="img-produto">
                    <Image src={item.img} width={100} height={82} alt={item.name} />
                  </div>
                  <div className="dados-produto">
                    <p className="title-produto"><b>{item.name}</b></p>
                    <p className="price-produto cart-price-detail">
                      <span>{formatMoneyFromCents(Math.round(item.price * 100))} cada</span>
                      <b>{formatMoneyFromCents(Math.round(item.price * 100) * item.quantity)}</b>
                    </p>
                    <label className="item-note-field">
                      <span><i className="fas fa-comment-alt" /> Observação deste item <small>opcional</small></span>
                      <textarea
                        className="form-control item-note-input"
                        rows={2}
                        maxLength={200}
                        placeholder="Ex.: sem alface, sem tomate, molho separado..."
                        value={item.notes}
                        onChange={(event) => onChangeNotes(item.id, event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="add-carrinho">
                    <button className="btn-menos" type="button" aria-label={`Diminuir ${item.name}`} onClick={() => onChangeQuantity(item.id, item.quantity - 1)}>
                      <i className="fas fa-minus" />
                    </button>
                    <span className="add-numero-itens">{item.quantity}</span>
                    <button className="btn-mais" type="button" aria-label={`Aumentar ${item.name}`} onClick={() => onChangeQuantity(item.id, item.quantity + 1)}>
                      <i className="fas fa-plus" />
                    </button>
                    <button className="btn btn-remove" type="button" aria-label={`Remover ${item.name}`} onClick={() => onChangeQuantity(item.id, 0)}>
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="checkout-grid">
              <div className="checkout-form-card">
                <p className="checkout-section-title"><span>1</span> Seus dados</p>
                <div className="form-grid cols-2">
                  <label className="field full">Nome
                    <input className="form-control" autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                  </label>
                  <label className="field">WhatsApp
                    <input className="form-control" inputMode="tel" autoComplete="tel" placeholder="(82) 99999-9999" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: formatPhone(event.target.value) })} />
                  </label>
                  <label className="field">E-mail <small>opcional</small>
                    <input className="form-control" type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
                  </label>
                </div>

                <p className="checkout-section-title"><span>2</span> Endereço</p>
                <div className="form-grid cols-6">
                  <label className="field span-4">Rua
                    <input className="form-control" autoComplete="address-line1" value={address.street} onChange={(event) => updateAddress({ street: event.target.value, latitude: null, longitude: null })} />
                  </label>
                  <label className="field span-2">Número
                    <input className="form-control" autoComplete="address-line2" value={address.number} onChange={(event) => updateAddress({ number: event.target.value, latitude: null, longitude: null })} />
                  </label>
                  <label className="field span-3">Bairro
                    <input className="form-control" value={address.district} onChange={(event) => updateAddress({ district: event.target.value, latitude: null, longitude: null })} />
                  </label>
                  <label className="field span-2">Cidade
                    <input className="form-control" autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress({ city: event.target.value, latitude: null, longitude: null })} />
                  </label>
                  <label className="field">UF
                    <input className="form-control" maxLength={2} autoComplete="address-level1" value={address.state} onChange={(event) => updateAddress({ state: event.target.value.toUpperCase(), latitude: null, longitude: null })} />
                  </label>
                  <label className="field span-6">Complemento <small>opcional</small>
                    <input className="form-control" value={address.complement} onChange={(event) => updateAddress({ complement: event.target.value })} />
                  </label>
                </div>

                <p className="checkout-section-title"><span>3</span> Pagamento</p>
                <div className="payment-options">
                  {([
                    ["PIX", "fas fa-qrcode", "Pix"],
                    ["CARD", "fas fa-credit-card", "Cartão na entrega"],
                    ["CASH", "fas fa-money-bill-wave", "Dinheiro"],
                  ] as const).map(([value, icon, label]) => (
                    <button type="button" key={value} className={paymentMethod === value ? "active" : ""} onClick={() => setPaymentMethod(value)}>
                      <i className={icon} /> {label}
                    </button>
                  ))}
                </div>
                {paymentMethod === "CASH" && (
                  <label className="field change-field">Troco para quanto? <small>opcional</small>
                    <input className="form-control" inputMode="decimal" placeholder="Ex.: 100,00" value={changeFor} onChange={(event) => setChangeFor(event.target.value)} />
                  </label>
                )}
                <label className="field notes-field">Observações gerais <small>opcional</small>
                  <textarea className="form-control" rows={3} maxLength={500} placeholder="Referência da entrega ou recado geral para a loja..." value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
              </div>

              <div className="map-column">
                <AddressMap
                  apiKey={mapsApiKey}
                  mapId={mapsMapId}
                  address={address}
                  geocodeQuery={geocodeQuery}
                  onAddressChange={updateAddress}
                />
                <div className={`delivery-quote ${quoteState}`}>
                  <i className={`fas ${quoteState === "loading" ? "fa-spinner fa-spin" : quote ? "fa-motorcycle" : "fa-map-marker-alt"}`} />
                  <div>
                    {quoteState === "loading" ? <strong>Calculando a melhor rota...</strong> : quote ? (
                      <><strong>Entrega: {formatMoneyFromCents(quote.deliveryFeeCents)}</strong><span>{quote.distanceLabel} · cerca de {quote.durationLabel}</span></>
                    ) : (
                      <><strong>{quoteError || "Selecione o endereço no mapa"}</strong><span>O frete aparece automaticamente.</span></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="review-grid">
              <div className="review-card">
                <p className="checkout-section-title"><span><i className="fas fa-shopping-bag" /></span> Itens</p>
                {items.map((item) => (
                  <div className="review-line" key={item.id}>
                    <span className="review-product"><span><b>{item.quantity}x</b> {item.name}</span>{item.notes && <small><i className="fas fa-comment-alt" /> {item.notes}</small>}</span>
                    <b>{formatMoneyFromCents(Math.round(item.price * 100) * item.quantity)}</b>
                  </div>
                ))}
              </div>
              <div className="review-card">
                <p className="checkout-section-title"><span><i className="fas fa-map-marker-alt" /></span> Entrega</p>
                <p><b>{customer.name}</b> · {customer.phone}</p>
                <p>{address.street}, {address.number} — {address.district}<br />{address.city}-{address.state}</p>
                {address.complement && <p>Complemento: {address.complement}</p>}
                <p className="review-route"><i className="fas fa-route" /> {quote?.distanceLabel} · {quote?.durationLabel}</p>
              </div>
              <div className="review-card">
                <p className="checkout-section-title"><span><i className="fas fa-wallet" /></span> Pagamento</p>
                <p>{paymentMethod === "PIX" ? "Pix" : paymentMethod === "CARD" ? "Cartão na entrega" : "Dinheiro"}</p>
                {notes && <p className="review-notes">“{notes}”</p>}
              </div>
              {submitError && (
                <div className="checkout-submit-error">
                  <i className="fas fa-exclamation-triangle" />
                  <div><strong>O pedido ainda não foi registrado</strong><span>{submitError}</span></div>
                  <a className="btn btn-white btn-sm" href={whatsappUrl("", totalCents)} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="order-success">
              <i className="fas fa-check" />
              <h2>Pedido recebido!</h2>
              <span className="order-code">{orderCode}</span>
              <p>O pedido já apareceu no painel da Makna&apos;s. Agora é só acompanhar o preparo pelo WhatsApp.</p>
              <p><b>Total: {formatMoneyFromCents(orderTotalCents)}</b></p>
              <div className="order-success-actions">
                <a className="btn btn-yellow" href={whatsappUrl()} target="_blank" rel="noreferrer">Avisar no WhatsApp <i className="fab fa-whatsapp" /></a>
                <button type="button" className="btn btn-white" onClick={onClose}>Continuar no cardápio</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {step < 4 && (
        <div className="m-footer">
          <div className="container cart-footer-grid">
            <div className="container-total">
              <p><span>Subtotal</span><span>{formatMoneyFromCents(subtotalCents)}</span></p>
              <p className="texto-entrega"><span>Entrega</span><span>{quote ? formatMoneyFromCents(quote.deliveryFeeCents) : "A calcular"}</span></p>
              <p className="texto-total"><span><b>Total</b></span><span className="valor-total"><b>{formatMoneyFromCents(totalCents)}</b></span></p>
            </div>
            <div className="cart-actions">
              {step > 1 && <button type="button" className="btn btn-white" onClick={() => setStep(step - 1)}>Voltar</button>}
              {step === 1 && <button type="button" className="btn btn-yellow" disabled={!items.length} onClick={() => setStep(2)}>Continuar</button>}
              {step === 2 && <button type="button" className="btn btn-yellow" disabled={quoteState === "loading"} onClick={goToReview}>Revisar pedido</button>}
              {step === 3 && <button type="button" className="btn btn-yellow" disabled={submitting} onClick={submitOrder}>{submitting ? "Enviando..." : "Confirmar pedido"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
