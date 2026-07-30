import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser, isProfileComplete } from "@/lib/data";
import { INTEREST_OPTIONS } from "@/lib/data";

/**
 * Profile setup and editing.
 *
 * New accounts are sent here before anything else: Auth0 establishes who they
 * are, and this establishes what they're here for. Everything downstream — the
 * groups they join, the people they'd be matched with — reads from it.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  const isFirstRun = !isProfileComplete(user);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-14 border-2 border-primary/20">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary/10 font-bold text-primary">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl">
            {isFirstRun ? "Set up your profile" : "Your profile"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isFirstRun
              ? "One line about what you're chasing, then you're in."
              : "Update how you show up and what you're working toward."}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6 sm:p-8">
        <ProfileForm
          user={user}
          interestOptions={INTEREST_OPTIONS}
          isFirstRun={isFirstRun}
        />
      </div>
    </div>
  );
}
