import { NextResponse } from "next/server";
import { calculateDeliveryQuote, DeliveryError } from "@/lib/delivery";
import { deliveryQuoteRequestSchema } from "@/lib/order-schema";

export async function POST(request: Request) {
  try {
    const payload = deliveryQuoteRequestSchema.parse(await request.json());
    const quote = await calculateDeliveryQuote(payload);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Informe uma localização válida para calcular a entrega." },
      { status: 400 },
    );
  }
}
