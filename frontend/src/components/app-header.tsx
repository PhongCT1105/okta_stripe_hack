import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandMark } from "@/components/brand-mark";
import { getCurrentUser } from "@/lib/data";

/**
 * Global header for signed-in pages.
 *
 * The avatar is where the Auth0 session surfaces once wired — until then it
 * reads from the seeded current user through the same accessor.
 */
export async function AppHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/groups"
          className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandMark />
          <span className="font-heading text-lg font-extrabold tracking-tight">
            Commitment Agent
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            {user.displayName}
          </span>
          <Avatar className="size-9 border-2 border-primary/20">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
