import "server-only";

import type { Order, OrderItem } from "@/generated/prisma/client";

export type SerializedOrder = Omit<Order, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export function serializeOrder(
  order: Order & { items: OrderItem[] },
): SerializedOrder {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
