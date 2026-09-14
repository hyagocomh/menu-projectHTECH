"use client";

import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/components/checkout/AddressAutocomplete";
import { AddressMap, type CheckoutAddress } from "@/components/checkout/AddressMap";
import type { StoreLocation } from "@/lib/store-settings";

type StoreSettingsPanelProps = {
  initialLocation: StoreLocation;
  writable: boolean;
  geoapifyConfigured: boolean;
  geoapifyMapKey: string;
};

function typedNumber(query: string, street: string) {
  if (!street || !query.toLocaleLowerCase("pt-BR").startsWith(street.toLocaleLowerCase("pt-BR"))) {
    return "";
  }
  return query.slice(street.length).trim().replace(/^,\s*/, "").match(/^[0-9]+[A-Za-z-]*/)?.[0] ?? "";
}

export function StoreSettingsPanel({
  initialLocation,
  writable,
  geoapifyConfigured,
  geoapifyMapKey,
}: StoreSettingsPanelProps) {
  const [address, setAddress] = useState<CheckoutAddress>({
    ...initialLocation,
    complement: "",
  });
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateAddress = (next: Partial<CheckoutAddress>) => {
    setAddress((current) => ({ ...current, ...next }));
    setMessage("");
    setError("");
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
        }),
      });
      const data = await response.json() as { location?: StoreLocation; error?: string };
      if (!response.ok || !data.location) throw new Error(data.error || "Não foi possível salvar o ponto.");
      setAddress({ ...data.location, complement: "" });
      setMessage("Ponto da loja salvo. As próximas entregas usarão esta origem.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o ponto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="store-settings-panel" open>
      <summary>
        <span><i className="fas fa-store" /> Ponto do estabelecimento</span>
        <span>{address.street}, {address.number} · {address.district}</span>
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
          {!writable && <p className="store-settings-warning"><i className="fas fa-database" /> O ponto acima já é usado como origem padrão. Conecte o PostgreSQL para poder alterá-lo pelo painel.</p>}
          {message && <p className="store-settings-success"><i className="fas fa-check-circle" /> {message}</p>}
          {error && <p className="store-settings-warning"><i className="fas fa-exclamation-triangle" /> {error}</p>}
          <button className="btn btn-yellow" type="button" onClick={() => void save()} disabled={!writable || saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Salvando...</> : <><i className="fas fa-save" /> Salvar ponto da loja</>}
          </button>
        </div>
        <AddressMap
          configured={geoapifyConfigured}
          mapApiKey={geoapifyMapKey}
          storeLatitude={initialLocation.latitude}
          storeLongitude={initialLocation.longitude}
          address={address}
          geocodeQuery={geocodeQuery}
          onAddressChange={updateAddress}
        />
      </div>
    </details>
  );
}
