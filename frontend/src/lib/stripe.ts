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
