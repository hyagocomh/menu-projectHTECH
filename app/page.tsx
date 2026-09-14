import { Storefront } from "@/components/storefront/Storefront";

export default function HomePage() {
  const mapApiKey = process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY ?? "";
  const storeLatitude = Number(process.env.STORE_LATITUDE);
  const storeLongitude = Number(process.env.STORE_LONGITUDE);

  return (
    <Storefront
      geoapifyConfigured={Boolean(process.env.GEOAPIFY_API_KEY && mapApiKey)}
      geoapifyMapKey={mapApiKey}
      storeLatitude={Number.isFinite(storeLatitude) ? storeLatitude : -9.6658}
      storeLongitude={Number.isFinite(storeLongitude) ? storeLongitude : -35.7353}
      whatsappNumber={(process.env.WHATSAPP_NUMBER ?? "5582999627481").replace(/\D/g, "")}
    />
  );
}
