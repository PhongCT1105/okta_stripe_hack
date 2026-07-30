import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateGroupForm } from "@/components/create-group-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewGroupPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link href="/groups" />}
      >
        <ArrowLeft data-icon="inline-start" />
        Back to groups
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Start a group</CardTitle>
          <CardDescription>
            You&apos;ll be the organizer. Invite friends once it exists, then set
            the first challenge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateGroupForm />
        </CardContent>
      </Card>
    </div>
  );
}
