import { z } from "@hono/zod-openapi";

/** The response shape of server/lib/openingHours.ts's OpenState, worked out at request time in New York time. */
export const OpenStateSchema = z
  .object({
    status: z.enum(["open", "closed", "unknown"]),
    until: z.string().nullable().openapi({ description: "When open: when it closes (ISO); null when open around the clock" }),
    opensAt: z.string().nullable().openapi({ description: "When closed: the next opening within a week (ISO), or null" }),
    reason: z.enum(["missing", "stale", "unclear"]).nullable().openapi({ description: "Why the status is unknown: no hours, our copy is over 30 days old, or hours the parser cannot read" }),
  })
  .openapi("OpenState");
