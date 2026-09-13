import "server-only";

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

function parseDuration(duration: string) {
  const seconds = Number(duration.replace("s", ""));
  return Number.isFinite(seconds) ? Math.round(seconds) : 0;
}

export async function calculateDeliveryQuote(
  destination: Coordinates,
): Promise<DeliveryQuote> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  const storeLatitude = numberFromEnv("STORE_LATITUDE");
  const storeLongitude = numberFromEnv("STORE_LONGITUDE");

  if (!apiKey || storeLatitude === undefined || storeLongitude === undefined) {
    throw new DeliveryError(
      "O cálculo de entrega ainda não foi configurado pela loja.",
      "DELIVERY_NOT_CONFIGURED",
      503,
    );
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: storeLatitude,
              longitude: storeLongitude,
            },
          },
        },
        destination: {
          location: {
            latLng: destination,
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        languageCode: "pt-BR",
        units: "METRIC",
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error("Routes API error", response.status, await response.text());
    throw new DeliveryError(
      "Não foi possível calcular a rota de entrega. Tente novamente.",
      "ROUTE_PROVIDER_ERROR",
      502,
    );
  }

  const result = (await response.json()) as {
    routes?: Array<{ distanceMeters?: number; duration?: string }>;
  };
  const route = result.routes?.[0];

  if (!route?.distanceMeters) {
    throw new DeliveryError(
      "Não encontramos uma rota de carro até esse endereço.",
      "ROUTE_NOT_FOUND",
    );
  }

  const distanceKm = route.distanceMeters / 1000;
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
  const durationSeconds = parseDuration(route.duration ?? "0s");

  return {
    distanceMeters: Math.round(route.distanceMeters),
    durationSeconds,
    deliveryFeeCents: Math.round(fee * 100),
    distanceLabel: `${distanceKm.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km`,
    durationLabel: `${Math.max(1, Math.ceil(durationSeconds / 60))} min`,
  };
}
