import { DEFAULT_WORKSPACE_NAME } from "@crm/auth";
import { db, PlatformRole } from "@crm/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess, requireSession } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
	title: "Set up",
};

export const instant = false;

export default async function OnboardingPage() {
	const session = await requireSession();
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { platformRole: true },
	});

	// The upstream onboarding configures its legacy single workspace. Platform
	// admins work through the multi-workspace console instead, so they should
	// never be asked to complete that unrelated setup flow.
	if (user?.platformRole === PlatformRole.PLATFORM_ADMIN) redirect("/platform");

	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title="Tell us about your company"
				description="Two things, once. The name is what the CRM calls you; the website is how the agent learns what you sell."
			/>

			<OnboardingForm placeholder={DEFAULT_WORKSPACE_NAME} />
		</AuthShell>
	);
}
