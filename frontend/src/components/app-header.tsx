import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandMark } from "@/components/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser, getSignInState } from "@/lib/data";

/**
 * Global header for signed-in pages.
 *
 * The avatar menu is the account surface: profile and sign-out when there's a
 * real Auth0 session, sign-in when there isn't. Both routes are mounted by the
 * Auth0 SDK, so these are plain links rather than actions — sign-out has to
 * clear the session cookie and bounce through the tenant, which a client-side
 * handler can't do.
 */
export async function AppHeader() {
  const [user, { signedIn }] = await Promise.all([
    getCurrentUser(),
    getSignInState(),
  ]);

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

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Avatar className="size-9 border-2 border-primary/20">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              {/* Base UI ties the label to its group, so the two travel together. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
                <DropdownMenuItem render={<Link href="/profile" />}>
                  <UserRound />
                  Your profile
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {signedIn ? (
                <DropdownMenuItem
                  variant="destructive"
                  render={<a href="/auth/logout" />}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem render={<a href="/auth/login" />}>
                  <LogIn />
                  Sign in
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
