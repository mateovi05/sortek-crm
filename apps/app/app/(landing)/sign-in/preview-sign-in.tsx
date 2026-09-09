"use client";

import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useState } from "react";

export function PreviewSignIn({
	requiresAccessKey = false,
}: {
	requiresAccessKey?: boolean;
}) {
	const [loading, setLoading] = useState(false);
	const [accessKey, setAccessKey] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function enterPreview() {
		setLoading(true);
		setError(null);
		const response = await fetch("/api/preview-sign-in", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ accessKey }),
		});
		const result = await response.json().catch(() => null);
		if (response.ok) {
			window.location.assign(
				result?.organizationId
					? `/platform/${result.organizationId}`
					: "/platform",
			);
			return;
		}

		setError(result?.error ?? "No se ha podido abrir el CRM.");
		setLoading(false);
	}

	return (
		<div className="space-y-4">
			{requiresAccessKey ? (
				<div className="space-y-2">
					<Label htmlFor="preview-access-key">Clave de acceso</Label>
					<Input
						id="preview-access-key"
						type="password"
						value={accessKey}
						onChange={(event) => setAccessKey(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && accessKey) void enterPreview();
						}}
						placeholder="Introduce la clave"
						autoComplete="current-password"
					/>
				</div>
			) : null}
			{error ? <p className="text-destructive text-xs">{error}</p> : null}
			<Button
				className="w-full"
				onClick={enterPreview}
				disabled={loading || (requiresAccessKey && !accessKey)}
			>
				{loading ? "Abriendo CRM…" : "Entrar al CRM"}
			</Button>
		</div>
	);
}
