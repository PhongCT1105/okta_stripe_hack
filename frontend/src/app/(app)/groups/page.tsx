import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { StreakBadge } from "@/components/streak-badge";
import {
  getCurrentUser,
  getGroupsForUser,
  getLeaderboard,
  isProfileComplete,
} from "@/lib/data";

export default async function GroupsPage() {
  const user = await getCurrentUser();

  // This is where every login lands, so it's the one place that has to catch a
  // half-finished account. Gating here rather than in the layout keeps it to a
  // single redirect site with no chance of a loop against /profile itself.
  if (!isProfileComplete(user)) redirect("/profile");

  const groups = await getGroupsForUser(user.id);

  const cards = await Promise.all(
    groups.map(async (group) => ({
      group,
      entries: await getLeaderboard(group.id),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Your groups</h1>
          <p className="mt-1 text-muted-foreground">
            {`Welcome back, ${user.displayName}.`}
          </p>
        </div>
        <Button size="lg" render={<Link href="/groups/new" />}>
          <Plus data-icon="inline-start" />
          New group
        </Button>
      </div>

      {cards.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>
              Start one and invite the friends you want to be accountable to.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" render={<Link href="/groups/new" />}>
              Create your first group
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ group, entries }) => {
            const you = entries.find((e) => e.user.id === user.id);
            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group rounded-3xl border border-border/70 bg-card p-5 transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg leading-snug">{group.name}</h2>
                  {you ? <StreakBadge streak={you.member.streak} /> : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {entries.slice(0, 4).map((entry) => (
                      <span
                        key={entry.user.id}
                        className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-xs font-bold text-primary"
                      >
                        {entry.user.initials}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {`${entries.length} member${entries.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
