import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	platformCallCreateInput,
	platformContactCreateInput,
	platformCreateBusinessInput,
	platformFollowUpCreateInput,
	platformListInput,
	platformMoveOpportunityInput,
	platformOpportunityCreateInput,
	platformPipelineStageCreateInput,
	platformWorkspaceIdInput,
} from "./platform.contracts";
import { PlatformService } from "./platform.service";

@Router({ alias: "platform" })
@UseMiddlewares(AuthMiddleware)
export class PlatformRouter {
	constructor(
		@Inject(PlatformService) private readonly platform: PlatformService,
	) {}

	@Query({ meta: restMeta("GET", "/platform/workspaces", ["Platform"]) })
	workspaces(@Ctx() ctx: AuthedTrpcContext) {
		return this.platform.listWorkspaces(ctx.user.id);
	}

	@Query({ meta: restMeta("GET", "/platform/summary", ["Platform"]) })
	globalSummary(@Ctx() ctx: AuthedTrpcContext) {
		return this.platform.globalSummary(ctx.user.id);
	}

	@Mutation({
		input: platformCreateBusinessInput,
		meta: restMeta("POST", "/platform/workspaces", ["Platform"]),
	})
	createBusiness(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformCreateBusinessInput>,
	) {
		return this.platform.createBusiness(ctx.user.id, input);
	}

	@Query({
		input: platformListInput,
		meta: restMeta("POST", "/platform/contacts/search", ["CRM"]),
	})
	contacts(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformListInput>,
	) {
		return this.platform.listContacts(
			ctx.user.id,
			input.organizationId,
			input.limit,
		);
	}

	@Mutation({
		input: platformContactCreateInput,
		meta: restMeta("POST", "/platform/contacts", ["CRM"]),
	})
	createContact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformContactCreateInput>,
	) {
		return this.platform.createContact(ctx.user.id, input);
	}

	@Query({
		input: platformListInput,
		meta: restMeta("POST", "/platform/inbox/search", ["CRM"]),
	})
	inbox(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformListInput>,
	) {
		return this.platform.listInbox(
			ctx.user.id,
			input.organizationId,
			input.limit,
		);
	}

	@Query({
		input: platformWorkspaceIdInput,
		meta: restMeta("GET", "/platform/pipeline/{organizationId}", ["CRM"]),
	})
	pipelineStages(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("organizationId") organizationId: string,
	) {
		return this.platform.listPipelineStages(ctx.user.id, organizationId);
	}

	@Mutation({
		input: platformPipelineStageCreateInput,
		meta: restMeta("POST", "/platform/pipeline", ["CRM"]),
	})
	createPipelineStage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformPipelineStageCreateInput>,
	) {
		return this.platform.createPipelineStage(ctx.user.id, input);
	}

	@Mutation({
		input: platformCallCreateInput,
		meta: restMeta("POST", "/platform/calls", ["CRM"]),
	})
	createCall(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformCallCreateInput>,
	) {
		return this.platform.createCall(ctx.user.id, input);
	}

	@Mutation({
		input: platformOpportunityCreateInput,
		meta: restMeta("POST", "/platform/opportunities", ["CRM"]),
	})
	createOpportunity(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformOpportunityCreateInput>,
	) {
		return this.platform.createOpportunity(ctx.user.id, input);
	}

	@Query({
		input: platformListInput,
		meta: restMeta("POST", "/platform/opportunities/search", ["CRM"]),
	})
	opportunities(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformListInput>,
	) {
		return this.platform.listOpportunities(
			ctx.user.id,
			input.organizationId,
			input.limit,
		);
	}

	@Mutation({
		input: platformMoveOpportunityInput,
		meta: restMeta("PATCH", "/platform/opportunities/{opportunityId}/stage", [
			"CRM",
		]),
	})
	moveOpportunity(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformMoveOpportunityInput>,
	) {
		return this.platform.moveOpportunity(ctx.user.id, input);
	}

	@Mutation({
		input: platformFollowUpCreateInput,
		meta: restMeta("POST", "/platform/follow-ups", ["CRM"]),
	})
	createFollowUp(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof platformFollowUpCreateInput>,
	) {
		return this.platform.createFollowUp(ctx.user.id, input);
	}

	@Query({
		input: platformWorkspaceIdInput,
		meta: restMeta("GET", "/platform/summary/{organizationId}", ["CRM"]),
	})
	summary(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("organizationId") organizationId: string,
	) {
		return this.platform.summary(ctx.user.id, organizationId);
	}
}
