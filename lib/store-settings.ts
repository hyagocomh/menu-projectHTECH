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

const DEFAULT_STORE_LOCATION: StoreLocation = {
  street: "Rua São Jorge",
  number: "20",
  district: "Barro Duro",
  city: "Maceió",
  state: "AL",
  formattedAddress: "Rua São Jorge, 20 - Barro Duro, Maceió - AL",
  latitude: -9.6192548,
  longitude: -35.7153547,
};

function envCoordinate(name: "STORE_LATITUDE" | "STORE_LONGITUDE", fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function fallbackStoreLocation(): StoreLocation {
  return {
    ...DEFAULT_STORE_LOCATION,
    latitude: envCoordinate("STORE_LATITUDE", DEFAULT_STORE_LOCATION.latitude),
    longitude: envCoordinate("STORE_LONGITUDE", DEFAULT_STORE_LOCATION.longitude),
  };
}

export async function getStoreLocation(): Promise<StoreLocation> {
  if (!isDatabaseConfigured()) return fallbackStoreLocation();

  try {
    const settings = await prisma.storeSettings.findUnique({ where: { id: "main" } });
    if (!settings) return fallbackStoreLocation();
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
  } catch (error) {
    console.error("Store settings error", error instanceof Error ? error.name : "unknown");
    return fallbackStoreLocation();
  }
}
