import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { ChallengeCard } from "@/components/challenge-card";
import { CreateChallengeForm } from "@/components/create-challenge-form";
import { InviteLink } from "@/components/invite-link";
import { Leaderboard } from "@/components/leaderboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  getActiveChallenge,
  getCurrentUser,
  getGroup,
  getLeaderboard,
} from "@/lib/data";

/** The group dashboard — the screen the demo spends most of its time on. */
export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  const group = await getGroup(groupId);
  if (!group) notFound();

  const [user, challenge, entries] = await Promise.all([
    getCurrentUser(),
    getActiveChallenge(groupId),
    getLeaderboard(groupId),
  ]);

  const you = entries.find((entry) => entry.user.id === user.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl">{group.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {`${entries.length} member${entries.length === 1 ? "" : "s"} holding each other to it.`}
        </p>
      </div>

      {challenge ? (
        <ChallengeCard
          challenge={challenge}
          submission={you?.submission ?? null}
          paymentRequest={you?.paymentRequest ?? null}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Set today&apos;s challenge</CardTitle>
            <CardDescription>
              One challenge at a time keeps the group focused.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateChallengeForm groupId={group.id} />
          </CardContent>
        </Card>
      )}

      {entries.length > 0 ? (
        <Leaderboard entries={entries} currentUserId={user.id} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Target />
            </EmptyMedia>
            <EmptyTitle>Nobody here yet</EmptyTitle>
            <EmptyDescription>
              Share the invite link below to get your friends in.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invite your friends</CardTitle>
          <CardDescription>
            {`Anyone with this link can join as a member. Code: ${group.inviteCode}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteLink inviteCode={group.inviteCode} />
        </CardContent>
      </Card>
    </div>
  );
}
