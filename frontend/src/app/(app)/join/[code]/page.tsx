import Link from "next/link";
import { Users } from "lucide-react";
import { JoinGroupForm } from "@/components/join-group-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getGroupByInviteCode, getLeaderboard } from "@/lib/data";

/** Invite landing. Shows who's already in before asking for a commitment. */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);

  if (!group) {
    return (
      <div className="mx-auto max-w-xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>That invite didn&apos;t work</EmptyTitle>
            <EmptyDescription>
              {`No group matches the code "${code}". Ask whoever invited you for a fresh link.`}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" render={<Link href="/groups" />}>
              Go to your groups
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const entries = await getLeaderboard(group.id);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>You&apos;ve been invited to</CardDescription>
          <CardTitle className="text-2xl">{group.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {entries.slice(0, 5).map((entry) => (
                <span
                  key={entry.user.id}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-xs font-bold text-primary"
                  title={entry.user.displayName}
                >
                  {entry.user.initials}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {entries.length === 0
                ? "You'd be the first one in."
                : `${entries.map((e) => e.user.displayName).join(", ")} are already in.`}
            </p>
          </div>

          <div className="rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
            Joining means you take on the group&apos;s daily challenge. If you
            miss one, you&apos;ll be asked to approve a payment — never charged
            automatically.
          </div>

          <JoinGroupForm inviteCode={group.inviteCode} />
        </CardContent>
      </Card>
    </div>
  );
}
