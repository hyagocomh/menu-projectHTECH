import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type StoreLocation = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

export type DeliveryPricingMode = "FIXED" | "PER_KM";

export type StoreSettings = StoreLocation & {
  deliveryPricingMode: DeliveryPricingMode;
  baseDeliveryFeeCents: number;
  includedDistanceKm: number;
  additionalFeePerKmCents: number;
  maxDeliveryDistanceKm: number;
};

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  street: "Rua São Jorge",
  number: "20",
  district: "Barro Duro",
  city: "Maceió",
  state: "AL",
  formattedAddress: "Rua São Jorge, 20 - Barro Duro, Maceió - AL",
  latitude: -9.6192548,
  longitude: -35.7153547,
  deliveryPricingMode: "FIXED",
  baseDeliveryFeeCents: 500,
  includedDistanceKm: 5,
  additionalFeePerKmCents: 100,
  maxDeliveryDistanceKm: 5,
};

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function envMoneyCents(name: string, fallback: number) {
  return Math.round(envNumber(name, fallback / 100) * 100);
}

function fallbackStoreSettings(): StoreSettings {
  const configuredMode = process.env.DELIVERY_PRICING_MODE?.toUpperCase();
  return {
    ...DEFAULT_STORE_SETTINGS,
    latitude: envNumber("STORE_LATITUDE", DEFAULT_STORE_SETTINGS.latitude),
    longitude: envNumber("STORE_LONGITUDE", DEFAULT_STORE_SETTINGS.longitude),
    deliveryPricingMode: configuredMode === "PER_KM" ? "PER_KM" : "FIXED",
    baseDeliveryFeeCents: envMoneyCents("DELIVERY_BASE_FEE", DEFAULT_STORE_SETTINGS.baseDeliveryFeeCents),
    includedDistanceKm: envNumber("DELIVERY_INCLUDED_KM", DEFAULT_STORE_SETTINGS.includedDistanceKm),
    additionalFeePerKmCents: envMoneyCents("DELIVERY_PRICE_PER_KM", DEFAULT_STORE_SETTINGS.additionalFeePerKmCents),
    maxDeliveryDistanceKm: envNumber("DELIVERY_MAX_KM", DEFAULT_STORE_SETTINGS.maxDeliveryDistanceKm),
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!isDatabaseConfigured()) return fallbackStoreSettings();

  try {
    const settings = await prisma.storeSettings.findUnique({ where: { id: "main" } });
    if (!settings) return fallbackStoreSettings();
    return {
      street: settings.street,
      number: settings.number,
      district: settings.district,
      city: settings.city,
      state: settings.state,
      formattedAddress: settings.formattedAddress,
      latitude: settings.latitude,
      longitude: settings.longitude,
      deliveryPricingMode: settings.deliveryPricingMode === "PER_KM" ? "PER_KM" : "FIXED",
      baseDeliveryFeeCents: settings.baseDeliveryFeeCents,
      includedDistanceKm: settings.includedDistanceKm,
      additionalFeePerKmCents: settings.additionalFeePerKmCents,
      maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm,
    };
  } catch (error) {
    console.error("Store settings error", error instanceof Error ? error.name : "unknown");
    return fallbackStoreSettings();
  }
}

export async function getStoreLocation(): Promise<StoreLocation> {
  const settings = await getStoreSettings();
  return {
    street: settings.street,
    number: settings.number,
    district: settings.district,
    city: settings.city,
    state: settings.state,
    formattedAddress: settings.formattedAddress,
    latitude: settings.latitude,
    longitude: settings.longitude,
  };
}
