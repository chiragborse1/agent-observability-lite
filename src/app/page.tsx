import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardSnapshot, listRuns } from "@/lib/observability-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialRuns = await listRuns();
  const snapshot = await getDashboardSnapshot(initialRuns);

  return (
    <DashboardShell
      initialRuns={initialRuns}
      snapshot={snapshot}
    />
  );
}
