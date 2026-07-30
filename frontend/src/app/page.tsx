import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Code2,
  Dumbbell,
  Flame,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { getOptionalSession } from "@/lib/auth0";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const FLOW = [
  {
    number: "01",
    title: "Make the pact",
    body: "Create a challenge, invite your people, and choose what a missed day is worth.",
  },
  {
    number: "02",
    title: "Show the work",
    body: "Submit a link or note. The agent checks the proof and gives a clear verdict.",
  },
  {
    number: "03",
    title: "Keep your word",
    body: "Streaks climb when you deliver. Misses create a payment you approve yourself.",
  },
];

const MEMBERS = [
  { initials: "P", name: "Phong", streak: "5 days", status: "Done" },
  { initials: "A", name: "Alex", streak: "3 days", status: "Done" },
  { initials: "S", name: "Sam", streak: "0 days", status: "Missed" },
];

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getOptionalSession();

  if (session) {
    redirect("/groups");
  }

  return (
    <main id="main-content" className="landing-shell min-h-dvh overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>

      <div className="landing-grid" aria-hidden />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="WIP AI home"
        >
          <BrandMark className="rounded-lg shadow-[3px_3px_0_var(--foreground)]" />
          <span className="font-heading text-base font-bold tracking-[-0.03em]">
            WIP AI
          </span>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Primary navigation">
          <Button
            variant="ghost"
            size="lg"
            className="hidden sm:inline-flex"
            render={<Link href="/join/BUILD30" />}
          >
            Join with a code
          </Button>
          <Button
            size="lg"
            className="rounded-xl px-4 shadow-[3px_3px_0_var(--foreground)] hover:-translate-y-0.5 hover:bg-primary active:translate-y-px"
            render={<a href="/auth/login" />}
          >
            Sign in
            <ArrowRight data-icon="inline-end" />
          </Button>
        </nav>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:px-10 lg:pb-28 lg:pt-24">
        <div className="hero-copy">
          <Badge
            variant="outline"
            className="h-8 gap-2 rounded-full border-foreground/20 bg-background/70 px-3 font-mono text-[11px] uppercase tracking-[0.12em] backdrop-blur"
          >
            <span className="size-2 rounded-full bg-verified" aria-hidden />
            Do it or get WIPped
          </Badge>

          <h1 className="mt-7 max-w-3xl text-[clamp(3.4rem,8vw,6.9rem)] leading-[0.88] tracking-[-0.075em]">
            Lock in.
            <br />
            Or get <span className="hero-underline">exposed.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Your group chat talks big. WIP AI brings receipts. Do the
            commitment or take the penalty—AI checks the proof and keeps score.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="xl"
              className="rounded-xl shadow-[4px_4px_0_var(--foreground)] transition-transform hover:-translate-y-1 hover:bg-primary active:translate-y-px"
              render={<a href="/auth/login" />}
            >
              Start a challenge
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="rounded-xl border-foreground/20 bg-background/70"
              render={<Link href="/join/BUILD30" />}
            >
              Try the demo group
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground">
            <AvatarGroup aria-label="Demo group members">
              {["P", "A", "S"].map((initial, index) => (
                <Avatar key={initial} className="size-9" size="lg">
                  <AvatarFallback
                    className={
                      index === 2
                        ? "bg-flame text-flame-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <p>
              One group. One daily promise.
              <br />
              <span className="font-semibold text-foreground">
                Everyone sees the score.
              </span>
            </p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:mx-0">
          <div className="chaos-sticker absolute -left-10 top-16 z-20 hidden -rotate-12 rounded-xl border-2 border-foreground bg-flame px-3 py-2 font-mono text-xs font-black uppercase text-flame-foreground shadow-[4px_4px_0_var(--foreground)] sm:block">
            no cap
          </div>
          <div className="absolute -right-6 -top-8 hidden rotate-6 rounded-full border-2 border-foreground bg-signal px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-signal-foreground shadow-[4px_4px_0_var(--foreground)] sm:block">
            aura on the line
          </div>

          <div className="product-window relative rounded-[2rem] border-2 border-foreground bg-card p-3 shadow-[10px_12px_0_var(--foreground)] sm:p-4">
            <div className="flex items-center justify-between px-2 pb-4 pt-1">
              <div className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-flame" />
                <span className="size-2.5 rounded-full bg-signal" />
                <span className="size-2.5 rounded-full bg-verified" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Live group
              </span>
            </div>

            <div className="rounded-[1.35rem] bg-foreground p-5 text-background sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-background/60">
                    Today&apos;s challenge
                  </p>
                  <h2 className="mt-2 max-w-sm text-2xl leading-tight tracking-[-0.04em] sm:text-3xl">
                    Finish 10 push-ups before 5:00 PM.
                  </h2>
                </div>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-signal text-signal-foreground">
                  <Clock3 aria-hidden />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge className="h-7 bg-background/10 px-3 text-background">
                  <CircleDollarSign data-icon="inline-start" />
                  $5 commitment
                </Badge>
                <Badge className="h-7 bg-background/10 px-3 text-background">
                  <Bot data-icon="inline-start" />
                  Agent verified
                </Badge>
              </div>
            </div>

            <div className="px-2 pb-2 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Builder leaderboard
                </p>
                <Trophy aria-hidden className="size-4 text-pending" />
              </div>

              <div className="flex flex-col">
                {MEMBERS.map((member, index) => (
                  <div key={member.name}>
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-muted font-semibold text-foreground">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold">{member.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Flame aria-hidden className="size-3 text-flame" />
                          {member.streak}
                        </p>
                      </div>
                      <Badge
                        variant={
                          member.status === "Done" ? "secondary" : "destructive"
                        }
                        className="gap-1"
                      >
                        {member.status === "Done" ? (
                          <Check aria-hidden />
                        ) : (
                          <CircleDollarSign aria-hidden />
                        )}
                        {member.status}
                      </Badge>
                    </div>
                    {index < MEMBERS.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="agent-verdict absolute -bottom-8 -left-3 flex max-w-[17rem] items-center gap-3 rounded-2xl border-2 border-foreground bg-background p-3 shadow-[5px_5px_0_var(--foreground)] sm:-left-8">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-verified text-verified-foreground">
              <CheckCircle2 aria-hidden />
            </div>
            <div>
              <p className="text-xs font-bold">Proof accepted</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                10 clean reps. Aura restored.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-foreground bg-signal text-signal-foreground">
        <div className="marquee-track flex min-w-max items-center py-3 font-mono text-xs font-bold uppercase tracking-[0.18em]">
          {Array.from({ length: 6 }, (_, copy) => (
            <div key={copy} className="flex items-center" aria-hidden={copy !== 0}>
              {["Make the pact", "Show the work", "Keep your word"].map(
                (item) => (
                  <span key={item} className="flex items-center">
                    <span className="px-8">{item}</span>
                    <Sparkles className="size-4" />
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="chaos-frame relative isolate overflow-hidden rounded-[2.25rem] border-2 border-foreground bg-foreground shadow-[10px_12px_0_var(--primary)]">
          <Image
            src="/accountability-chaos.jpg"
            alt="Friends coding, filming proof, and completing a push-up challenge"
            width={1800}
            height={1125}
            sizes="(max-width: 1280px) 100vw, 1200px"
            className="h-[32rem] w-full object-cover object-center sm:h-[38rem]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/55 to-transparent px-6 pb-7 pt-32 text-white sm:px-10 sm:pb-10">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#c8ff38]">
              live footage of the group chat locking in
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl leading-[0.94] tracking-[-0.06em] sm:text-6xl">
              Receipts or it didn&apos;t happen.
            </h2>
          </div>

          <div className="chaos-sticker absolute left-5 top-5 flex -rotate-6 items-center gap-2 rounded-full border-2 border-black bg-[#c8ff38] px-4 py-2 font-mono text-xs font-black uppercase text-black shadow-[4px_4px_0_#000] sm:left-8 sm:top-8">
            <Dumbbell className="size-4" />
            10 reps detected
          </div>
          <div className="chaos-sticker absolute right-5 top-24 flex rotate-6 items-center gap-2 rounded-full border-2 border-black bg-[#8b5cf6] px-4 py-2 font-mono text-xs font-black uppercase text-white shadow-[4px_4px_0_#000] sm:right-8">
            <Code2 className="size-4" />
            accepted
          </div>
          <div className="chaos-sticker absolute right-7 top-1/2 hidden -rotate-3 items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 font-mono text-xs font-black uppercase text-black shadow-[4px_4px_0_#000] sm:flex">
            <Camera className="size-4" />
            caught in 4K
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Zero yapping required
            </p>
            <h2 className="mt-4 text-4xl leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              Your group chat,
              <br />
              with consequences.
            </h2>
          </div>

          <div className="flex flex-col">
            {FLOW.map((step, index) => (
              <div key={step.number}>
                <article className="grid gap-4 py-7 sm:grid-cols-[4rem_1fr] sm:gap-6">
                  <span className="font-mono text-sm font-bold text-primary">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-2xl tracking-[-0.035em]">{step.title}</h3>
                    <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </article>
                {index < FLOW.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8 lg:px-10 lg:pb-28">
        <div className="cta-panel relative overflow-hidden rounded-[2rem] border-2 border-foreground bg-primary px-6 py-12 text-primary-foreground shadow-[8px_8px_0_var(--foreground)] sm:px-12 sm:py-16">
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground/70">
              <Zap className="size-4" aria-hidden />
              Proof checked · excuses rejected
            </div>
            <h2 className="mt-5 text-4xl leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              The lore starts when somebody folds.
            </h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="xl"
                className="rounded-xl bg-background text-foreground shadow-[4px_4px_0_var(--foreground)] hover:bg-background/90"
                render={<a href="/auth/login" />}
              >
                Start the group lore
                <ArrowRight data-icon="inline-end" />
              </Button>
              <div className="flex items-center gap-2 px-2 text-sm text-primary-foreground/80">
                <ShieldCheck className="size-4" aria-hidden />
                Nothing charges without approval
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-foreground/15">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-2 text-foreground">
            <BrandMark className="size-7 rounded-md" />
            <span className="font-heading font-bold">WIP AI</span>
          </div>
          <p>Make the promise. Show the proof. Keep the streak.</p>
        </div>
      </footer>
    </main>
  );
}
