import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { appendSteps } from "@/lib/observability-data";
import { appendStepsSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const payload = appendStepsSchema.parse(body);
    const run = await appendSteps(id, payload);

    if (!run) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid step payload.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to append steps.",
      },
      { status: 500 },
    );
  }
}
