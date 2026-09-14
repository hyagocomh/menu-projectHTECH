"use client";

import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";

export type CheckoutAddress = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  complement: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
};

type LocationResult = Omit<CheckoutAddress, "complement"> & {
  latitude: number;
  longitude: number;
};

type AddressMapProps = {
  configured: boolean;
  mapApiKey: string;
  storeLatitude: number;
  storeLongitude: number;
  address: CheckoutAddress;
  geocodeQuery: string;
  onAddressChange: (next: Partial<CheckoutAddress>) => void;
};

function locationUpdate(location: LocationResult): Partial<CheckoutAddress> {
  return {
    street: location.street,
    number: location.number,
    district: location.district,
    city: location.city,
    state: location.state,
    formattedAddress: location.formattedAddress,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function AddressMap({
  configured,
  mapApiKey,
  storeLatitude,
  storeLongitude,
  address,
  geocodeQuery,
  onAddressChange,
}: AddressMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const lastGeocodeQuery = useRef("");
  const searchValueRef = useRef("");
  const skipNextAutocomplete = useRef(false);
  const [mapReady, setMapReady] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [locating, setLocating] = useState(false);

  const resolveCoordinates = useCallback(async (latitude: number, longitude: number) => {
    onAddressChange({ latitude, longitude });
    setSearchError("");

    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
      });
      const response = await fetch(`/api/location/reverse?${params}`, {
        cache: "no-store",
      });
      const data = await response.json() as { location?: LocationResult; error?: string };
      if (!response.ok || !data.location) {
        throw new Error(data.error || "Não foi possível identificar esse ponto.");
      }
      onAddressChange(locationUpdate(data.location));
      if (data.location.formattedAddress !== searchValueRef.current) {
        skipNextAutocomplete.current = true;
        searchValueRef.current = data.location.formattedAddress;
        setSearchValue(data.location.formattedAddress);
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Não foi possível identificar esse ponto.");
    }
  }, [onAddressChange]);

  useEffect(() => {
    if (!configured || !mapContainerRef.current) return;

    let disposed = false;
    let localMap: LeafletMap | null = null;

    void import("leaflet").then((leaflet) => {
      if (disposed || !mapContainerRef.current) return;
      leafletRef.current = leaflet;

      localMap = leaflet.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([storeLatitude, storeLongitude], 13);
      leaflet.control.zoom({ position: "bottomleft" }).addTo(localMap);

      const retinaSuffix = leaflet.Browser.retina ? "@2x" : "";
      leaflet.tileLayer(
        `https://maps.geoapify.com/v1/tile/dark-matter-brown/{z}/{x}/{y}${retinaSuffix}.png?apiKey=${encodeURIComponent(mapApiKey)}`,
        {
          maxZoom: 20,
          attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | <a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>',
        },
      ).addTo(localMap);

      localMap.on("click", (event) => {
        void resolveCoordinates(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = localMap;
      setMapReady((value) => value + 1);
    });

    return () => {
      disposed = true;
      markerRef.current = null;
      leafletRef.current = null;
      mapRef.current = null;
      localMap?.remove();
    };
  }, [configured, mapApiKey, resolveCoordinates, storeLatitude, storeLongitude]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || address.latitude === null || address.longitude === null) return;

    const position: [number, number] = [address.latitude, address.longitude];
    if (!markerRef.current) {
      const icon = leaflet.divIcon({
        className: "maknas-map-marker-wrapper",
        html: '<span class="maknas-map-marker"><i class="fas fa-map-marker-alt"></i></span>',
        iconSize: [42, 48],
        iconAnchor: [21, 45],
      });
      const marker = leaflet.marker(position, { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLatLng();
        void resolveCoordinates(point.lat, point.lng);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(position);
    }
    map.setView(position, 17, { animate: true });
  }, [address.latitude, address.longitude, mapReady, resolveCoordinates]);

  useEffect(() => {
    if (!configured || !geocodeQuery || lastGeocodeQuery.current === geocodeQuery) return;
    lastGeocodeQuery.current = geocodeQuery;
    const controller = new AbortController();

    void fetch(`/api/location/search?mode=geocode&q=${encodeURIComponent(geocodeQuery)}`, {
      signal: controller.signal,
      cache: "no-store",
    }).then(async (response) => {
      const data = await response.json() as { locations?: LocationResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Endereço não encontrado.");
      const location = data.locations?.[0];
      if (!location) throw new Error("Não encontramos esse endereço.");
      onAddressChange({
        formattedAddress: location.formattedAddress,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setSearchError(error instanceof Error ? error.message : "Endereço não encontrado.");
    });

    return () => controller.abort();
  }, [configured, geocodeQuery, onAddressChange]);

  useEffect(() => {
    const query = searchValue.normalize("NFKC").trim();
    if (skipNextAutocomplete.current) {
      skipNextAutocomplete.current = false;
      return;
    }
    if (!configured || query.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json() as { locations?: LocationResult[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Não foi possível buscar o endereço.");
        setSuggestions(data.locations ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSearchError(error instanceof Error ? error.message : "Não foi possível buscar o endereço.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [configured, searchValue]);

  const selectLocation = (location: LocationResult) => {
    setSuggestions([]);
    setSearchError("");
    if (location.formattedAddress !== searchValueRef.current) {
      skipNextAutocomplete.current = true;
      searchValueRef.current = location.formattedAddress;
      setSearchValue(location.formattedAddress);
    }
    onAddressChange(locationUpdate(location));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Seu navegador não oferece localização por GPS.");
      return;
    }

    setLocating(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        void resolveCoordinates(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocating(false);
        setSearchError("Não foi possível acessar sua localização. Verifique a permissão do navegador.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  if (!configured) {
    return (
      <div className="map-not-configured">
        <i className="fas fa-map-marked-alt" />
        <div>
          <strong>Geoapify aguardando configuração</strong>
          <span>Cadastre as chaves do Geoapify na Vercel para ativar busca, mapa e cálculo automático.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="address-map">
      <div className="map-search-panel">
        <div className="map-search-row">
          <i className={`fas ${searching ? "fa-spinner fa-spin" : "fa-search"}`} />
          <input
            type="search"
            role="combobox"
            aria-label="Buscar endereço"
            aria-expanded={suggestions.length > 0}
            aria-controls="address-suggestions"
            autoComplete="off"
            placeholder="Busque sua rua ou endereço"
            value={searchValue}
            onChange={(event) => {
              const value = event.target.value;
              searchValueRef.current = value;
              setSearchValue(value);
              if (value.trim().length < 3) {
                setSuggestions([]);
                setSearching(false);
                setSearchError("");
              }
            }}
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            aria-label="Usar minha localização atual"
            title="Usar minha localização atual"
          >
            <i className={`fas ${locating ? "fa-spinner fa-spin" : "fa-crosshairs"}`} />
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="map-search-suggestions" id="address-suggestions" role="listbox">
            {suggestions.map((location, index) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={`${location.latitude}-${location.longitude}-${index}`}
                onClick={() => selectLocation(location)}
              >
                <i className="fas fa-map-marker-alt" />
                <span>{location.formattedAddress}</span>
              </button>
            ))}
          </div>
        )}
        {searchError && <p className="map-search-error" role="status">{searchError}</p>}
      </div>
      <div className="leaflet-map-canvas" ref={mapContainerRef} aria-label="Mapa do endereço de entrega" />
      <span className="map-drag-hint"><i className="fas fa-hand-pointer" /> Clique ou arraste o marcador para ajustar</span>
    </div>
  );
}
