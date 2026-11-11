import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionExpiry, signSession, verifySession, type SessionPayload } from "./auth";
import { can, type Permission } from "./permissions";
import { prisma } from "./prisma";

const COOKIE = "taana_session";

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function writeSession(payload: SessionPayload) {
  const jar = await cookies();
  jar.set(COOKIE, signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function freshSession(userId: string, extra: Partial<SessionPayload> = {}): SessionPayload {
  return { uid: userId, exp: sessionExpiry(), ...extra };
}

export async function sellerContext(permission?: Permission) {
  const session = await readSession();
  if (!session) redirect("/login?next=/admin");
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: { memberships: { include: { store: { include: { theme: true } } } } },
  });
  if (!user) redirect("/login?next=/admin");

  let store = user.memberships[0]?.store ?? null;
  let role = user.memberships[0]?.role ?? "";
  let support = false;

  if (session.supportStoreId && session.supportExp && session.supportExp > Date.now() && user.isPlatformAdmin) {
    const supported = await prisma.store.findUnique({
      where: { id: session.supportStoreId },
      include: { theme: true },
    });
    if (supported) {
      store = supported;
      role = "owner";
      support = true;
    }
  } else if (user.memberships.length > 0) {
    const preferred = (await cookies()).get("taana_store")?.value;
    const membership = user.memberships.find((item) => item.storeId === preferred) ?? user.memberships[0];
    store = membership.store;
    role = membership.role;
  }

  if (!store?.theme) redirect(user.isPlatformAdmin ? "/platform" : "/login");
  if (permission && !can(role, permission)) redirect("/admin?error=permission");
  const unread = await prisma.notification.count({
    where: { storeId: store.id, audience: "seller", read: false },
  });
  return { user, store: { ...store, theme: store.theme }, role, support, unread, session };
}

export async function platformContext() {
  const session = await readSession();
  if (!session) redirect("/login?next=/platform");
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user?.isPlatformAdmin) redirect("/admin");
  return { user, session };
}

export function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = String(value ?? "");
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
