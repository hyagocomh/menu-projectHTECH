import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ cep: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const { cep: rawCep } = await params;
  const cep = rawCep.replace(/\D/g, "");

  if (!/^\d{8}$/.test(cep)) {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) throw new Error("ViaCEP indisponível");

    const address = (await response.json()) as {
      erro?: boolean;
      cep?: string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };

    if (address.erro) {
      return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      postalCode: address.cep ?? cep,
      street: address.logradouro ?? "",
      district: address.bairro ?? "",
      city: address.localidade ?? "",
      state: address.uf ?? "",
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar o CEP agora." },
      { status: 502 },
    );
  }
}
