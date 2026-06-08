import { NextResponse } from "next/server";

/** Convert Prisma BigInt money fields to numbers so they serialize to JSON. */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? Number(v) : v,
    ),
  );
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(serialize(data), init);
}

export function error(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}
