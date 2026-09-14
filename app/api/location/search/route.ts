import { NextResponse } from "next/server";
import { GeoapifyError, searchGeoapifyAddress } from "@/lib/geoapify";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").normalize("NFKC").trim().slice(0, 180);
  const autocomplete = searchParams.get("mode") !== "geocode";

  if (query.length < 3) {
    return noStore(NextResponse.json({ error: "Digite pelo menos 3 caracteres." }, { status: 400 }));
  }

  try {
    const locations = await searchGeoapifyAddress(query, autocomplete);
    return noStore(NextResponse.json({ locations }));
  } catch (error) {
    if (error instanceof GeoapifyError) {
      return noStore(NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      ));
    }

    return noStore(NextResponse.json(
      { error: "Não foi possível buscar o endereço." },
      { status: 500 },
    ));
  }
}
