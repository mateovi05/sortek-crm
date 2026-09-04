"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type Props = { organizationId: string };

function money(cents: number) {
	return new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
	}).format(cents / 100);
}

function keyFor(label: string) {
	return label
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

export function CrmWorkspaceConsole({ organizationId }: Props) {
	const trpc = useTRPC();
	const client = useQueryClient();
	const workspaces = useQuery(trpc.platform.workspaces.queryOptions());
	const contacts = useQuery(
		trpc.platform.contacts.queryOptions({ organizationId, limit: 50 }),
	);
	const inbox = useQuery(
		trpc.platform.inbox.queryOptions({ organizationId, limit: 30 }),
	);
	const stages = useQuery(
		trpc.platform.pipelineStages.queryOptions({ organizationId }),
	);
	const opportunities = useQuery(
		trpc.platform.opportunities.queryOptions({ organizationId, limit: 50 }),
	);
	const summary = useQuery(
		trpc.platform.summary.queryOptions({ organizationId }),
	);
	const workspace = workspaces.data?.find(
		({ organization }) => organization.id === organizationId,
	)?.organization;
	const [leadName, setLeadName] = useState("");
	const [leadPhone, setLeadPhone] = useState("");
	const [stageLabel, setStageLabel] = useState("");
	const [opportunityContactId, setOpportunityContactId] = useState("");
	const [opportunityStageId, setOpportunityStageId] = useState("");
	const invalidate = async () => {
		await Promise.all([
			client.invalidateQueries({
				queryKey: trpc.platform.contacts.queryKey({
					organizationId,
					limit: 50,
				}),
			}),
			client.invalidateQueries({
				queryKey: trpc.platform.pipelineStages.queryKey({ organizationId }),
			}),
			client.invalidateQueries({
				queryKey: trpc.platform.opportunities.queryKey({
					organizationId,
					limit: 50,
				}),
			}),
			client.invalidateQueries({
				queryKey: trpc.platform.summary.queryKey({ organizationId }),
			}),
		]);
	};
	const createLead = useMutation(
		trpc.platform.createContact.mutationOptions({
			onSuccess: async () => {
				setLeadName("");
				setLeadPhone("");
				await invalidate();
				toast.success("Lead registrado.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const createStage = useMutation(
		trpc.platform.createPipelineStage.mutationOptions({
			onSuccess: async () => {
				setStageLabel("");
				await invalidate();
				toast.success("Etapa creada.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const createOpportunity = useMutation(
		trpc.platform.createOpportunity.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Oportunidad creada.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const moveOpportunity = useMutation(
		trpc.platform.moveOpportunity.mutationOptions({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		}),
	);
	const nextPosition = useMemo(
		() => (stages.data?.at(-1)?.position ?? -1) + 1,
		[stages.data],
	);

	function submitLead(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const [firstName, ...rest] = leadName.trim().split(/\s+/);
		createLead.mutate({
			organizationId,
			firstName: firstName ?? "",
			lastName: rest.join(" ") || undefined,
			phone: leadPhone || undefined,
			source: "MANUAL",
		});
	}
	function submitStage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		createStage.mutate({
			organizationId,
			label: stageLabel,
			key: keyFor(stageLabel),
			position: nextPosition,
			isClosed: false,
			isWon: false,
		});
	}
	function submitOpportunity(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		createOpportunity.mutate({
			organizationId,
			contactId: opportunityContactId,
			stageId: opportunityStageId,
			currency: "EUR",
		});
	}

	if (workspaces.isSuccess && !workspace)
		return (
			<main className="mx-auto max-w-xl p-8 text-sm">
				No tienes acceso a este negocio.
			</main>
		);
	return (
		<main className="mx-auto w-full max-w-7xl space-y-7 px-5 py-8 md:px-8 md:py-12">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<Link
						href="/platform"
						className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="size-3" /> Negocios
					</Link>
					<p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-primary">
						CRM · workspace aislado
					</p>
					<h1 className="mt-2 text-3xl font-medium tracking-tight">
						{workspace?.name ?? "Cargando…"}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Inbox de solo lectura; los envíos y recordatorios se ejecutan
						exclusivamente desde n8n tras aprobación.
					</p>
				</div>
				<div className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
					/{workspace?.slug ?? "…"}
				</div>
			</header>

			<section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
				{[
					["Leads", summary.data?.contacts],
					["Conversaciones abiertas", summary.data?.openConversations],
					["Oportunidades", summary.data?.opportunities],
					[
						"Ingresos",
						summary.data ? money(summary.data.revenueCents) : undefined,
					],
				].map(([label, value]) => (
					<div className="bg-card p-5" key={String(label)}>
						<p className="text-xs text-muted-foreground">{label}</p>
						<p className="mt-3 text-2xl font-medium tracking-tight">
							{value ?? "—"}
						</p>
					</div>
				))}
			</section>

			<div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
				<Card className="rounded-2xl border-border shadow-none">
					<CardHeader>
						<CardTitle className="text-base">Leads</CardTitle>
						<CardDescription>
							Deduplicados por teléfono dentro de este negocio.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<form
							className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
							onSubmit={submitLead}
						>
							<Input
								required
								value={leadName}
								onChange={(event) => setLeadName(event.target.value)}
								placeholder="Nombre del lead"
							/>
							<Input
								value={leadPhone}
								onChange={(event) => setLeadPhone(event.target.value)}
								placeholder="Teléfono (opcional)"
							/>
							<Button type="submit" disabled={createLead.isPending}>
								<Add className="size-4" /> Añadir
							</Button>
						</form>
						<div className="divide-y divide-border">
							{contacts.data?.map((contact) => (
								<div
									className="flex items-center justify-between gap-4 py-3 text-sm"
									key={contact.id}
								>
									<span className="font-medium">
										{contact.firstName} {contact.lastName}
									</span>
									<span className="text-muted-foreground">
										{contact.phone ?? "Sin teléfono"}
									</span>
								</div>
							))}
							{contacts.data?.length === 0 && (
								<p className="py-5 text-sm text-muted-foreground">
									Aún no hay leads en este workspace.
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-2xl border-border shadow-none">
					<CardHeader>
						<CardTitle className="text-base">Inbox</CardTitle>
						<CardDescription>
							Conversaciones sincronizadas y conservadas en el CRM.
						</CardDescription>
					</CardHeader>
					<CardContent className="divide-y divide-border">
						{inbox.data?.map((conversation) => (
							<div className="py-3" key={conversation.id}>
								<div className="flex justify-between gap-3 text-sm">
									<span className="font-medium">
										{conversation.contact.firstName}{" "}
										{conversation.contact.lastName}
									</span>
									<span className="text-xs uppercase text-muted-foreground">
										{conversation.status}
									</span>
								</div>
								<p className="mt-1 truncate text-sm text-muted-foreground">
									{conversation.messages[0]?.body || "Sin contenido textual"}
								</p>
							</div>
						))}
						{inbox.data?.length === 0 && (
							<p className="py-5 text-sm text-muted-foreground">
								El inbox se llena cuando n8n sincroniza WhatsApp.
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-6 xl:grid-cols-[360px_1fr]">
				<Card className="h-fit rounded-2xl border-border shadow-none">
					<CardHeader>
						<CardTitle className="text-base">Pipeline</CardTitle>
						<CardDescription>
							Todo negocio configura el suyo desde cero.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<form className="flex gap-2" onSubmit={submitStage}>
							<Label className="sr-only" htmlFor="stage">
								Nueva etapa
							</Label>
							<Input
								id="stage"
								required
								value={stageLabel}
								onChange={(event) => setStageLabel(event.target.value)}
								placeholder="Nueva etapa"
							/>
							<Button
								size="icon"
								type="submit"
								disabled={createStage.isPending}
							>
								<Add className="size-4" />
							</Button>
						</form>
						<ol className="space-y-2">
							{stages.data?.map((stage) => (
								<li
									className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm"
									key={stage.id}
								>
									<span>{stage.label}</span>
									{stage.isClosed && (
										<span className="text-xs text-muted-foreground">
											cerrada
										</span>
									)}
								</li>
							))}
						</ol>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border-border shadow-none">
					<CardHeader>
						<CardTitle className="text-base">Oportunidades</CardTitle>
						<CardDescription>
							Las oportunidades se mueven entre etapas y conservan su
							trazabilidad.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<form
							className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
							onSubmit={submitOpportunity}
						>
							<select
								className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
								required
								value={opportunityContactId}
								onChange={(event) =>
									setOpportunityContactId(event.target.value)
								}
							>
								<option value="">Lead</option>
								{contacts.data?.map((contact) => (
									<option value={contact.id} key={contact.id}>
										{contact.firstName} {contact.lastName}
									</option>
								))}
							</select>
							<select
								className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
								required
								value={opportunityStageId}
								onChange={(event) => setOpportunityStageId(event.target.value)}
							>
								<option value="">Etapa</option>
								{stages.data?.map((stage) => (
									<option value={stage.id} key={stage.id}>
										{stage.label}
									</option>
								))}
							</select>
							<Button type="submit" disabled={createOpportunity.isPending}>
								Crear
							</Button>
						</form>
						<div className="divide-y divide-border">
							{opportunities.data?.map((opportunity) => (
								<div
									className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
									key={opportunity.id}
								>
									<span className="font-medium">
										{opportunity.contact.firstName}{" "}
										{opportunity.contact.lastName}
									</span>
									<select
										aria-label="Etapa de oportunidad"
										className="rounded-md border border-input bg-transparent px-2 py-1 text-xs"
										value={opportunity.stageId}
										onChange={(event) =>
											moveOpportunity.mutate({
												organizationId,
												opportunityId: opportunity.id,
												stageId: event.target.value,
											})
										}
									>
										{stages.data?.map((stage) => (
											<option key={stage.id} value={stage.id}>
												{stage.label}
											</option>
										))}
									</select>
								</div>
							))}
							{opportunities.data?.length === 0 && (
								<p className="py-5 text-sm text-muted-foreground">
									Crea una etapa y un lead para registrar la primera
									oportunidad.
								</p>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
