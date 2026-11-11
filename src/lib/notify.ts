import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export async function notifySellers(
  db: Db,
  args: { storeId: string; event: string; title: string; body: string; href: string },
) {
  const members = await db.staffMembership.findMany({
    where: { storeId: args.storeId },
    include: { user: true, store: true },
  });
  if (members.length === 0) return;
  await db.notification.createMany({
    data: members.map((member) => ({
      storeId: args.storeId,
      userId: member.userId,
      audience: "seller",
      event: args.event,
      title: args.title,
      body: args.body,
      href: args.href,
    })),
  });
  const store = members[0].store;
  await db.outboundMessage.create({
    data: {
      storeId: args.storeId,
      channel: "email",
      toAddress: store.email,
      subject: args.title,
      body: `${args.body}\n\nOpen: ${args.href}`,
      status: "logged",
    },
  });
}

export async function notifyCustomer(
  db: Db,
  args: { storeId: string; email: string; event: string; title: string; body: string },
) {
  await db.outboundMessage.create({
    data: {
      storeId: args.storeId,
      channel: "email",
      toAddress: args.email,
      subject: args.title,
      body: args.body,
      status: "logged",
    },
  });
}
