/**
 * Server-side tunables read from the environment.
 *
 * Lives outside actions.ts because that file is `"use server"` — every export
 * there has to be an async function, so a plain constant can't be shared from
 * it. Both the action that enforces a rule and the page that describes it read
 * from here, so the copy on screen can't drift from the rule itself.
 */

/**
 * How many members must stake before a proposal becomes a live challenge.
 *
 * Two by default, because a commitment nobody else made isn't accountability.
 * Set it to 1 to walk the whole loop solo — stake, miss, pay — without needing
 * a second identity just to reach the Stripe payment screen.
 */
export const MEMBERS_REQUIRED_TO_START = Math.max(
  1,
  Number(process.env.MEMBERS_REQUIRED_TO_START) || 2,
);
