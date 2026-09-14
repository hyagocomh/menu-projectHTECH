import { NextResponse } from "next/server";
import { calculateDeliveryQuote, DeliveryError } from "@/lib/delivery";
import { findProduct, priceToCents } from "@/lib/catalog";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { orderRequestSchema } from "@/lib/order-schema";
import { serializeOrder } from "@/lib/orders";

function createOrderCode() {
  const date = new Date();
  const day = date.toISOString().slice(5, 10).replace("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `MK${day}-${suffix}`;
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "O banco de pedidos ainda não foi configurado pela loja.", code: "DATABASE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const payload = orderRequestSchema.parse(await request.json());
    const catalogItems = payload.items.map((item) => {
      const product = findProduct(item.productId);
      if (!product) throw new Error(`Produto inválido: ${item.productId}`);
      const unitPriceCents = priceToCents(product.price);
      return {
        productId: product.id,
        productName: product.name,
        productImage: product.img,
        unitPriceCents,
        quantity: item.quantity,
        notes: item.notes || null,
        totalCents: unitPriceCents * item.quantity,
      };
    });
    const subtotalCents = catalogItems.reduce((sum, item) => sum + item.totalCents, 0);
    const quote = await calculateDeliveryQuote({
      latitude: payload.address.latitude,
      longitude: payload.address.longitude,
    });

    const order = await prisma.order.create({
      data: {
        code: createOrderCode(),
        customerName: payload.customer.name,
        customerPhone: payload.customer.phone,
        customerEmail: payload.customer.email || null,
        paymentMethod: payload.paymentMethod,
        changeForCents: payload.paymentMethod === "CASH" ? payload.changeForCents : null,
        notes: payload.notes || null,
        street: payload.address.street,
        number: payload.address.number,
        district: payload.address.district,
        city: payload.address.city,
        state: payload.address.state,
        complement: payload.address.complement || null,
        formattedAddress: payload.address.formattedAddress,
        latitude: payload.address.latitude,
        longitude: payload.address.longitude,
        distanceMeters: quote.distanceMeters,
        durationSeconds: quote.durationSeconds,
        subtotalCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        totalCents: subtotalCents + quote.deliveryFeeCents,
        deliveryProvider: "geoapify-routing",
        items: { create: catalogItems },
      },
      include: { items: true },
    });

    return NextResponse.json({ order: serializeOrder(order) }, { status: 201 });
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("Create order error", error);
    const message = error instanceof Error && error.message.startsWith("Produto inválido")
      ? "Um item do carrinho não está mais disponível."
      : "Não foi possível registrar o pedido. Tente novamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
