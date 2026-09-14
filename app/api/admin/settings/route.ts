import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { storeSettingsSchema } from "@/lib/order-schema";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function PATCH(request: Request) {
  if (!await isAdminAuthenticated()) {
    return noStore(NextResponse.json({ error: "Não autorizado." }, { status: 401 }));
  }
  if (!isDatabaseConfigured()) {
    return noStore(NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 }));
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return noStore(NextResponse.json({ error: "Requisição inválida." }, { status: 413 }));
  }

  try {
    const storeSettings = storeSettingsSchema.parse(await request.json());
    const settings = await prisma.storeSettings.upsert({
      where: { id: "main" },
      create: { id: "main", ...storeSettings },
      update: storeSettings,
    });

    return noStore(NextResponse.json({
      settings: {
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
      },
    }));
  } catch {
    return noStore(NextResponse.json(
      { error: "Revise o endereço, o ponto no mapa e os valores da entrega." },
      { status: 400 },
    ));
  }
}
