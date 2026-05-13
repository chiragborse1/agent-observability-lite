import { NextResponse } from "next/server";
import { clearRuns } from "@/lib/observability-data";

export async function POST() {
  await clearRuns();

  return NextResponse.json({
    ok: true,
    message: "Run data cleared.",
  });
}
