import { AppHeader } from "@/components/app-header";

/**
 * Shell for signed-in routes.
 *
 * Once Auth0 is wired this is where the session check belongs — redirecting
 * to login here protects every route in the group at once.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
