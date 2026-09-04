"use client";

import { Button } from "@crm/ui/components/button";
import { useState } from "react";

export function PreviewSignIn() {
	const [loading, setLoading] = useState(false);
	async function enterPreview() {
		setLoading(true);
		const response = await fetch("/api/preview-sign-in", { method: "POST" });
		if (response.ok) window.location.assign("/platform");
		else setLoading(false);
	}
	return (
		<Button className="w-full" onClick={enterPreview} disabled={loading}>
			{loading ? "Abriendo CRM…" : "Entrar a la vista previa"}
		</Button>
	);
}
