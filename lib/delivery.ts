import "server-only";

import { getStoreSettings } from "@/lib/store-settings";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DeliveryQuote = {
  distanceMeters: number;
  durationSeconds: number;
  deliveryFeeCents: number;
  distanceLabel: string;
  durationLabel: string;
};

export class DeliveryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DELIVERY_NOT_CONFIGURED"
      | "OUTSIDE_DELIVERY_AREA"
      | "ROUTE_NOT_FOUND"
      | "ROUTE_PROVIDER_ERROR",
    public readonly status = 422,
  ) {
    super(message);
  }
}

export async function calculateDeliveryQuote(
  destination: Coordinates,
): Promise<DeliveryQuote> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  const store = await getStoreSettings();

  if (!apiKey) {
    throw new DeliveryError(
      "O cálculo de entrega ainda não foi configurado pela loja.",
      "DELIVERY_NOT_CONFIGURED",
      503,
    );
  }

  const configuredMode = process.env.DELIVERY_ROUTING_MODE;
  const mode = configuredMode === "drive" || configuredMode === "motorcycle"
    ? configuredMode
    : "scooter";
  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set(
    "waypoints",
    `${store.latitude},${store.longitude}|${destination.latitude},${destination.longitude}`,
  );
  url.searchParams.set("mode", mode);
  url.searchParams.set("type", "balanced");
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "pt-BR");
  url.searchParams.set("apiKey", apiKey);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/geo+json, application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.error("Geoapify Routing request failed", error instanceof Error ? error.name : "unknown");
    throw new DeliveryError(
      "Não foi possível calcular a rota de entrega. Tente novamente.",
      "ROUTE_PROVIDER_ERROR",
      502,
    );
  }

  if (!response.ok) {
    console.error("Geoapify Routing API error", response.status);
    throw new DeliveryError(
      "Não foi possível calcular a rota de entrega. Tente novamente.",
      "ROUTE_PROVIDER_ERROR",
      502,
    );
  }

  let result: {
    features?: Array<{ properties?: { distance?: number; time?: number } }>;
  };
  try {
    result = await response.json() as typeof result;
  } catch {
    throw new DeliveryError(
      "Não foi possível calcular a rota de entrega. Tente novamente.",
      "ROUTE_PROVIDER_ERROR",
      502,
    );
  }
  const route = result.features?.[0]?.properties;
  const distanceMeters = Number(route?.distance);

  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new DeliveryError(
      "Não encontramos uma rota de entrega até esse endereço.",
      "ROUTE_NOT_FOUND",
    );
  }

  const distanceKm = distanceMeters / 1000;
  const maxDistanceKm = store.maxDeliveryDistanceKm;

  if (distanceMeters > Math.round(maxDistanceKm * 1000)) {
    throw new DeliveryError(
      `O endereço fica fora da nossa área de entrega de ${maxDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km.`,
      "OUTSIDE_DELIVERY_AREA",
    );
  }

  const additionalKilometers = store.deliveryPricingMode === "PER_KM"
    ? Math.ceil(Math.max(0, distanceKm - store.includedDistanceKm))
    : 0;
  const deliveryFeeCents = store.baseDeliveryFeeCents
    + additionalKilometers * store.additionalFeePerKmCents;
  const routeTime = Number(route?.time);
  const durationSeconds = Number.isFinite(routeTime) ? Math.round(routeTime) : 0;

  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds,
    deliveryFeeCents,
    distanceLabel: `${distanceKm.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km`,
    durationLabel: `${Math.max(1, Math.ceil(durationSeconds / 60))} min`,
  };
}
