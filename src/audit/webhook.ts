import { buildEventPayload, signPayload, type AuditEventRecord } from "./events";

/**
 * Emit a workflow event to the outbound (Zapier) webhook, if configured. The
 * payload is NON-PII (see buildEventPayload) and HMAC-signed so the consumer can
 * verify authenticity. Fire-and-forget: failures are logged, never thrown, so a
 * downstream outage can't break the payment journey. If ZAPIER_WEBHOOK_URL is
 * unset, this is a no-op stub (logs in dev).
 */
export async function emitEvent(event: AuditEventRecord): Promise<void> {
  const url = process.env.ZAPIER_WEBHOOK_URL;
  const payload = buildEventPayload(event);
  if (!url) {
    console.log(`[webhook:stub] ${payload.type} (${payload.id})`);
    return;
  }
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (secret) headers["x-noctua-signature"] = signPayload(body, secret);

  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) console.error(`[webhook] ${payload.type} failed: ${res.status}`);
  } catch (err) {
    console.error(`[webhook] ${payload.type} error:`, err);
  }
}
