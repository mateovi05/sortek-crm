import { WorkspaceConsole } from "@/components/platform/workspace-console";
import { requireSession } from "@/lib/session";

export const instant = false;

export default async function PlatformPage() {
	await requireSession();
	return <WorkspaceConsole />;
}
