import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const raw = await request.text();
  const result = await handlePaymentWebhook(prisma, raw, request.headers.get("x-signature"));
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result);
}
