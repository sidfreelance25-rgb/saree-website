import { inviteStaff } from "@/server/actions";
import { roleLabel } from "@/lib/permissions";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await sellerContext("team.write");
  const query = await searchParams;
  const members = await prisma.staffMembership.findMany({
    where: { storeId: ctx.store.id },
    include: { user: true },
  });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Team</h1>
      {query.error && <p className="error">Check the role, email, and password.</p>}
      {members.map((member) => (
        <p key={member.id} className="panel">{member.user.name} · {member.user.email} · {roleLabel(member.role)}</p>
      ))}
      <form action={inviteStaff} className="form-grid">
        <label className="field"><span>Name</span><input name="name" required /></label>
        <label className="field"><span>Email</span><input name="email" type="email" required /></label>
        <label className="field"><span>Role</span>
          <select name="role">
            <option value="manager">Store manager</option>
            <option value="catalogue">Catalogue manager</option>
            <option value="orders">Order manager</option>
            <option value="content">Content manager</option>
          </select>
        </label>
        <label className="field"><span>Password for a new person</span><input name="password" minLength={8} /></label>
        <button className="btn" type="submit">Invite</button>
      </form>
    </div>
  );
}
