import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/auth";

export const metadata = { title: "Entrar no painel" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return <AdminLogin configured={isAdminConfigured()} />;
}
