"use client";

import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/components/checkout/AddressAutocomplete";
import { AddressMap, type CheckoutAddress } from "@/components/checkout/AddressMap";
import { formatMoneyFromCents } from "@/lib/money";
import type { DeliveryPricingMode, StoreSettings } from "@/lib/store-settings";

type StoreSettingsPanelProps = {
  initialSettings: StoreSettings;
  writable: boolean;
  geoapifyConfigured: boolean;
  geoapifyMapKey: string;
};

type DeliveryForm = {
  mode: DeliveryPricingMode;
  baseFee: string;
  includedKm: string;
  additionalFeePerKm: string;
  maxDistanceKm: string;
};

function typedNumber(query: string, street: string) {
  if (!street || !query.toLocaleLowerCase("pt-BR").startsWith(street.toLocaleLowerCase("pt-BR"))) {
    return "";
  }
  return query.slice(street.length).trim().replace(/^,\s*/, "").match(/^[0-9]+[A-Za-z-]*/)?.[0] ?? "";
}

function decimalValue(value: string) {
  return Number(value.trim().replace(",", "."));
}

function inputDecimal(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function deliveryFormFromSettings(settings: StoreSettings): DeliveryForm {
  return {
    mode: settings.deliveryPricingMode,
    baseFee: inputDecimal(settings.baseDeliveryFeeCents / 100),
    includedKm: inputDecimal(settings.includedDistanceKm),
    additionalFeePerKm: inputDecimal(settings.additionalFeePerKmCents / 100),
    maxDistanceKm: inputDecimal(settings.maxDeliveryDistanceKm),
  };
}

export function StoreSettingsPanel({
  initialSettings,
  writable,
  geoapifyConfigured,
  geoapifyMapKey,
}: StoreSettingsPanelProps) {
  const [address, setAddress] = useState<CheckoutAddress>({
    ...initialSettings,
    complement: "",
  });
  const [delivery, setDelivery] = useState<DeliveryForm>(() => deliveryFormFromSettings(initialSettings));
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const updateAddress = (next: Partial<CheckoutAddress>) => {
    setAddress((current) => ({ ...current, ...next }));
    clearFeedback();
  };

  const updateDelivery = (next: Partial<DeliveryForm>) => {
    setDelivery((current) => ({ ...current, ...next }));
    clearFeedback();
  };

  useEffect(() => {
    if (
      !geoapifyConfigured
      || address.latitude !== null
      || address.longitude !== null
      || !address.street.trim()
      || !address.number.trim()
      || !address.city.trim()
      || address.state.trim().length !== 2
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
    address.latitude,
    address.longitude,
    address.number,
    address.state,
    address.street,
    geoapifyConfigured,
  ]);

  const save = async () => {
    if (!writable) return;
    if (address.latitude === null || address.longitude === null) {
      setError("Escolha uma sugestão ou marque o ponto da loja no mapa.");
      return;
    }

    const baseFee = decimalValue(delivery.baseFee);
    const includedKm = decimalValue(delivery.includedKm);
    const additionalFeePerKm = decimalValue(delivery.additionalFeePerKm);
    const maxDistanceKm = decimalValue(delivery.maxDistanceKm);
    if (
      !Number.isFinite(baseFee) || baseFee < 0
      || !Number.isFinite(includedKm) || includedKm < 0
      || !Number.isFinite(additionalFeePerKm) || additionalFeePerKm < 0
      || !Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0
    ) {
      setError("Informe valores válidos para a taxa e o raio de entrega.");
      return;
    }
    if (delivery.mode === "PER_KM" && includedKm > maxDistanceKm) {
      setError("A distância incluída na taxa não pode superar o raio máximo.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const formattedAddress = [
        address.street,
        address.number,
        address.district,
        address.city,
        address.state,
      ].filter(Boolean).join(", ");
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: address.street,
          number: address.number,
          district: address.district,
          city: address.city,
          state: address.state,
          formattedAddress,
          latitude: address.latitude,
          longitude: address.longitude,
          deliveryPricingMode: delivery.mode,
          baseDeliveryFeeCents: Math.round(baseFee * 100),
          includedDistanceKm: includedKm,
          additionalFeePerKmCents: Math.round(additionalFeePerKm * 100),
          maxDeliveryDistanceKm: maxDistanceKm,
        }),
      });
      const data = await response.json() as { settings?: StoreSettings; error?: string };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Não foi possível salvar as configurações.");
      }
      setAddress({ ...data.settings, complement: "" });
      setDelivery(deliveryFormFromSettings(data.settings));
      setMessage("Configurações salvas. Os próximos cálculos já usarão esta regra.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  const baseFeeCents = Math.max(0, Math.round((decimalValue(delivery.baseFee) || 0) * 100));
  const additionalFeeCents = Math.max(0, Math.round((decimalValue(delivery.additionalFeePerKm) || 0) * 100));

  return (
    <details className="store-settings-panel" open>
      <summary>
        <span><i className="fas fa-store" /> Loja e entrega</span>
        <span>{formatMoneyFromCents(baseFeeCents)} · raio de {delivery.maxDistanceKm || "—"} km</span>
      </summary>
      <div className="store-settings-body">
        <div className="store-settings-form">
          <div className="store-settings-heading">
            <div><span className="admin-eyebrow">Origem das entregas</span><h2>Localização da loja</h2></div>
            <span className="store-location-status"><i className="fas fa-map-marker-alt" /> {address.city}-{address.state}</span>
          </div>
          <p className="store-settings-intro">Busque o endereço ou arraste o marcador até a entrada usada pelos entregadores.</p>
          <div className="form-grid cols-6">
            <label className="field span-4">Rua
              <AddressAutocomplete
                configured={geoapifyConfigured}
                value={address.street}
                context={[address.district, address.city, address.state].filter(Boolean).join(", ")}
                onValueChange={(street) => updateAddress({ street, latitude: null, longitude: null })}
                onSelect={(location) => updateAddress({
                  street: location.street || address.street,
                  number: location.number || typedNumber(address.street, location.street) || address.number,
                  district: location.district || address.district,
                  city: location.city || address.city,
                  state: location.state || address.state,
                  formattedAddress: location.formattedAddress,
                  latitude: location.latitude,
                  longitude: location.longitude,
                })}
              />
            </label>
            <label className="field span-2">Número
              <input className="form-control" value={address.number} onChange={(event) => updateAddress({ number: event.target.value, latitude: null, longitude: null })} />
            </label>
            <label className="field span-3">Bairro
              <input className="form-control" value={address.district} onChange={(event) => updateAddress({ district: event.target.value, latitude: null, longitude: null })} />
            </label>
            <label className="field span-2">Cidade
              <input className="form-control" value={address.city} onChange={(event) => updateAddress({ city: event.target.value, latitude: null, longitude: null })} />
            </label>
            <label className="field">UF
              <input className="form-control" maxLength={2} value={address.state} onChange={(event) => updateAddress({ state: event.target.value.toUpperCase(), latitude: null, longitude: null })} />
            </label>
          </div>
          <div className="store-coordinates">
            <span>Latitude <b>{address.latitude?.toFixed(7) ?? "A localizar"}</b></span>
            <span>Longitude <b>{address.longitude?.toFixed(7) ?? "A localizar"}</b></span>
          </div>

          <section className="delivery-settings-section">
            <div className="delivery-settings-heading">
              <div><span className="admin-eyebrow">Área e cobrança</span><h2>Taxa de entrega</h2></div>
              <i className="fas fa-motorcycle" />
            </div>
            <div className="delivery-mode-options" role="radiogroup" aria-label="Forma de cobrança da entrega">
              <button type="button" role="radio" aria-checked={delivery.mode === "FIXED"} className={delivery.mode === "FIXED" ? "active" : ""} onClick={() => updateDelivery({ mode: "FIXED" })}>
                <i className="fas fa-tag" /><span><strong>Taxa fixa</strong><small>Mesmo valor dentro do raio</small></span>
              </button>
              <button type="button" role="radio" aria-checked={delivery.mode === "PER_KM"} className={delivery.mode === "PER_KM" ? "active" : ""} onClick={() => updateDelivery({ mode: "PER_KM" })}>
                <i className="fas fa-route" /><span><strong>Base + por km</strong><small>Acréscimo após a franquia</small></span>
              </button>
            </div>
            <div className="form-grid cols-2 delivery-rules-grid">
              <label className="field">Taxa base (R$)
                <input className="form-control" inputMode="decimal" value={delivery.baseFee} onChange={(event) => updateDelivery({ baseFee: event.target.value })} />
              </label>
              <label className="field">Raio máximo (km)
                <input className="form-control" inputMode="decimal" value={delivery.maxDistanceKm} onChange={(event) => updateDelivery({ maxDistanceKm: event.target.value })} />
              </label>
              {delivery.mode === "PER_KM" && <>
                <label className="field">Distância incluída (km)
                  <input className="form-control" inputMode="decimal" value={delivery.includedKm} onChange={(event) => updateDelivery({ includedKm: event.target.value })} />
                </label>
                <label className="field">Adicional por km (R$)
                  <input className="form-control" inputMode="decimal" value={delivery.additionalFeePerKm} onChange={(event) => updateDelivery({ additionalFeePerKm: event.target.value })} />
                </label>
              </>}
            </div>
            <p className="delivery-rule-preview">
              <i className="fas fa-info-circle" /> {delivery.mode === "FIXED"
                ? `${formatMoneyFromCents(baseFeeCents)} para qualquer rota de até ${delivery.maxDistanceKm || "—"} km.`
                : `${formatMoneyFromCents(baseFeeCents)} até ${delivery.includedKm || "0"} km, mais ${formatMoneyFromCents(additionalFeeCents)} por km adicional iniciado, limitado a ${delivery.maxDistanceKm || "—"} km.`}
            </p>
          </section>

          {!writable && <p className="store-settings-warning"><i className="fas fa-database" /> Conecte o PostgreSQL para alterar estas configurações pelo painel.</p>}
          {message && <p className="store-settings-success"><i className="fas fa-check-circle" /> {message}</p>}
          {error && <p className="store-settings-warning"><i className="fas fa-exclamation-triangle" /> {error}</p>}
          <button className="btn btn-yellow" type="button" onClick={() => void save()} disabled={!writable || saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Salvando...</> : <><i className="fas fa-save" /> Salvar endereço e entrega</>}
          </button>
        </div>
        <AddressMap
          configured={geoapifyConfigured}
          mapApiKey={geoapifyMapKey}
          storeLatitude={initialSettings.latitude}
          storeLongitude={initialSettings.longitude}
          address={address}
          geocodeQuery={geocodeQuery}
          onAddressChange={updateAddress}
        />
      </div>
    </details>
  );
}
