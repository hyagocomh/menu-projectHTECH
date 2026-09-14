import { redirect } from "next/navigation";
import { OrderBoard } from "@/components/admin/OrderBoard";
import { isAdminAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { getStoreLocation } from "@/lib/store-settings";

export const metadata = { title: "Painel de pedidos" };
export const dynamic = "force-dynamic";

async function loadOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" as const },
      take: 100,
    });
    return { orders: orders.map(serializeOrder), error: "" };
  } catch (error) {
    console.error("Admin orders error", error);
    return {
      orders: [],
      error: "Não foi possível ler os pedidos. Confira a conexão e execute a migração do banco.",
    };
  }
}

export default async function AdminPage() {
  if (!await isAdminAuthenticated()) redirect("/admin/login");

  const storeLocation = await getStoreLocation();
  const databaseConfigured = isDatabaseConfigured();
  const geoapifyMapKey = process.env.NEXT_PUBLIC_GEOAPIFY_MAP_KEY ?? "";
  const dashboardProps = {
    initialStoreLocation: storeLocation,
    storeSettingsWritable: databaseConfigured,
    geoapifyConfigured: Boolean(process.env.GEOAPIFY_API_KEY && geoapifyMapKey),
    geoapifyMapKey,
  };

  if (!databaseConfigured) {
    return <OrderBoard {...dashboardProps} initialOrders={[]} initialError="Conecte um PostgreSQL e defina DATABASE_URL na Vercel." />;
  }

  const result = await loadOrders();
  return <OrderBoard {...dashboardProps} initialOrders={result.orders} initialError={result.error || undefined} />;
}
