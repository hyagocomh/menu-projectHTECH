import "server-only";

import { getStoreLocation } from "@/lib/store-settings";

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

function numberFromEnv(name: string, fallback?: number) {
  const raw = process.env[name];
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export async function calculateDeliveryQuote(
  destination: Coordinates,
): Promise<DeliveryQuote> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  const store = await getStoreLocation();

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
  const maxDistanceKm = numberFromEnv("DELIVERY_MAX_KM", 15) ?? 15;

  if (distanceKm > maxDistanceKm) {
    throw new DeliveryError(
      `O endereço fica fora da nossa área de entrega de ${maxDistanceKm.toLocaleString("pt-BR")} km.`,
      "OUTSIDE_DELIVERY_AREA",
    );
  }

  const baseFee = numberFromEnv("DELIVERY_BASE_FEE", 7.5) ?? 7.5;
  const includedKm = numberFromEnv("DELIVERY_INCLUDED_KM", 2) ?? 2;
  const pricePerKm = numberFromEnv("DELIVERY_PRICE_PER_KM", 2.5) ?? 2.5;
  const fee = baseFee + Math.max(0, distanceKm - includedKm) * pricePerKm;
  const routeTime = Number(route?.time);
  const durationSeconds = Number.isFinite(routeTime) ? Math.round(routeTime) : 0;

  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds,
    deliveryFeeCents: Math.round(fee * 100),
    distanceLabel: `${distanceKm.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km`,
    durationLabel: `${Math.max(1, Math.ceil(durationSeconds / 60))} min`,
  };
}
