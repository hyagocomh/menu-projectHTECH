import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { storeLocationSchema } from "@/lib/order-schema";
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
    const location = storeLocationSchema.parse(await request.json());
    const settings = await prisma.storeSettings.upsert({
      where: { id: "main" },
      create: { id: "main", ...location },
      update: location,
    });

    return noStore(NextResponse.json({
      location: {
        street: settings.street,
        number: settings.number,
        district: settings.district,
        city: settings.city,
        state: settings.state,
        formattedAddress: settings.formattedAddress,
        latitude: settings.latitude,
        longitude: settings.longitude,
      },
    }));
  } catch {
    return noStore(NextResponse.json(
      { error: "Preencha o endereço e marque um ponto válido no mapa." },
      { status: 400 },
    ));
  }
}
