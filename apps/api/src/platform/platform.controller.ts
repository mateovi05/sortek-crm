import type { Prisma } from "@crm/db";
import {
	Body,
	Controller,
	Headers,
	HttpCode,
	Post,
	UnauthorizedException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import {
	platformFollowUpClaimInput,
	platformFollowUpResultInput,
	platformTicketOrderInput,
	platformWhatsappEventInput,
} from "./platform.contracts";
import { PlatformService } from "./platform.service";

/**
 * Private ingress for n8n. The shared value is an API environment secret and
 * must be configured in n8n as a Header Auth credential, never in workflow JSON.
 */
@Controller(["integrations", "api/integrations"])
@AllowAnonymous()
export class PlatformController {
	constructor(private readonly platform: PlatformService) {}

	@Post("whatsapp/events")
	@HttpCode(202)
	async whatsappEvent(
		@Headers("x-sortek-integration-key") key: string | undefined,
		@Body() body: Prisma.InputJsonObject,
	) {
		this.assertKey(key);
		const input = platformWhatsappEventInput.parse(body);
		return this.platform.ingestWhatsApp({
			...input,
			payload: input.payload as Prisma.InputJsonObject | undefined,
		});
	}

	@Post("follow-ups/claim")
	@HttpCode(200)
	async claimFollowUps(
		@Headers("x-sortek-integration-key") key: string | undefined,
		@Body() body: Prisma.InputJsonObject,
	) {
		this.assertKey(key);
		const input = platformFollowUpClaimInput.parse(body);
		return this.platform.claimDueFollowUps(input.organizationId, input.limit);
	}

	@Post("follow-ups/result")
	@HttpCode(200)
	async followUpResult(
		@Headers("x-sortek-integration-key") key: string | undefined,
		@Body() body: Prisma.InputJsonObject,
	) {
		this.assertKey(key);
		const input = platformFollowUpResultInput.parse(body);
		return this.platform.finishFollowUp(input.organizationId, input);
	}

	@Post("ticket-orders")
	@HttpCode(202)
	async ticketOrder(
		@Headers("x-sortek-integration-key") key: string | undefined,
		@Body() body: Prisma.InputJsonObject,
	) {
		this.assertKey(key);
		const input = platformTicketOrderInput.parse(body);
		return this.platform.ingestTicketOrder({
			...input,
			payload: input.payload as Prisma.InputJsonObject | undefined,
		});
	}

	private assertKey(key: string | undefined) {
		const configured = process.env.SORTEK_INTEGRATION_KEY;
		if (!configured || !key || key !== configured)
			throw new UnauthorizedException("Invalid integration credential.");
	}
}
