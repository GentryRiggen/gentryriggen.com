import type { Metadata } from "next";
import AdminGate from "@/components/admin/AdminGate";

export const metadata: Metadata = {
  title: "Admin | Gentry Riggen",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminGate />;
}
