import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { appendAlerts } from "@/lib/observability-data";
import { appendAlertsSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const payload = appendAlertsSchema.parse(body);
    const run = await appendAlerts(id, payload);

    if (!run) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid alert payload.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to append alerts.",
      },
      { status: 500 },
    );
  }
}
