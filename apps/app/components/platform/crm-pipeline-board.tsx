"use client";

import Add from "@carbon/icons-react/es/Add";
import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Card, CardContent } from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { useTRPC } from "@/lib/trpc/client";

type Props = { organizationId: string };

function stageKey(label: string) {
	return label
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function contactName(contact: { firstName: string; lastName?: string | null }) {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

function amount(value: number | null, currency: string) {
	if (value === null) return null;
	return new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value / 100);
}

export function CrmPipelineBoard({ organizationId }: Props) {
	const trpc = useTRPC();
	const client = useQueryClient();
	const workspaces = useQuery(trpc.platform.workspaces.queryOptions());
	const stages = useQuery(
		trpc.platform.pipelineStages.queryOptions({ organizationId }),
	);
	const opportunities = useQuery(
		trpc.platform.opportunities.queryOptions({ organizationId, limit: 100 }),
	);
	const workspace = workspaces.data?.find(
		({ organization }) => organization.id === organizationId,
	)?.organization;
	const [query, setQuery] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [stageOpen, setStageOpen] = useState(false);
	const [leadName, setLeadName] = useState("");
	const [leadPhone, setLeadPhone] = useState("");
	const [newStage, setNewStage] = useState("");

	const invalidate = async () => {
		await Promise.all([
			client.invalidateQueries({
				queryKey: trpc.platform.contacts.queryKey({
					organizationId,
					limit: 50,
				}),
			}),
			client.invalidateQueries({
				queryKey: trpc.platform.opportunities.queryKey({
					organizationId,
					limit: 100,
				}),
			}),
			client.invalidateQueries({
				queryKey: trpc.platform.pipelineStages.queryKey({ organizationId }),
			}),
		]);
	};

	const moveOpportunity = useMutation(
		trpc.platform.moveOpportunity.mutationOptions({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		}),
	);
	const createOpportunity = useMutation(
		trpc.platform.createOpportunity.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setCreateOpen(false);
				setLeadName("");
				setLeadPhone("");
				toast.success("Lead añadido al pipeline.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const createLead = useMutation(
		trpc.platform.createContact.mutationOptions({
			onSuccess: (contact) => {
				const firstStage = stages.data?.[0];
				if (!firstStage) {
					toast.error("Crea primero una etapa del pipeline.");
					return;
				}
				createOpportunity.mutate({
					organizationId,
					contactId: contact.id,
					stageId: firstStage.id,
					currency: "EUR",
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const createStage = useMutation(
		trpc.platform.createPipelineStage.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setNewStage("");
				setStageOpen(false);
				toast.success("Etapa añadida.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const visibleOpportunities = useMemo(() => {
		const term = query.trim().toLocaleLowerCase("es");
		if (!term) return opportunities.data ?? [];
		return (opportunities.data ?? []).filter((opportunity) =>
			[
				contactName(opportunity.contact),
				opportunity.contact.phone,
				opportunity.event?.name,
			]
				.filter(Boolean)
				.some((value) => value?.toLocaleLowerCase("es").includes(term)),
		);
	}, [opportunities.data, query]);

	function submitLead(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const [firstName, ...rest] = leadName.trim().split(/\s+/);
		if (!firstName) return;
		createLead.mutate({
			organizationId,
			firstName,
			lastName: rest.join(" ") || undefined,
			phone: leadPhone || undefined,
			source: "MANUAL",
		});
	}

	function submitStage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		createStage.mutate({
			organizationId,
			label: newStage,
			key: stageKey(newStage),
			position: stages.data?.length ?? 0,
			isClosed: false,
			isWon: false,
		});
	}

	if (workspaces.isSuccess && !workspace) {
		return <PageShell>No tienes acceso a este negocio.</PageShell>;
	}

	return (
		<PageShell className="gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<Link
						href="/platform"
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label="Volver a negocios"
					>
						<ArrowLeft className="size-4" />
					</Link>
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">
							{workspace?.name ?? "Cargando…"}
						</p>
						<h1 className="text-2xl font-medium tracking-tight">Pipeline</h1>
					</div>
				</div>
				<div className="flex w-full items-center gap-2 sm:w-auto">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Buscar en pipeline"
						aria-label="Buscar en pipeline"
						className="h-8 min-w-0 sm:w-52"
					/>
					<Button size="sm" onClick={() => setCreateOpen((open) => !open)}>
						<Add data-icon="inline-start" /> Nuevo lead
					</Button>
				</div>
			</header>

			{createOpen && (
				<Card>
					<CardContent className="p-4">
						<form
							className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
							onSubmit={submitLead}
						>
							<div className="space-y-1.5">
								<Label htmlFor="new-lead-name">Nombre</Label>
								<Input
									id="new-lead-name"
									autoFocus
									required
									value={leadName}
									onChange={(event) => setLeadName(event.target.value)}
									placeholder="Nombre del lead"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="new-lead-phone">Teléfono</Label>
								<Input
									id="new-lead-phone"
									value={leadPhone}
									onChange={(event) => setLeadPhone(event.target.value)}
									placeholder="Opcional"
								/>
							</div>
							<Button
								className="self-end"
								type="submit"
								disabled={createLead.isPending || createOpportunity.isPending}
							>
								Añadir al pipeline
							</Button>
						</form>
					</CardContent>
				</Card>
			)}

			<div className="flex items-center justify-between border-b pb-3">
				<p className="text-muted-foreground text-sm">
					{visibleOpportunities.length} oportunidades
				</p>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setStageOpen((open) => !open)}
				>
					<Add data-icon="inline-start" /> Etapa
				</Button>
			</div>

			{stageOpen && (
				<form className="flex max-w-md gap-2" onSubmit={submitStage}>
					<Label className="sr-only" htmlFor="new-stage">
						Nueva etapa
					</Label>
					<Input
						id="new-stage"
						required
						value={newStage}
						onChange={(event) => setNewStage(event.target.value)}
						placeholder="Nueva etapa"
					/>
					<Button type="submit" disabled={createStage.isPending}>
						Guardar
					</Button>
				</form>
			)}

			<section
				aria-label="Pipeline de oportunidades"
				className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2"
			>
				{stages.data?.map((stage) => {
					const cards = visibleOpportunities.filter(
						(opportunity) => opportunity.stageId === stage.id,
					);
					return (
						<section
							className="flex w-72 shrink-0 flex-col gap-3"
							key={stage.id}
						>
							<header className="flex items-center justify-between border-b py-2">
								<div className="flex min-w-0 items-center gap-2">
									<h2 className="truncate font-medium text-sm">
										{stage.label}
									</h2>
									<Badge variant="secondary">{cards.length}</Badge>
								</div>
								{stage.isClosed && (
									<Badge variant={stage.isWon ? "default" : "outline"}>
										{stage.isWon ? "Ganado" : "Cerrado"}
									</Badge>
								)}
							</header>
							<div className="flex flex-col gap-2">
								{cards.map((opportunity) => (
									<Card key={opportunity.id}>
										<CardContent className="gap-3 p-3">
											<div className="space-y-1">
												<p className="font-medium text-sm">
													{contactName(opportunity.contact)}
												</p>
												{opportunity.contact.phone && (
													<p className="text-muted-foreground text-xs">
														{opportunity.contact.phone}
													</p>
												)}
											</div>
											<div className="flex flex-wrap items-center gap-1.5">
												{opportunity.event && (
													<Badge variant="outline">
														{opportunity.event.name}
													</Badge>
												)}
												{amount(
													opportunity.amountCents,
													opportunity.currency,
												) && (
													<Badge variant="secondary">
														{amount(
															opportunity.amountCents,
															opportunity.currency,
														)}
													</Badge>
												)}
											</div>
											<select
												aria-label={`Mover ${contactName(opportunity.contact)}`}
												className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
												value={opportunity.stageId}
												disabled={moveOpportunity.isPending}
												onChange={(event) =>
													moveOpportunity.mutate({
														organizationId,
														opportunityId: opportunity.id,
														stageId: event.target.value,
													})
												}
											>
												{stages.data?.map((target) => (
													<option key={target.id} value={target.id}>
														{target.label}
													</option>
												))}
											</select>
										</CardContent>
									</Card>
								))}
								{cards.length === 0 && (
									<div className="rounded-lg border border-dashed p-4 text-muted-foreground text-xs">
										Sin oportunidades.
									</div>
								)}
							</div>
						</section>
					);
				})}
				{stages.data?.length === 0 && (
					<div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
						Crea la primera etapa para empezar a organizar oportunidades.
					</div>
				)}
			</section>
		</PageShell>
	);
}
