import { describe, expect, it, mock } from "bun:test";
import { PlatformService } from "../src/platform/platform.service";

const input = {
	organizationId: "3e08b03d-9ab0-412c-bd7a-d3b58ae6d590",
	externalEventId: "evt-1",
	conversationId: "34600000000",
	providerMessageId: "msg-1",
	direction: "INBOUND" as const,
	phone: "+34600000000",
	contactName: "Contacto de prueba",
	body: "Hola",
	kind: "text",
	occurredAt: "2026-09-09T15:30:00.000Z",
};

function transaction({ existingContact = false, initialStage = true } = {}) {
	const opportunityCreate = mock(() =>
		Promise.resolve({ id: "opportunity-1" }),
	);
	const tx = {
		crmIntegrationEvent: {
			findUnique: mock(() => Promise.resolve(null)),
			create: mock(() => Promise.resolve({ id: "event-1" })),
			update: mock(() => Promise.resolve({ id: "event-1" })),
		},
		crmContact: {
			findUnique: mock(() =>
				Promise.resolve(existingContact ? { id: "contact-1" } : null),
			),
			create: mock(() => Promise.resolve({ id: "contact-1" })),
			update: mock(() => Promise.resolve({ id: "contact-1" })),
		},
		crmPipelineStage: {
			findFirst: mock(() =>
				Promise.resolve(initialStage ? { id: "stage-new" } : null),
			),
		},
		crmOpportunity: { create: opportunityCreate },
		crmConversation: {
			findUnique: mock(() => Promise.resolve(null)),
			create: mock(() => Promise.resolve({ id: "conversation-1" })),
			update: mock(() => Promise.resolve({ id: "conversation-1" })),
		},
		crmMessage: { create: mock(() => Promise.resolve({ id: "message-1" })) },
		crmActivity: { create: mock(() => Promise.resolve({ id: "activity-1" })) },
	};
	return { tx, opportunityCreate };
}

describe("WhatsApp CRM ingestion", () => {
	it("opens an opportunity in the first active pipeline stage for a new contact", async () => {
		const { tx, opportunityCreate } = transaction();
		const db = {
			$transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
		};
		const result = await new PlatformService(db as never).ingestWhatsApp(input);

		expect(opportunityCreate).toHaveBeenCalledTimes(1);
		expect(opportunityCreate).toHaveBeenCalledWith({
			data: {
				organizationId: input.organizationId,
				contactId: "contact-1",
				stageId: "stage-new",
				currency: "EUR",
			},
		});
		expect(result).toMatchObject({ opportunityId: "opportunity-1" });
	});

	it("does not create another opportunity when the contact already exists", async () => {
		const { tx, opportunityCreate } = transaction({ existingContact: true });
		const db = {
			$transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
		};
		const result = await new PlatformService(db as never).ingestWhatsApp(input);

		expect(opportunityCreate).not.toHaveBeenCalled();
		expect(result.opportunityId).toBeUndefined();
	});

	it("rejects a new contact when the workspace has no active pipeline stage", async () => {
		const { tx } = transaction({ initialStage: false });
		const db = {
			$transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
		};

		expect(
			new PlatformService(db as never).ingestWhatsApp(input),
		).rejects.toThrow(
			"An open pipeline stage is required before importing contacts.",
		);
	});
});
