import { DashboardShell } from "@/components/dashboard-shell";
import {
  getDashboardSnapshot,
  listRunFilterOptions,
  listRuns,
  listRunsPage,
} from "@/lib/observability-data";
import { normalizeRunListFilters } from "@/lib/run-filters";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const rawSearchParams = searchParams ? await searchParams : {};
  const filters = normalizeRunListFilters(rawSearchParams);
  const [runsPage, filteredRuns, filterOptions] = await Promise.all([
    listRunsPage(filters),
    listRuns(filters),
    listRunFilterOptions(),
  ]);
  const snapshot = await getDashboardSnapshot(filteredRuns);

  return (
    <DashboardShell
      initialRuns={runsPage.data}
      pagination={runsPage.pagination}
      snapshot={snapshot}
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
