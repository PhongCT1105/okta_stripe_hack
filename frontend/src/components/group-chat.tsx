"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { sendMessage, summonAgent, type ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { ChatMessage, User } from "@/lib/types";

/**
 * The group chat, and the agent's way in.
 *
 * This is where a commitment starts as loose talk. The agent doesn't watch the
 * thread — someone summons it, it reads what's been said, and proposes. Keeping
 * the trigger explicit means the group is never surprised by a proposal, and
 * the model runs once per ask rather than once per keystroke.
 */
export function GroupChat({
  groupId,
  messages,
  members,
  currentUserId,
  canSummon,
}: {
  groupId: string;
  messages: ChatMessage[];
  members: User[];
  currentUserId: string;
  canSummon: boolean;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sendState, sendAction, sending] = useActionState<
    ActionResult | null,
    FormData
  >(sendMessage, null);
  const [summonState, summonAction, summoning] = useActionState<
    ActionResult | null,
    FormData
  >(summonAgent, null);

  // Other members post from their own browsers, so the server is the only
  // source of truth for what's been said. Re-fetching on an interval keeps the
  // thread live without a socket — enough for a group of this size.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const nameFor = (userId: string | null) =>
    members.find((m) => m.id === userId)?.displayName ?? "Someone";
  const avatarFor = (userId: string | null) =>
    members.find((m) => m.id === userId);

  const error = sendState?.error || summonState?.error;

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="font-heading font-bold">Group chat</h2>
        <p className="text-xs text-muted-foreground">
          Talk it through, then let the agent turn it into a commitment.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-96 min-h-64 flex-col gap-3 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
            Nothing here yet. Say what you&apos;re trying to do and who&apos;s in.
          </p>
        ) : null}

        {messages.map((message) => {
          const isAgent = message.role === "agent";
          const isMine = message.userId === currentUserId;
          const author = avatarFor(message.userId);

          if (isAgent) {
            return (
              <div
                key={message.id}
                className="flex gap-2.5 rounded-2xl bg-primary/8 p-3"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles aria-hidden className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-primary">Agent</p>
                  <p className="text-sm leading-relaxed">{message.body}</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={cn("flex gap-2.5", isMine && "flex-row-reverse")}
            >
              <Avatar className="mt-0.5 size-7 shrink-0">
                {author?.avatarUrl ? (
                  <AvatarImage src={author.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="bg-muted text-[10px] font-bold">
                  {author?.initials ?? "??"}
                </AvatarFallback>
              </Avatar>
              <div className={cn("min-w-0 max-w-[80%]", isMine && "text-right")}>
                <p className="text-xs font-semibold text-muted-foreground">
                  {isMine ? "You" : nameFor(message.userId)}
                </p>
                <p
                  className={cn(
                    "inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {message.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 border-t p-3">
        {error ? (
          <p className="px-1 text-sm font-medium text-destructive">{error}</p>
        ) : null}

        <form action={sendAction} className="flex gap-2">
          <input type="hidden" name="groupId" value={groupId} />
          <Input
            name="body"
            placeholder="Say something…"
            autoComplete="off"
            aria-label="Message"
          />
          <Button type="submit" size="icon" disabled={sending} aria-label="Send">
            {sending ? <Spinner /> : <Send />}
          </Button>
        </form>

        {canSummon ? (
          <form action={summonAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={summoning}
            >
              {summoning ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Agent is reading the chat…
                </>
              ) : (
                <>
                  <Sparkles data-icon="inline-start" />
                  Ask the agent for a challenge
                </>
              )}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
