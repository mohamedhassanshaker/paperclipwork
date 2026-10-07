import { Sidebar } from "@/components/shell/Sidebar";
import { BreadcrumbHeader } from "@/components/shell/BreadcrumbHeader";
import { ToastProvider } from "@/components/ui/Toast";
import { getStubSession } from "@/lib/stub-session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userEmail } = getStubSession();

  return (
    <ToastProvider>
      <div className="grid min-h-screen grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
        <Sidebar userEmail={userEmail} />
        <main className="flex min-w-0 flex-col bg-surface">
          <BreadcrumbHeader />
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
