import { notFound } from "next/navigation";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeProposal } from "@/components/challenge-proposal";
import { GroupChat } from "@/components/group-chat";
import { InviteLink } from "@/components/invite-link";
import { Leaderboard } from "@/components/leaderboard";
import { StakeDashboard } from "@/components/stake-dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getActiveChallenge,
  getChatMessages,
  getCurrentRound,
  getCurrentUser,
  getGroup,
  getLeaderboard,
  getMembership,
  getParticipants,
  getProposedChallenge,
  getStakeSummary,
} from "@/lib/data";

/** Members must start a challenge before it binds anyone. Keep in sync with actions.ts. */
const MEMBERS_REQUIRED_TO_START = 2;

/** The group dashboard — the screen the demo spends most of its time on. */
export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  const group = await getGroup(groupId);
  if (!group) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(groupId, user.id);
  if (!membership) notFound();

  const [active, proposed, entries, messages] = await Promise.all([
    getActiveChallenge(groupId),
    getProposedChallenge(groupId),
    getLeaderboard(groupId),
    getChatMessages(groupId),
  ]);

  const challenge = active ?? proposed;
  const participants = challenge ? await getParticipants(challenge.id) : [];
  const stakes = await getStakeSummary(active);
  const round = active ? getCurrentRound(active) : null;

  const you = entries.find((entry) => entry.user.id === user.id) ?? null;
  const members = entries.map((entry) => entry.user);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl">{group.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {`${entries.length} member${entries.length === 1 ? "" : "s"} holding each other to it.`}
        </p>
      </div>

      {active ? (
        <>
          <ChallengeCard
            challenge={active}
            submission={you?.submission ?? null}
            paymentRequest={you?.paymentRequest ?? null}
            round={round}
            stakeCents={you?.participant?.stakeCents ?? null}
          />
          <StakeDashboard
            participantCount={stakes.participantCount}
            potCents={stakes.potCents}
            atRiskCents={stakes.atRiskCents}
            collectedCents={stakes.collectedCents}
            round={round}
            durationDays={active.durationDays}
          />
        </>
      ) : proposed ? (
        <ChallengeProposal
          challenge={proposed}
          participants={participants}
          members={members}
          currentUserId={user.id}
          membersRequired={MEMBERS_REQUIRED_TO_START}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <GroupChat
          groupId={group.id}
          messages={messages}
          members={members}
          currentUserId={user.id}
          canSummon={!active}
        />

        {entries.length > 0 ? (
          <Leaderboard entries={entries} currentUserId={user.id} />
        ) : null}
      </div>

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
