import { Storefront } from "@/components/storefront/Storefront";

export default function HomePage() {
  return (
    <Storefront
      mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
      mapsMapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
      whatsappNumber={(process.env.WHATSAPP_NUMBER ?? "5582999627481").replace(/\D/g, "")}
    />
  );
}
