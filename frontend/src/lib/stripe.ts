import "server-only";

import Stripe from "stripe";
import type { PaymentRequest } from "@/lib/types";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

function appBaseUrl(): string {
  const configured = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return configured.replace(/\/$/, "");
}

function integrationIdentifier(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const suffix = Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (value) => alphabet[value % alphabet.length],
  ).join("");
  return `commitment_agent_${suffix}`;
}

export async function createCommitmentCheckout(
  request: PaymentRequest,
  challengeTitle: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const baseUrl = appBaseUrl();

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: `${baseUrl}/pay/${request.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pay/${request.id}`,
      client_reference_id: request.id,
      integration_identifier: integrationIdentifier(),
      metadata: {
        paymentRequestId: request.id,
        challengeId: request.challengeId,
        userId: request.userId,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: request.amountCents,
            product_data: {
              name: "Missed commitment",
              description: challengeTitle.slice(0, 500),
            },
          },
        },
      ],
    },
    {
      idempotencyKey: `commitment-payment-${request.id}`,
    },
  );
}

/**
 * Checkout for buying credits.
 *
 * This is where Stripe actually sits in the product: members don't reach for a
 * card when they miss a day, they reach for one when they've run their balance
 * down and want to keep playing. The purchase is a normal one-off payment, and
 * the credited amount rides in metadata so the success route can verify what
 * was bought rather than trusting a query parameter.
 */
export async function createTopUpCheckout(
  userId: string,
  amountCents: number,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const baseUrl = appBaseUrl();

  return stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${baseUrl}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/wallet`,
    client_reference_id: userId,
    integration_identifier: integrationIdentifier(),
    metadata: {
      kind: "top_up",
      userId,
      creditCents: String(amountCents),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Commitment credits",
            description: "Credits staked against challenges you commit to.",
          },
        },
      },
    ],
  });
}

/**
 * Confirms a top-up server-side and reports how much to credit.
 *
 * Returns null unless the session is genuinely paid and belongs to this member,
 * so a guessed or replayed session id can't mint credits. The caller is
 * responsible for making the credit itself idempotent.
 */
export interface VerifiedTopUp {
  creditCents: number;
  /** What a later cash-out refunds against. */
  paymentIntentId: string;
}

export async function verifyTopUpCheckout(
  sessionId: string,
  userId: string,
): Promise<VerifiedTopUp | null> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);

  const creditCents = Number(session.metadata?.creditCents);
  const valid =
    session.payment_status === "paid" &&
    session.metadata?.kind === "top_up" &&
    session.metadata?.userId === userId &&
    session.client_reference_id === userId &&
    session.currency === "usd" &&
    Number.isFinite(creditCents) &&
    creditCents > 0 &&
    session.amount_total === creditCents;

  if (!valid) return null;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  return paymentIntentId ? { creditCents, paymentIntentId } : null;
}

/**
 * Sends credits back out through Stripe as a refund.
 *
 * A refund rather than a payout, because the money is going back where it came
 * from: the card that bought these credits. That keeps it inside the original
 * payment — no Connect account, no separate balance to reconcile — and it is a
 * real Stripe transaction, visible in the dashboard alongside the purchase.
 */
export async function refundTopUp(
  paymentIntentId: string,
  amountCents: number,
  userId: string,
): Promise<Stripe.Refund> {
  return getStripe().refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: amountCents,
      metadata: { kind: "cash_out", userId },
    },
    { idempotencyKey: `cash-out-${paymentIntentId}-${amountCents}-${userId}` },
  );
}

export async function verifyCommitmentCheckout(
  sessionId: string,
  request: PaymentRequest,
): Promise<boolean> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);

  return (
    session.payment_status === "paid" &&
    session.client_reference_id === request.id &&
    session.metadata?.paymentRequestId === request.id &&
    session.amount_total === request.amountCents &&
    session.currency === "usd"
  );
}
