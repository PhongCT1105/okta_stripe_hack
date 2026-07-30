"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOrigin } from "@/hooks/use-client-only";

/**
 * Invite link with copy-to-clipboard.
 *
 * The absolute URL is derived on the client because the origin is not known
 * during server rendering; the code itself renders immediately so the box is
 * never empty.
 */
export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);

  const url = origin ? `${origin}/join/${inviteCode}` : `/join/${inviteCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it manually.");
    }
  }

  async function share() {
    const message = `Join my accountability group on WIP AI: ${url}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "WIP AI", text: message, url });
        return;
      } catch {
        // The user dismissed the share sheet; fall through to copying.
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 p-2 pl-4">
        <code className="numeric flex-1 truncate text-sm text-muted-foreground">
          {url}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copy}
          aria-label="Copy invite link"
        >
          {copied ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={share} className="self-start">
        <Share2 data-icon="inline-start" />
        Share with friends
      </Button>
    </div>
  );
}
