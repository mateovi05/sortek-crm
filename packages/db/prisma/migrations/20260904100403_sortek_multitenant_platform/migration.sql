-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_ADMIN', 'WORKSPACE_USER');

-- CreateEnum
CREATE TYPE "CrmSource" AS ENUM ('MANUAL', 'WHATSAPP', 'PHONE_AGENT', 'TICKETING', 'IMPORT');

-- CreateEnum
CREATE TYPE "CrmConversationStatus" AS ENUM ('OPEN', 'HANDOFF', 'CLOSED');

-- CreateEnum
CREATE TYPE "CrmMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CrmFollowUpStatus" AS ENUM ('SCHEDULED', 'CLAIMED', 'SENT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmOrderStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkspaceFeature" AS ENUM ('WHATSAPP', 'EVENTS', 'TICKETING');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'WORKSPACE_USER';

-- CreateTable
CREATE TABLE "workspaceFeatureFlag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feature" "WorkspaceFeature" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaceFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "source" "CrmSource" NOT NULL DEFAULT 'MANUAL',
    "ownerId" TEXT,
    "firstContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reactivatedAt" TIMESTAMP(3),
    "reactivationCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "CrmConversationStatus" NOT NULL DEFAULT 'OPEN',
    "handoffReason" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "CrmMessageDirection" NOT NULL,
    "providerMessageId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmCall" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorId" TEXT,
    "source" "CrmSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "direction" TEXT NOT NULL,
    "outcome" TEXT,
    "notes" TEXT,
    "transcript" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmPipelineStage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "venue" TEXT,
    "city" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmOpportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "eventId" TEXT,
    "stageId" TEXT NOT NULL,
    "quantity" INTEGER,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "nextStep" TEXT,
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmFollowUp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "approvedToContact" BOOLEAN NOT NULL DEFAULT false,
    "approvedToSend" BOOLEAN NOT NULL DEFAULT false,
    "status" "CrmFollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmTicketOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "eventId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "CrmOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crmTicketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "opportunityId" TEXT,
    "authorId" TEXT,
    "kind" TEXT NOT NULL,
    "source" "CrmSource" NOT NULL DEFAULT 'MANUAL',
    "data" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crmIntegrationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "crmIntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspaceFeatureFlag_organizationId_enabled_idx" ON "workspaceFeatureFlag"("organizationId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "workspaceFeatureFlag_organizationId_feature_key" ON "workspaceFeatureFlag"("organizationId", "feature");

-- CreateIndex
CREATE INDEX "crmContact_organizationId_lastActivityAt_idx" ON "crmContact"("organizationId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "crmContact_organizationId_email_idx" ON "crmContact"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "crmContact_organizationId_phoneNormalized_key" ON "crmContact"("organizationId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "crmConversation_organizationId_status_lastMessageAt_idx" ON "crmConversation"("organizationId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "crmConversation_contactId_lastMessageAt_idx" ON "crmConversation"("contactId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "crmConversation_organizationId_channel_externalId_key" ON "crmConversation"("organizationId", "channel", "externalId");

-- CreateIndex
CREATE INDEX "crmMessage_conversationId_createdAt_idx" ON "crmMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "crmMessage_conversationId_providerMessageId_key" ON "crmMessage"("conversationId", "providerMessageId");

-- CreateIndex
CREATE INDEX "crmCall_organizationId_startedAt_idx" ON "crmCall"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "crmCall_contactId_startedAt_idx" ON "crmCall"("contactId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "crmCall_organizationId_externalId_key" ON "crmCall"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "crmPipelineStage_organizationId_key_key" ON "crmPipelineStage"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "crmPipelineStage_organizationId_position_key" ON "crmPipelineStage"("organizationId", "position");

-- CreateIndex
CREATE INDEX "crmEvent_organizationId_active_startsAt_idx" ON "crmEvent"("organizationId", "active", "startsAt");

-- CreateIndex
CREATE INDEX "crmOpportunity_organizationId_stageId_updatedAt_idx" ON "crmOpportunity"("organizationId", "stageId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "crmOpportunity_organizationId_contactId_eventId_key" ON "crmOpportunity"("organizationId", "contactId", "eventId");

-- CreateIndex
CREATE INDEX "crmFollowUp_organizationId_status_dueAt_idx" ON "crmFollowUp"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "crmTicketOrder_organizationId_status_paidAt_idx" ON "crmTicketOrder"("organizationId", "status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "crmTicketOrder_organizationId_externalId_key" ON "crmTicketOrder"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "crmActivity_organizationId_occurredAt_idx" ON "crmActivity"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "crmActivity_contactId_occurredAt_idx" ON "crmActivity"("contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "crmIntegrationEvent_organizationId_processedAt_idx" ON "crmIntegrationEvent"("organizationId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "crmIntegrationEvent_organizationId_provider_externalId_key" ON "crmIntegrationEvent"("organizationId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "workspaceFeatureFlag" ADD CONSTRAINT "workspaceFeatureFlag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmContact" ADD CONSTRAINT "crmContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmContact" ADD CONSTRAINT "crmContact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmConversation" ADD CONSTRAINT "crmConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmConversation" ADD CONSTRAINT "crmConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmMessage" ADD CONSTRAINT "crmMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmCall" ADD CONSTRAINT "crmCall_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmCall" ADD CONSTRAINT "crmCall_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmCall" ADD CONSTRAINT "crmCall_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmPipelineStage" ADD CONSTRAINT "crmPipelineStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmEvent" ADD CONSTRAINT "crmEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmOpportunity" ADD CONSTRAINT "crmOpportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmOpportunity" ADD CONSTRAINT "crmOpportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmOpportunity" ADD CONSTRAINT "crmOpportunity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "crmEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmOpportunity" ADD CONSTRAINT "crmOpportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "crmPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmFollowUp" ADD CONSTRAINT "crmFollowUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmFollowUp" ADD CONSTRAINT "crmFollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmFollowUp" ADD CONSTRAINT "crmFollowUp_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmTicketOrder" ADD CONSTRAINT "crmTicketOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmTicketOrder" ADD CONSTRAINT "crmTicketOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmTicketOrder" ADD CONSTRAINT "crmTicketOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmTicketOrder" ADD CONSTRAINT "crmTicketOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "crmEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crmConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmActivity" ADD CONSTRAINT "crmActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crmIntegrationEvent" ADD CONSTRAINT "crmIntegrationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
