import { AdminGate } from "@/components/admin/admin-gate";
import { AdminHeader } from "@/components/admin/admin-header";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminGate>
      <div className="admin-shell" style={{ minHeight: "100vh" }}>
        <AdminHeader />
        <div style={{ padding: "1.5rem var(--layout-gutter, 1.5rem)" }}>{children}</div>
      </div>
    </AdminGate>
  );
}
