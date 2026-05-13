import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createRun, listRunsPage } from "@/lib/observability-data";
import { normalizeRunListFilters } from "@/lib/run-filters";
import { createRunSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = normalizeRunListFilters(searchParams);
  const runsPage = await listRunsPage(filters);

  return NextResponse.json({
    data: runsPage.data,
    pagination: runsPage.pagination,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createRunSchema.parse(body);
    const run = await createRun(payload);

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid run payload.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to create run.",
      },
      { status: 500 },
    );
  }
}
