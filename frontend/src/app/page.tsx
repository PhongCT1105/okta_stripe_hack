import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { getOptionalSession } from "@/lib/auth0";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    Icon: Sparkles,
    title: "Commit together",
    body: "Set one shared daily challenge for the group, or let the agent pick one.",
  },
  {
    Icon: ShieldCheck,
    title: "Prove it",
    body: "Submit a link or a note. The agent rules on it and explains why.",
  },
  {
    Icon: CreditCard,
    title: "Follow through",
    body: "Miss it and you owe the group. You approve every payment yourself.",
  },
];

/**
 * Rendered per request, never prerendered: the response depends on whether the
 * visitor has a session, which isn't knowable at build time.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Null until Auth0 credentials are provisioned, so the landing page still
  // renders during development. Signed-in users skip straight to their groups.
  const session = await getOptionalSession();

  if (session) {
    redirect("/groups");
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-heading text-lg font-extrabold tracking-tight">
            Commitment Agent
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-flame/12 px-3 py-1 text-sm font-bold text-flame">
              <Flame aria-hidden className="size-4" />
              Accountability that actually costs something
            </span>

            <h1 className="mt-5 text-4xl leading-[1.05] sm:text-6xl">
              Your group chat forgets.
              <br />
              <span className="text-primary">This doesn&apos;t.</span>
            </h1>

            <p className="mt-5 max-w-prose text-lg leading-relaxed text-muted-foreground">
              Make a daily commitment with your friends. An AI agent checks the
              proof, keeps the leaderboard honest, and turns a missed day into a
              real payment — one you approve yourself.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="xl" render={<Link href="/auth/login" />}>
                <ShieldCheck data-icon="inline-start" />
                Continue with Auth0
              </Button>
              <Button
                size="xl"
                variant="ghost"
                render={<Link href="/join/BUILD30" />}
              >
                I have an invite code
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Payments run in Stripe test mode. Nothing is charged without your
              explicit approval.
            </p>
          </div>
        </section>

        <section className="grid gap-4 pb-12 sm:grid-cols-3">
          {STEPS.map(({ Icon, title, body }, index) => (
            <div
              key={title}
              className="rounded-3xl border border-border/70 bg-card p-5"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden className="size-5" />
              </div>
              <h2 className="mt-4 flex items-baseline gap-2 text-lg">
                <span className="numeric text-sm text-muted-foreground">
                  0{index + 1}
                </span>
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
