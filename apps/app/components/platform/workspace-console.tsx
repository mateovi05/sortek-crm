"use client";

import Add from "@carbon/icons-react/es/Add";
import Building from "@carbon/icons-react/es/Building";
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
import { Skeleton } from "@crm/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { useTRPC } from "@/lib/trpc/client";

function slugify(value: string) {
	return value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

export function WorkspaceConsole() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaces = useQuery(trpc.platform.workspaces.queryOptions());
	const summary = useQuery(trpc.platform.globalSummary.queryOptions());
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [adminEmail, setAdminEmail] = useState("");
	const create = useMutation(
		trpc.platform.createBusiness.mutationOptions({
			onSuccess: async (business) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.platform.workspaces.queryKey(),
				});
				setName("");
				setSlug("");
				setAdminEmail("");
				toast.success(
					business.invitationPending
						? "Negocio creado. La invitación queda pendiente."
						: "Negocio creado y administrador asignado.",
				);
			},
			onError: (error) =>
				toast.error(error.message || "No se pudo crear el negocio."),
		}),
	);
	const generatedSlug = useMemo(() => slug || slugify(name), [name, slug]);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		create.mutate({ name, slug: generatedSlug, adminEmail });
	}

	return (
		<PageShell className="gap-6">
			<header className="max-w-2xl space-y-3">
				<p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
					◉ Plataforma SORTEK
				</p>
				<h1 className="text-4xl font-medium tracking-tight text-foreground">
					Negocios{" "}
					<span className="text-muted-foreground">en un solo CRM.</span>
				</h1>
				<p className="text-sm leading-6 text-muted-foreground">
					Crea un workspace vacío, asigna su equipo y mantén sus datos aislados
					del resto de clientes.
				</p>
			</header>
			{summary.data && (
				<section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
					{[
						["Negocios", summary.data.workspaces],
						["Leads", summary.data.contacts],
						["Oportunidades", summary.data.opportunities],
						[
							"Ingresos",
							(summary.data.revenueCents / 100).toLocaleString("es-ES", {
								style: "currency",
								currency: "EUR",
							}),
						],
					].map(([label, value]) => (
						<div key={String(label)} className="bg-card p-4">
							<p className="text-xs text-muted-foreground">{label}</p>
							<p className="mt-2 text-xl font-medium tracking-tight">{value}</p>
						</div>
					))}
				</section>
			)}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<section
					aria-label="Workspaces"
					className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2"
				>
					{workspaces.isLoading &&
						["first", "second", "third", "fourth"].map((key) => (
							<div key={key} className="bg-card p-5">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="mt-4 h-4 w-24" />
							</div>
						))}
					{workspaces.data?.map(({ organization, role }) => (
						<Link
							key={organization.id}
							href={`/platform/${organization.id}`}
							className="group bg-card p-5 transition-colors hover:bg-accent"
						>
							<div className="flex items-start justify-between gap-3">
								<span className="grid size-9 place-items-center rounded-full bg-primary/12 text-primary">
									<Building className="size-4" />
								</span>
								<span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
									{role}
								</span>
							</div>
							<h2 className="mt-8 font-medium tracking-tight">
								{organization.name}
							</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								/{organization.slug}
							</p>
						</Link>
					))}
					{workspaces.data?.length === 0 && (
						<div className="col-span-full bg-card p-8 text-sm text-muted-foreground">
							Aún no perteneces a ningún negocio.
						</div>
					)}
				</section>

				<Card className="h-fit border-border bg-card shadow-none">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Add className="size-4 text-primary" /> Crear negocio
						</CardTitle>
						<CardDescription>
							Empieza vacío: sin datos, pipeline ni automatizaciones heredadas.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={submit}>
							<div className="space-y-2">
								<Label htmlFor="business-name">Nombre</Label>
								<Input
									id="business-name"
									required
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder="Goza Europa"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="business-slug">Slug</Label>
								<Input
									id="business-slug"
									required
									value={slug}
									onChange={(event) => setSlug(slugify(event.target.value))}
									placeholder={slugify(name) || "goza-europa"}
								/>
								<p className="text-xs text-muted-foreground">
									crm.sortek.io/{generatedSlug || "negocio"}
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="business-admin">Email del administrador</Label>
								<Input
									id="business-admin"
									required
									type="email"
									value={adminEmail}
									onChange={(event) => setAdminEmail(event.target.value)}
									placeholder="equipo@cliente.com"
								/>
							</div>
							<Button
								className="w-full"
								type="submit"
								disabled={create.isPending || !generatedSlug}
							>
								{create.isPending ? "Creando…" : "Crear workspace"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
