import { Storefront } from "@/components/storefront/Storefront";
import { getStoreLocation } from "@/lib/store-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const mapApiKey = process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY ?? "";
  const store = await getStoreLocation();

  return (
    <Storefront
      geoapifyConfigured={Boolean(process.env.GEOAPIFY_API_KEY && mapApiKey)}
      geoapifyMapKey={mapApiKey}
      storeLatitude={store.latitude}
      storeLongitude={store.longitude}
      whatsappNumber={(process.env.WHATSAPP_NUMBER ?? "5582999627481").replace(/\D/g, "")}
    />
  );
}
