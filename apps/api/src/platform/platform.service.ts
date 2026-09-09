import {
	CrmConversationStatus,
	CrmFollowUpStatus,
	CrmMessageDirection,
	CrmOrderStatus,
	CrmSource,
	type Db,
	PlatformRole,
	Prisma,
} from "@crm/db";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

type WorkspaceAccess = { organizationId: string; role: string };

function normalizedPhone(phone: string | undefined): string | undefined {
	const value = phone?.replace(/\D/g, "");
	return value || undefined;
}

function json(
	data: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonValue | undefined {
	return data;
}

@Injectable()
export class PlatformService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async listWorkspaces(userId: string) {
		const user = await this.db.user.findUnique({
			where: { id: userId },
			select: { platformRole: true },
		});
		if (user?.platformRole === PlatformRole.PLATFORM_ADMIN) {
			const organizations = await this.db.organization.findMany({
				select: { id: true, name: true, slug: true, createdAt: true },
				orderBy: { createdAt: "asc" },
			});
			return organizations.map((organization) => ({
				role: "platform_admin",
				organization,
			}));
		}
		return this.db.member.findMany({
			where: { userId },
			select: {
				role: true,
				organization: {
					select: { id: true, name: true, slug: true, createdAt: true },
				},
			},
			orderBy: { createdAt: "asc" },
		});
	}

	async globalSummary(userId: string) {
		const actor = await this.db.user.findUnique({
			where: { id: userId },
			select: { platformRole: true },
		});
		if (actor?.platformRole !== PlatformRole.PLATFORM_ADMIN)
			throw new ForbiddenException(
				"Only SORTEK platform administrators can view global metrics.",
			);
		const [workspaces, contacts, opportunities, orders] = await Promise.all([
			this.db.organization.count(),
			this.db.crmContact.count({ where: { archivedAt: null } }),
			this.db.crmOpportunity.count(),
			this.db.crmTicketOrder.aggregate({
				where: { status: CrmOrderStatus.PAID },
				_sum: { amountCents: true },
			}),
		]);
		return {
			workspaces,
			contacts,
			opportunities,
			revenueCents: orders._sum.amountCents ?? 0,
		};
	}

	async createBusiness(
		userId: string,
		input: { name: string; slug: string; adminEmail: string },
	) {
		const actor = await this.db.user.findUnique({
			where: { id: userId },
			select: { platformRole: true },
		});
		if (actor?.platformRole !== PlatformRole.PLATFORM_ADMIN) {
			throw new ForbiddenException(
				"Only SORTEK platform administrators can create businesses.",
			);
		}
		const admin = await this.db.user.findUnique({
			where: { email: input.adminEmail.toLowerCase() },
			select: { id: true },
		});
		return this.db.$transaction(async (tx) => {
			const organization = await tx.organization.create({
				data: {
					id: crypto.randomUUID(),
					name: input.name,
					slug: input.slug,
					createdAt: new Date(),
				},
			});
			if (admin) {
				await tx.member.create({
					data: {
						id: crypto.randomUUID(),
						organizationId: organization.id,
						userId: admin.id,
						role: "owner",
						createdAt: new Date(),
					},
				});
				return { ...organization, invitationPending: false };
			}
			await tx.invitation.create({
				data: {
					id: crypto.randomUUID(),
					organizationId: organization.id,
					email: input.adminEmail.toLowerCase(),
					role: "owner",
					status: "pending",
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					inviterId: userId,
				},
			});
			return { ...organization, invitationPending: true };
		});
	}

	async assertAccess(
		userId: string,
		organizationId: string,
	): Promise<WorkspaceAccess> {
		const membership = await this.db.member.findUnique({
			where: { organizationId_userId: { organizationId, userId } },
			select: { organizationId: true, role: true },
		});
		if (!membership)
			throw new ForbiddenException("This workspace is not available to you.");
		return membership;
	}

	async createContact(
		userId: string,
		input: {
			organizationId: string;
			firstName: string;
			lastName?: string;
			email?: string;
			phone?: string;
			source: CrmSource;
		},
	) {
		await this.assertAccess(userId, input.organizationId);
		const phoneNormalized = normalizedPhone(input.phone);
		if (phoneNormalized) {
			const existing = await this.db.crmContact.findUnique({
				where: {
					organizationId_phoneNormalized: {
						organizationId: input.organizationId,
						phoneNormalized,
					},
				},
			});
			if (existing) return existing;
		}
		return this.db.crmContact.create({
			data: { ...input, phoneNormalized, ownerId: userId },
		});
	}

	async listContacts(userId: string, organizationId: string, limit: number) {
		await this.assertAccess(userId, organizationId);
		return this.db.crmContact.findMany({
			where: { organizationId, archivedAt: null },
			take: limit,
			orderBy: { lastActivityAt: "desc" },
		});
	}

	async listInbox(userId: string, organizationId: string, limit: number) {
		await this.assertAccess(userId, organizationId);
		return this.db.crmConversation.findMany({
			where: { organizationId },
			take: limit,
			orderBy: { lastMessageAt: "desc" },
			include: {
				contact: {
					select: { id: true, firstName: true, lastName: true, phone: true },
				},
				messages: { orderBy: { createdAt: "desc" }, take: 1 },
			},
		});
	}

	async listPipelineStages(userId: string, organizationId: string) {
		await this.assertAccess(userId, organizationId);
		return this.db.crmPipelineStage.findMany({
			where: { organizationId },
			orderBy: { position: "asc" },
		});
	}

	async createPipelineStage(
		userId: string,
		input: {
			organizationId: string;
			key: string;
			label: string;
			position: number;
			isClosed: boolean;
			isWon: boolean;
		},
	) {
		await this.assertAccess(userId, input.organizationId);
		return this.db.crmPipelineStage.create({ data: input });
	}

	async listOpportunities(
		userId: string,
		organizationId: string,
		limit: number,
	) {
		await this.assertAccess(userId, organizationId);
		return this.db.crmOpportunity.findMany({
			where: { organizationId },
			take: limit,
			orderBy: { updatedAt: "desc" },
			include: {
				contact: {
					select: { id: true, firstName: true, lastName: true, phone: true },
				},
				stage: {
					select: { id: true, label: true, isClosed: true, isWon: true },
				},
				event: { select: { id: true, name: true } },
			},
		});
	}

	async createCall(
		userId: string,
		input: {
			organizationId: string;
			contactId: string;
			direction: string;
			outcome?: string;
			notes?: string;
			startedAt: string;
			durationSeconds?: number;
		},
	) {
		await this.assertAccess(userId, input.organizationId);
		await this.contactInWorkspace(input.contactId, input.organizationId);
		const call = await this.db.crmCall.create({
			data: {
				...input,
				authorId: userId,
				startedAt: new Date(input.startedAt),
				source: CrmSource.MANUAL,
			},
		});
		await this.activity(
			input.organizationId,
			input.contactId,
			userId,
			"call_logged",
			CrmSource.MANUAL,
			{ callId: call.id, outcome: input.outcome },
		);
		return call;
	}

	async createOpportunity(
		userId: string,
		input: {
			organizationId: string;
			contactId: string;
			eventId?: string;
			stageId: string;
			quantity?: number;
			amountCents?: number;
			currency: string;
		},
	) {
		await this.assertAccess(userId, input.organizationId);
		await Promise.all([
			this.contactInWorkspace(input.contactId, input.organizationId),
			this.stageInWorkspace(input.stageId, input.organizationId),
		]);
		if (input.eventId)
			await this.eventInWorkspace(input.eventId, input.organizationId);
		const opportunity = await this.db.crmOpportunity.create({ data: input });
		await this.activity(
			input.organizationId,
			input.contactId,
			userId,
			"opportunity_created",
			CrmSource.MANUAL,
			{ opportunityId: opportunity.id },
		);
		return opportunity;
	}

	async moveOpportunity(
		userId: string,
		input: {
			organizationId: string;
			opportunityId: string;
			stageId: string;
			lostReason?: string;
		},
	) {
		await this.assertAccess(userId, input.organizationId);
		const [opportunity, stage] = await Promise.all([
			this.opportunityInWorkspace(input.opportunityId, input.organizationId),
			this.stageInWorkspace(input.stageId, input.organizationId),
		]);
		const updated = await this.db.crmOpportunity.update({
			where: { id: opportunity.id },
			data: {
				stageId: stage.id,
				lostReason: input.lostReason,
				closedAt: stage.isClosed ? new Date() : null,
			},
		});
		await this.activity(
			input.organizationId,
			opportunity.contactId,
			userId,
			"opportunity_stage_changed",
			CrmSource.MANUAL,
			{ opportunityId: updated.id, stageId: stage.id },
		);
		return updated;
	}

	async createFollowUp(
		userId: string,
		input: {
			organizationId: string;
			opportunityId: string;
			dueAt: string;
			message?: string;
			approvedToContact: boolean;
			approvedToSend: boolean;
		},
	) {
		await this.assertAccess(userId, input.organizationId);
		await this.opportunityInWorkspace(
			input.opportunityId,
			input.organizationId,
		);
		const followUp = await this.db.crmFollowUp.create({
			data: { ...input, dueAt: new Date(input.dueAt), ownerId: userId },
		});
		return followUp;
	}

	/**
	 * n8n claims records before sending. The conditional update makes concurrent
	 * workflow executions safe: one follow-up can be delivered only once.
	 */
	async claimDueFollowUps(organizationId: string, limit: number) {
		const candidates = await this.db.crmFollowUp.findMany({
			where: {
				organizationId,
				status: CrmFollowUpStatus.SCHEDULED,
				dueAt: { lte: new Date() },
				approvedToContact: true,
				approvedToSend: true,
			},
			include: { opportunity: { select: { contactId: true } } },
			orderBy: { dueAt: "asc" },
			take: limit,
		});
		const claimed = [];
		for (const followUp of candidates) {
			const result = await this.db.crmFollowUp.updateMany({
				where: {
					id: followUp.id,
					organizationId,
					status: CrmFollowUpStatus.SCHEDULED,
				},
				data: { status: CrmFollowUpStatus.CLAIMED, claimedAt: new Date() },
			});
			if (result.count === 1) claimed.push(followUp);
		}
		return claimed;
	}

	async finishFollowUp(
		organizationId: string,
		input: {
			followUpId: string;
			status: "SENT" | "FAILED";
			providerMessageId?: string;
			failureReason?: string;
		},
	) {
		const followUp = await this.db.crmFollowUp.findFirst({
			where: { id: input.followUpId, organizationId },
			include: { opportunity: { select: { contactId: true } } },
		});
		if (!followUp)
			throw new NotFoundException("Follow-up not found in this workspace.");
		const result = await this.db.crmFollowUp.updateMany({
			where: {
				id: followUp.id,
				organizationId,
				status: CrmFollowUpStatus.CLAIMED,
			},
			data: {
				status:
					input.status === "SENT"
						? CrmFollowUpStatus.SENT
						: CrmFollowUpStatus.FAILED,
				sentAt: input.status === "SENT" ? new Date() : undefined,
				failureReason: input.failureReason,
			},
		});
		if (result.count !== 1)
			throw new ForbiddenException(
				"Follow-up has not been claimed by this delivery run.",
			);
		await this.activity(
			organizationId,
			followUp.opportunity.contactId,
			undefined,
			input.status === "SENT" ? "follow_up_sent" : "follow_up_failed",
			CrmSource.WHATSAPP,
			{
				followUpId: followUp.id,
				providerMessageId: input.providerMessageId,
				failureReason: input.failureReason,
			},
		);
		return { ok: true };
	}

	async summary(userId: string, organizationId: string) {
		await this.assertAccess(userId, organizationId);
		const [
			contacts,
			openConversations,
			handoffs,
			opportunities,
			dueFollowUps,
			wonOrders,
		] = await Promise.all([
			this.db.crmContact.count({ where: { organizationId, archivedAt: null } }),
			this.db.crmConversation.count({
				where: { organizationId, status: CrmConversationStatus.OPEN },
			}),
			this.db.crmConversation.count({
				where: { organizationId, status: CrmConversationStatus.HANDOFF },
			}),
			this.db.crmOpportunity.count({ where: { organizationId } }),
			this.db.crmFollowUp.count({
				where: {
					organizationId,
					status: "SCHEDULED",
					dueAt: { lte: new Date() },
				},
			}),
			this.db.crmTicketOrder.aggregate({
				where: { organizationId, status: "PAID" },
				_sum: { amountCents: true },
				_count: true,
			}),
		]);
		return {
			contacts,
			openConversations,
			handoffs,
			opportunities,
			dueFollowUps,
			paidOrders: wonOrders._count,
			revenueCents: wonOrders._sum.amountCents ?? 0,
		};
	}

	async ingestWhatsApp(input: {
		organizationId: string;
		externalEventId: string;
		conversationId: string;
		providerMessageId: string;
		direction: CrmMessageDirection;
		phone: string;
		contactName?: string;
		body?: string;
		kind: string;
		payload?: Prisma.InputJsonObject;
		occurredAt: string;
	}) {
		return this.db.$transaction(async (tx) => {
			const already = await tx.crmIntegrationEvent.findUnique({
				where: {
					organizationId_provider_externalId: {
						organizationId: input.organizationId,
						provider: "ycloud",
						externalId: input.externalEventId,
					},
				},
			});
			if (already) return { duplicate: true };
			await tx.crmIntegrationEvent.create({
				data: {
					organizationId: input.organizationId,
					provider: "ycloud",
					externalId: input.externalEventId,
					payload: json(input.payload) ?? {},
				},
			});
			const phoneNormalized = normalizedPhone(input.phone);
			if (!phoneNormalized)
				throw new NotFoundException("A valid phone is required.");
			let contact = await tx.crmContact.findUnique({
				where: {
					organizationId_phoneNormalized: {
						organizationId: input.organizationId,
						phoneNormalized,
					},
				},
			});
			let contactWasCreated = false;
			if (!contact) {
				const [firstName, ...rest] = (
					input.contactName?.trim() || input.phone
				).split(/\s+/);
				contact = await tx.crmContact.create({
					data: {
						organizationId: input.organizationId,
						firstName: firstName || input.phone,
						lastName: rest.join(" ") || undefined,
						phone: input.phone,
						phoneNormalized,
						source: CrmSource.WHATSAPP,
					},
				});
				contactWasCreated = true;
			}
			let opportunityId: string | undefined;
			if (contactWasCreated) {
				const initialStage = await tx.crmPipelineStage.findFirst({
					where: { organizationId: input.organizationId, isClosed: false },
					orderBy: { position: "asc" },
				});
				if (!initialStage)
					throw new NotFoundException(
						"An open pipeline stage is required before importing contacts.",
					);
				const opportunity = await tx.crmOpportunity.create({
					data: {
						organizationId: input.organizationId,
						contactId: contact.id,
						stageId: initialStage.id,
						currency: "EUR",
					},
				});
				opportunityId = opportunity.id;
				await tx.crmActivity.create({
					data: {
						organizationId: input.organizationId,
						contactId: contact.id,
						opportunityId: opportunity.id,
						kind: "opportunity_created",
						source: CrmSource.WHATSAPP,
						data: json({ stageId: initialStage.id }),
						occurredAt: new Date(input.occurredAt),
					},
				});
			}
			let conversation = await tx.crmConversation.findUnique({
				where: {
					organizationId_channel_externalId: {
						organizationId: input.organizationId,
						channel: "whatsapp",
						externalId: input.conversationId,
					},
				},
			});
			const reactivated =
				input.direction === CrmMessageDirection.INBOUND &&
				conversation?.status === CrmConversationStatus.CLOSED;
			if (!conversation)
				conversation = await tx.crmConversation.create({
					data: {
						organizationId: input.organizationId,
						contactId: contact.id,
						channel: "whatsapp",
						externalId: input.conversationId,
					},
				});
			else
				conversation = await tx.crmConversation.update({
					where: { id: conversation.id },
					data: {
						status: reactivated
							? CrmConversationStatus.OPEN
							: conversation.status,
						closedAt: reactivated ? null : conversation.closedAt,
						lastMessageAt: new Date(input.occurredAt),
					},
				});
			if (reactivated)
				await tx.crmContact.update({
					where: { id: contact.id },
					data: {
						reactivatedAt: new Date(input.occurredAt),
						reactivationCount: { increment: 1 },
					},
				});
			await tx.crmMessage.create({
				data: {
					conversationId: conversation.id,
					direction: input.direction,
					providerMessageId: input.providerMessageId,
					body: input.body,
					kind: input.kind,
					payload: json(input.payload),
					createdAt: new Date(input.occurredAt),
				},
			});
			await tx.crmContact.update({
				where: { id: contact.id },
				data: { lastActivityAt: new Date(input.occurredAt) },
			});
			await tx.crmActivity.create({
				data: {
					organizationId: input.organizationId,
					contactId: contact.id,
					conversationId: conversation.id,
					kind:
						input.direction === CrmMessageDirection.INBOUND
							? "whatsapp_received"
							: "whatsapp_sent",
					source: CrmSource.WHATSAPP,
					data: json(input.payload),
					occurredAt: new Date(input.occurredAt),
				},
			});
			await tx.crmIntegrationEvent.update({
				where: {
					organizationId_provider_externalId: {
						organizationId: input.organizationId,
						provider: "ycloud",
						externalId: input.externalEventId,
					},
				},
				data: { processedAt: new Date() },
			});
			return {
				duplicate: false,
				contactId: contact.id,
				conversationId: conversation.id,
				opportunityId,
			};
		});
	}

	async ingestTicketOrder(input: {
		organizationId: string;
		externalId: string;
		phone: string;
		contactName?: string;
		eventId?: string;
		quantity: number;
		amountCents: number;
		currency: string;
		status: "PENDING" | "PAID" | "REFUNDED" | "CANCELLED";
		paidAt?: string;
		payload?: Prisma.InputJsonObject;
	}) {
		return this.db.$transaction(async (tx) => {
			const existing = await tx.crmTicketOrder.findUnique({
				where: {
					organizationId_externalId: {
						organizationId: input.organizationId,
						externalId: input.externalId,
					},
				},
			});
			if (existing) return { duplicate: true, orderId: existing.id };
			if (input.eventId) {
				const event = await tx.crmEvent.findFirst({
					where: { id: input.eventId, organizationId: input.organizationId },
				});
				if (!event)
					throw new NotFoundException("Event not found in this workspace.");
			}
			const phoneNormalized = normalizedPhone(input.phone);
			if (!phoneNormalized)
				throw new NotFoundException("A valid phone is required.");
			let contact = await tx.crmContact.findUnique({
				where: {
					organizationId_phoneNormalized: {
						organizationId: input.organizationId,
						phoneNormalized,
					},
				},
			});
			if (!contact) {
				const [firstName, ...rest] = (
					input.contactName?.trim() || input.phone
				).split(/\s+/);
				contact = await tx.crmContact.create({
					data: {
						organizationId: input.organizationId,
						firstName: firstName || input.phone,
						lastName: rest.join(" ") || undefined,
						phone: input.phone,
						phoneNormalized,
						source: CrmSource.TICKETING,
					},
				});
			}
			const order = await tx.crmTicketOrder.create({
				data: {
					organizationId: input.organizationId,
					externalId: input.externalId,
					contactId: contact.id,
					eventId: input.eventId,
					quantity: input.quantity,
					amountCents: input.amountCents,
					currency: input.currency.toUpperCase(),
					status: input.status as CrmOrderStatus,
					paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
					payload: json(input.payload),
				},
			});
			await tx.crmActivity.create({
				data: {
					organizationId: input.organizationId,
					contactId: contact.id,
					kind: "ticket_order_synced",
					source: CrmSource.TICKETING,
					data: json({
						orderId: order.id,
						externalId: input.externalId,
						status: input.status,
					}),
				},
			});
			return { duplicate: false, orderId: order.id };
		});
	}

	private async contactInWorkspace(id: string, organizationId: string) {
		const row = await this.db.crmContact.findFirst({
			where: { id, organizationId },
		});
		if (!row)
			throw new NotFoundException("Contact not found in this workspace.");
		return row;
	}
	private async opportunityInWorkspace(id: string, organizationId: string) {
		const row = await this.db.crmOpportunity.findFirst({
			where: { id, organizationId },
		});
		if (!row)
			throw new NotFoundException("Opportunity not found in this workspace.");
		return row;
	}
	private async stageInWorkspace(id: string, organizationId: string) {
		const row = await this.db.crmPipelineStage.findFirst({
			where: { id, organizationId },
		});
		if (!row)
			throw new NotFoundException(
				"Pipeline stage not found in this workspace.",
			);
		return row;
	}
	private async eventInWorkspace(id: string, organizationId: string) {
		const row = await this.db.crmEvent.findFirst({
			where: { id, organizationId },
		});
		if (!row) throw new NotFoundException("Event not found in this workspace.");
		return row;
	}
	private async activity(
		organizationId: string,
		contactId: string,
		authorId: string | undefined,
		kind: string,
		source: CrmSource,
		data: Prisma.InputJsonValue,
	) {
		await this.db.crmActivity.create({
			data: {
				organizationId,
				contactId,
				authorId,
				kind,
				source,
				data: json(data),
			},
		});
	}
}
