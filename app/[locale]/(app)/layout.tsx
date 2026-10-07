import { Sidebar } from "@/components/shell/Sidebar";
import { BreadcrumbHeader } from "@/components/shell/BreadcrumbHeader";
import { ToastProvider } from "@/components/ui/Toast";
import { auth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts already redirects unauthenticated requests before this
  // layout renders, so session is guaranteed here — but never assume that
  // invariant holds for the user-facing string itself.
  const session = await auth();
  const userEmail = session?.user?.email ?? "";

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
