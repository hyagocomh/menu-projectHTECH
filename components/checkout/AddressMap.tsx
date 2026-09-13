"use client";

import { useEffect, useRef } from "react";
import {
  AdvancedMarker,
  APIProvider,
  Map,
  MapControl,
  ControlPosition,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

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

type Position = { lat: number; lng: number };

type AddressMapProps = {
  apiKey: string;
  mapId: string;
  address: CheckoutAddress;
  geocodeQuery: string;
  onAddressChange: (next: Partial<CheckoutAddress>) => void;
};

function componentText(
  components: google.maps.places.AddressComponent[] | undefined,
  types: string[],
  short = false,
) {
  const component = components?.find((item) =>
    types.some((type) => item.types.includes(type)),
  );
  return short ? component?.shortText ?? "" : component?.longText ?? "";
}

function PlaceSearch({
  onSelect,
}: {
  onSelect: (place: google.maps.places.Place) => void;
}) {
  const map = useMap();
  const places = useMapsLibrary("places");
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map || !places || !containerRef.current) return;

    const autocomplete = new places.PlaceAutocompleteElement();
    autocomplete.placeholder = "Busque sua rua ou endereço";
    autocomplete.includedRegionCodes = ["br"];
    containerRef.current.appendChild(autocomplete);

    const listener = (event: Event) => {
      const selection = event as google.maps.places.PlacePredictionSelectEvent;
      const place = selection.placePrediction.toPlace();
      void place.fetchFields({
        fields: [
          "location",
          "viewport",
          "formattedAddress",
          "addressComponents",
        ],
      }).then(() => {
        if (place.viewport) map.fitBounds(place.viewport);
        else if (place.location) {
          map.setCenter(place.location);
          map.setZoom(17);
        }
        onSelectRef.current(place);
      });
    };

    autocomplete.addEventListener("gmp-select", listener);
    return () => {
      autocomplete.removeEventListener("gmp-select", listener);
      autocomplete.remove();
    };
  }, [map, places]);

  return <div className="map-search" ref={containerRef} />;
}

function MapContent({
  address,
  geocodeQuery,
  onAddressChange,
}: Omit<AddressMapProps, "apiKey" | "mapId">) {
  const map = useMap();
  const geocoding = useMapsLibrary("geocoding");
  const lastQuery = useRef("");
  const position: Position | null = address.latitude !== null && address.longitude !== null
    ? { lat: address.latitude, lng: address.longitude }
    : null;

  useEffect(() => {
    if (
      !map ||
      !geocoding ||
      !geocodeQuery ||
      (lastQuery.current === geocodeQuery && address.latitude !== null && address.longitude !== null)
    ) return;
    lastQuery.current = geocodeQuery;
    const geocoder = new geocoding.Geocoder();
    void geocoder.geocode({ address: geocodeQuery, region: "BR" }).then(({ results }) => {
      const result = results[0];
      if (!result) return;
      const location = result.geometry.location;
      const next = { latitude: location.lat(), longitude: location.lng() };
      map.setCenter(location);
      map.setZoom(17);
      onAddressChange(next);
    }).catch(() => undefined);
  }, [
    address.latitude,
    address.longitude,
    geocodeQuery,
    geocoding,
    map,
    onAddressChange,
  ]);

  const handlePlace = (place: google.maps.places.Place) => {
    if (!place.location) return;
    const components = place.addressComponents;
    const route = componentText(components, ["route"]);
    const number = componentText(components, ["street_number"]);
    const district = componentText(components, [
      "sublocality_level_1",
      "sublocality_level_2",
      "neighborhood",
    ]);

    onAddressChange({
      street: route || address.street,
      number: number || address.number,
      district: district || address.district,
      city: componentText(components, ["administrative_area_level_2", "locality"]) || address.city,
      state: componentText(components, ["administrative_area_level_1"], true) || address.state,
      formattedAddress: place.formattedAddress ?? address.formattedAddress,
      latitude: place.location.lat(),
      longitude: place.location.lng(),
    });
  };

  return (
    <>
      <MapControl position={ControlPosition.BLOCK_START_INLINE_START}>
        <PlaceSearch onSelect={handlePlace} />
      </MapControl>
      {position && (
        <AdvancedMarker
          position={position}
          draggable
          onDragEnd={(event) => {
            const latLng = event.latLng;
            if (!latLng) return;
            onAddressChange({ latitude: latLng.lat(), longitude: latLng.lng() });
          }}
          title="Local da entrega"
        />
      )}
    </>
  );
}

export function AddressMap(props: AddressMapProps) {
  if (!props.apiKey) {
    return (
      <div className="map-not-configured">
        <i className="fas fa-map-marked-alt" />
        <div>
          <strong>Mapa aguardando configuração</strong>
          <span>Cadastre a chave do Google Maps na Vercel para ativar busca e cálculo automático.</span>
        </div>
      </div>
    );
  }

  const center = props.address.latitude !== null && props.address.longitude !== null
    ? { lat: props.address.latitude, lng: props.address.longitude }
    : { lat: -9.6658, lng: -35.7353 };

  return (
    <div className="address-map">
      <APIProvider apiKey={props.apiKey} libraries={["places", "geocoding"]}>
        <Map
          defaultCenter={center}
          defaultZoom={13}
          mapId={props.mapId || "DEMO_MAP_ID"}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
        >
          <MapContent
            address={props.address}
            geocodeQuery={props.geocodeQuery}
            onAddressChange={props.onAddressChange}
          />
        </Map>
      </APIProvider>
    </div>
  );
}
