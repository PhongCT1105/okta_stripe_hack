import { auth0 } from "@/lib/auth0";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-50">
        <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <p className="mb-2 text-sm font-medium text-zinc-400">
            okta_stripe_hack
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign in to continue
          </h1>
          <div className="mt-8 flex gap-3">
            <a
              className="rounded-lg bg-white px-4 py-2.5 font-medium text-zinc-950"
              href="/auth/login"
            >
              Log in
            </a>
            <a
              className="rounded-lg border border-zinc-700 px-4 py-2.5 font-medium"
              href="/auth/login?screen_hint=signup"
            >
              Sign up
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-50">
      <section className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">Authenticated as</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {session.user.email ?? session.user.name}
            </h1>
          </div>
          <a
            className="rounded-lg border border-zinc-700 px-4 py-2 font-medium"
            href="/auth/logout"
          >
            Log out
          </a>
        </div>
        <pre className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-300">
          {JSON.stringify(session.user, null, 2)}
        </pre>
      </section>
    </main>
  );
}
