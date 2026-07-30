"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server tree once after mounting.
 *
 * The router keeps the layout it already rendered when you navigate between
 * routes that share it, so anything the layout displays goes stale after a
 * mutation elsewhere — the header's credit balance being the obvious one. A
 * page that changes a balance while rendering has no way to call
 * `revalidatePath`, so it asks the router for a fresh tree instead.
 */
export function RefreshOnMount() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}
