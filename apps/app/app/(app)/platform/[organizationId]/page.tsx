import { CrmWorkspaceConsole } from "@/components/platform/crm-workspace-console";
import { requireSession } from "@/lib/session";

export default async function CrmWorkspacePage({
	params,
}: PageProps<"/platform/[organizationId]">) {
	await requireSession();
	const { organizationId } = await params;
	return <CrmWorkspaceConsole organizationId={organizationId} />;
}
