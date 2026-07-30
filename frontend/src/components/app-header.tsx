import Link from "next/link";
import { LogIn, LogOut, UserRound, Wallet } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import {
  getCurrentUser,
  getGroupsForUser,
  getSignInState,
  getWalletBalance,
} from "@/lib/data";

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
  const [balance, groups] = await Promise.all([
    getWalletBalance(user.id),
    getGroupsForUser(user.id),
  ]);

  // "Home" is wherever the challenge is. For the common case — one group — the
  // list in between is a page with a single row on it, so the mark skips it and
  // goes straight to the group. With none or several, the list is the answer.
  const homeHref = groups.length === 1 ? `/groups/${groups[0].id}` : "/groups";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandMark />
          <span className="font-heading text-lg font-extrabold tracking-tight">
            WIP AI
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Sits in the header on purpose: watching the balance drop the
              moment a day is missed is the whole point of staking. */}
          <Link
            href="/wallet"
            className="numeric rounded-full bg-muted px-3 py-1.5 text-sm font-bold transition-colors hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="sr-only">Credit balance: </span>
            {formatMoney(balance)}
          </Link>
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
                <DropdownMenuItem render={<Link href="/wallet" />}>
                  <Wallet />
                  Credits
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
