"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SerializedOrder } from "@/lib/orders";
import { formatMoneyFromCents } from "@/lib/money";
import type { StoreSettings } from "@/lib/store-settings";
import { StoreSettingsPanel } from "./StoreSettingsPanel";

type OrderStatus = SerializedOrder["status"];

const STATUS: Array<{ value: OrderStatus; label: string; icon: string }> = [
  { value: "RECEIVED", label: "Recebido", icon: "fa-bell" },
  { value: "PREPARING", label: "Em preparo", icon: "fa-fire" },
  { value: "READY", label: "Pronto", icon: "fa-check" },
  { value: "OUT_FOR_DELIVERY", label: "Saiu para entrega", icon: "fa-motorcycle" },
  { value: "COMPLETED", label: "Concluído", icon: "fa-check-double" },
  { value: "CANCELED", label: "Cancelado", icon: "fa-times" },
];

const STATUS_LABEL = Object.fromEntries(STATUS.map((item) => [item.value, item.label])) as Record<OrderStatus, string>;
const PAYMENT_LABEL = { PIX: "Pix", CARD: "Cartão na entrega", CASH: "Dinheiro" } as const;

function relativeDate(isoDate: string) {
  const date = new Date(isoDate);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

type OrderBoardProps = {
  initialOrders: SerializedOrder[];
  initialError?: string;
  initialStoreSettings: StoreSettings;
  storeSettingsWritable: boolean;
  geoapifyConfigured: boolean;
  geoapifyMapKey: string;
};

export function OrderBoard({
  initialOrders,
  initialError,
  initialStoreSettings,
  storeSettingsWritable,
  geoapifyConfigured,
  geoapifyMapKey,
}: OrderBoardProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [updatingId, setUpdatingId] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = (await response.json()) as { orders?: SerializedOrder[]; error?: string };
      if (!response.ok || !data.orders) throw new Error(data.error || "Não foi possível atualizar os pedidos.");
      setOrders(data.orders);
      setError("");
      setLastUpdate(new Date());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Não foi possível atualizar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialError) return;
    const interval = window.setInterval(() => void refresh(true), 15000);
    return () => window.clearInterval(interval);
  }, [initialError]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { order?: SerializedOrder; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error || "Não foi possível mudar o status.");
      setOrders((current) => current.map((order) => order.id === orderId ? data.order! : order));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível mudar o status.");
    } finally {
      setUpdatingId("");
    }
  };

  const stats = useMemo(() => ({
    received: orders.filter((order) => order.status === "RECEIVED").length,
    preparing: orders.filter((order) => ["PREPARING", "READY"].includes(order.status)).length,
    delivery: orders.filter((order) => order.status === "OUT_FOR_DELIVERY").length,
    today: orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString()).length,
  }), [orders]);

  const visibleOrders = filter === "ALL" ? orders : orders.filter((order) => order.status === filter);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="admin-shell">
          <Link href="/" className="admin-brand"><Image src="/img/logo-maknas.png" width={78} height={78} priority alt="Makna's Burguer" /><div><span>Makna&apos;s</span><strong>Pedidos</strong></div></Link>
          <div className="admin-actions">
            <span className="last-update"><i className="fas fa-circle" /> Atualizado às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            <button type="button" className="admin-icon-button" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar pedidos"><i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} /></button>
            <form action="/api/admin/logout" method="post"><button type="submit" className="btn btn-white btn-sm">Sair <i className="fas fa-sign-out-alt" /></button></form>
          </div>
        </div>
      </header>

      <div className="admin-shell admin-content">
        <div className="admin-title-row"><div><span className="admin-eyebrow">Operação em tempo real</span><h1>Fila de pedidos</h1></div><span className="order-count">{orders.length} pedidos recentes</span></div>

        <StoreSettingsPanel
          initialSettings={initialStoreSettings}
          writable={storeSettingsWritable}
          geoapifyConfigured={geoapifyConfigured}
          geoapifyMapKey={geoapifyMapKey}
        />

        <section className="admin-stats">
          {[
            ["Novos", stats.received, "fa-bell", "red"],
            ["Na cozinha", stats.preparing, "fa-fire", "orange"],
            ["Em entrega", stats.delivery, "fa-motorcycle", "blue"],
            ["Hoje", stats.today, "fa-calendar-day", "green"],
          ].map(([label, value, icon, color]) => (
            <div className={`stat-card ${color}`} key={String(label)}><i className={`fas ${icon}`} /><div><strong>{value}</strong><span>{label}</span></div></div>
          ))}
        </section>

        <div className="admin-toolbar">
          <div className="status-filters">
            <button type="button" className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>Todos</button>
            {STATUS.filter((status) => status.value !== "CANCELED").map((status) => <button type="button" key={status.value} className={filter === status.value ? "active" : ""} onClick={() => setFilter(status.value)}>{status.label}</button>)}
          </div>
        </div>

        {error && <div className="admin-error"><i className="fas fa-exclamation-triangle" /><div><strong>O painel precisa de atenção</strong><span>{error}</span></div><button className="btn btn-white btn-sm" type="button" onClick={() => void refresh()}>Tentar novamente</button></div>}

        <section className="orders-list">
          {visibleOrders.length === 0 ? (
            <div className="empty-orders"><i className="fas fa-receipt" /><h2>Nenhum pedido aqui</h2><p>Novos pedidos aparecerão automaticamente nesta tela.</p></div>
          ) : visibleOrders.map((order) => (
            <article className={`order-card status-${order.status.toLowerCase()}`} key={order.id}>
              <div className="order-card-head">
                <div><span className="order-code-admin">{order.code}</span><time dateTime={order.createdAt}>{relativeDate(order.createdAt)}</time></div>
                <span className={`status-badge status-${order.status.toLowerCase()}`}>{STATUS_LABEL[order.status]}</span>
              </div>
              <div className="order-card-grid">
                <div className="order-customer">
                  <span className="order-label">Cliente</span>
                  <h2>{order.customerName}</h2>
                  <a href={`https://wa.me/55${order.customerPhone.replace(/^55/, "")}`} target="_blank" rel="noreferrer"><i className="fab fa-whatsapp" /> {order.customerPhone}</a>
                  {order.customerEmail && <span><i className="fas fa-envelope" /> {order.customerEmail}</span>}
                </div>
                <div className="order-address">
                  <span className="order-label">Entrega</span>
                  <p>{order.street}, {order.number}<br />{order.district} · {order.city}-{order.state}</p>
                  <a href={`https://www.openstreetmap.org/?mlat=${order.latitude}&mlon=${order.longitude}#map=18/${order.latitude}/${order.longitude}`} target="_blank" rel="noreferrer"><i className="fas fa-map-marker-alt" /> {Math.round(order.distanceMeters / 100) / 10} km · {Math.ceil(order.durationSeconds / 60)} min</a>
                </div>
                <div className="order-payment">
                  <span className="order-label">Pagamento</span>
                  <p>{PAYMENT_LABEL[order.paymentMethod]}</p>
                  {order.changeForCents && <span>Troco para {formatMoneyFromCents(order.changeForCents)}</span>}
                  <strong>{formatMoneyFromCents(order.totalCents)}</strong>
                </div>
              </div>
              <details className="order-details">
                <summary><span><i className="fas fa-hamburger" /> {order.items.reduce((sum, item) => sum + item.quantity, 0)} itens</span><span>Ver detalhes <i className="fas fa-chevron-down" /></span></summary>
                <div className="order-items-admin">
                  {order.items.map((item) => <div className="order-item-admin-row" key={item.id}><span><span><b>{item.quantity}x</b> {item.productName}</span>{item.notes && <small><i className="fas fa-comment-alt" /> {item.notes}</small>}</span><strong>{formatMoneyFromCents(item.totalCents)}</strong></div>)}
                  <div className="order-total-line"><span>Subtotal</span><strong>{formatMoneyFromCents(order.subtotalCents)}</strong></div>
                  <div><span>Entrega</span><strong>{formatMoneyFromCents(order.deliveryFeeCents)}</strong></div>
                  {order.notes && <p className="order-notes"><i className="fas fa-comment-alt" /> <b>Observação:</b> {order.notes}</p>}
                </div>
              </details>
              <div className="order-status-actions">
                <span>Atualizar status</span>
                <div>{STATUS.map((status) => <button type="button" key={status.value} title={status.label} aria-label={`${status.label} para ${order.code}`} disabled={updatingId === order.id} className={order.status === status.value ? "active" : ""} onClick={() => void updateStatus(order.id, status.value)}><i className={`fas ${status.icon}`} /><span>{status.label}</span></button>)}</div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
