import { CrmPipelineBoard } from "@/components/platform/crm-pipeline-board";
import { requireSession } from "@/lib/session";

export const instant = false;

export default async function CrmWorkspacePage({
	params,
}: PageProps<"/platform/[organizationId]">) {
	await requireSession();
	const { organizationId } = await params;
	return <CrmPipelineBoard organizationId={organizationId} />;
}
