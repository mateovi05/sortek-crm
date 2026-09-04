import { z } from "zod";

export const platformWorkspaceIdInput = z.object({
	organizationId: z.string().uuid(),
});

export const platformCreateBusinessInput = z.object({
	name: z.string().trim().min(2).max(96),
	slug: z
		.string()
		.trim()
		.min(2)
		.max(48)
		.regex(/^[a-z0-9-]+$/),
	adminEmail: z.email(),
});

export const platformContactCreateInput = z.object({
	organizationId: z.string().uuid(),
	firstName: z.string().trim().min(1).max(96),
	lastName: z.string().trim().max(96).optional(),
	email: z.email().optional(),
	phone: z.string().trim().min(5).max(32).optional(),
	source: z
		.enum(["MANUAL", "WHATSAPP", "PHONE_AGENT", "TICKETING", "IMPORT"])
		.default("MANUAL"),
});

export const platformCallCreateInput = z.object({
	organizationId: z.string().uuid(),
	contactId: z.string().cuid(),
	direction: z.enum(["inbound", "outbound"]),
	outcome: z.string().trim().max(120).optional(),
	notes: z.string().trim().max(4_000).optional(),
	startedAt: z.iso.datetime(),
	durationSeconds: z.number().int().nonnegative().max(86_400).optional(),
});

export const platformOpportunityCreateInput = z.object({
	organizationId: z.string().uuid(),
	contactId: z.string().cuid(),
	eventId: z.string().cuid().optional(),
	stageId: z.string().cuid(),
	quantity: z.number().int().positive().max(10_000).optional(),
	amountCents: z.number().int().nonnegative().optional(),
	currency: z.string().length(3).default("EUR"),
});

export const platformPipelineStageCreateInput = z.object({
	organizationId: z.string().uuid(),
	key: z
		.string()
		.trim()
		.min(2)
		.max(48)
		.regex(/^[a-z0-9-]+$/),
	label: z.string().trim().min(1).max(96),
	position: z.number().int().min(0).max(999),
	isClosed: z.boolean().default(false),
	isWon: z.boolean().default(false),
});

export const platformMoveOpportunityInput = z.object({
	organizationId: z.string().uuid(),
	opportunityId: z.string().cuid(),
	stageId: z.string().cuid(),
	lostReason: z.string().trim().max(500).optional(),
});

export const platformFollowUpCreateInput = z.object({
	organizationId: z.string().uuid(),
	opportunityId: z.string().cuid(),
	dueAt: z.iso.datetime(),
	message: z.string().trim().max(1_000).optional(),
	approvedToContact: z.boolean().default(false),
	approvedToSend: z.boolean().default(false),
});

/** Private n8n endpoint: atomically claim due, approved follow-ups before delivery. */
export const platformFollowUpClaimInput = z.object({
	organizationId: z.string().uuid(),
	limit: z.number().int().min(1).max(100).default(25),
});

/** Private n8n endpoint: persist the result after YCloud has attempted delivery. */
export const platformFollowUpResultInput = z.object({
	organizationId: z.string().uuid(),
	followUpId: z.string().cuid(),
	status: z.enum(["SENT", "FAILED"]),
	providerMessageId: z.string().trim().min(1).max(191).optional(),
	failureReason: z.string().trim().max(1_000).optional(),
});

export const platformWhatsappEventInput = z.object({
	organizationId: z.string().uuid(),
	externalEventId: z.string().trim().min(1).max(191),
	conversationId: z.string().trim().min(1).max(191),
	providerMessageId: z.string().trim().min(1).max(191),
	direction: z.enum(["INBOUND", "OUTBOUND"]),
	phone: z.string().trim().min(5).max(32),
	contactName: z.string().trim().max(191).optional(),
	body: z.string().max(8_000).optional(),
	kind: z.string().trim().max(40).default("text"),
	payload: z.record(z.string(), z.unknown()).optional(),
	occurredAt: z.iso.datetime(),
});

/** Private ticketing webhook. A repeated organizationId/externalId is idempotent. */
export const platformTicketOrderInput = z.object({
	organizationId: z.string().uuid(),
	externalId: z.string().trim().min(1).max(191),
	phone: z.string().trim().min(5).max(32),
	contactName: z.string().trim().max(191).optional(),
	eventId: z.string().cuid().optional(),
	quantity: z.number().int().positive().max(10_000).default(1),
	amountCents: z.number().int().nonnegative(),
	currency: z.string().length(3).default("EUR"),
	status: z.enum(["PENDING", "PAID", "REFUNDED", "CANCELLED"]),
	paidAt: z.iso.datetime().optional(),
	payload: z.record(z.string(), z.unknown()).optional(),
});

export const platformListInput = z.object({
	organizationId: z.string().uuid(),
	limit: z.number().int().min(1).max(100).default(50),
});

export const okOutput = z.object({ ok: z.literal(true) });
