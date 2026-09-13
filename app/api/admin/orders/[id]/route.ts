import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/order-schema";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: unknown };
    const status = orderStatusSchema.parse(body.status);
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
    return NextResponse.json({ order: serializeOrder(order) });
  } catch {
    return NextResponse.json({ error: "Status ou pedido inválido." }, { status: 400 });
  }
}
