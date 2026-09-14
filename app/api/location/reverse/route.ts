import { NextResponse } from "next/server";
import { GeoapifyError, reverseGeoapifyAddress } from "@/lib/geoapify";
import { deliveryQuoteRequestSchema } from "@/lib/order-schema";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");
  if (latitude === null || longitude === null) {
    return noStore(NextResponse.json({ error: "Localização inválida." }, { status: 400 }));
  }
  const parsed = deliveryQuoteRequestSchema.safeParse({
    latitude: Number(latitude),
    longitude: Number(longitude),
  });

  if (!parsed.success) {
    return noStore(NextResponse.json({ error: "Localização inválida." }, { status: 400 }));
  }

  try {
    const location = await reverseGeoapifyAddress(
      parsed.data.latitude,
      parsed.data.longitude,
    );
    if (!location) {
      return noStore(NextResponse.json(
        { error: "Não encontramos um endereço nesse ponto." },
        { status: 404 },
      ));
    }
    return noStore(NextResponse.json({ location }));
  } catch (error) {
    if (error instanceof GeoapifyError) {
      return noStore(NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      ));
    }

    return noStore(NextResponse.json(
      { error: "Não foi possível identificar o endereço." },
      { status: 500 },
    ));
  }
}
