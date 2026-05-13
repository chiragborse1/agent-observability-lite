import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createRun, listRuns } from "@/lib/observability-data";
import { createRunSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const query = searchParams.get("query") ?? undefined;
  const runs = await listRuns({
    status:
      status === "healthy" ||
      status === "degraded" ||
      status === "failed" ||
      status === "running" ||
      status === "all"
        ? status
        : undefined,
    query,
  });

  return NextResponse.json({
    data: runs,
    total: runs.length,
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
