import { WorkspaceConsole } from "@/components/platform/workspace-console";
import { requireSession } from "@/lib/session";

export default async function PlatformPage() {
	await requireSession();
	return <WorkspaceConsole />;
}
