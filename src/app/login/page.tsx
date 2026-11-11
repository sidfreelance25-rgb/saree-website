import Link from "next/link";
import { LoginForm } from "@/components/widgets";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; deleted?: string }> }) {
  const query = await searchParams;
  const next = query.next && query.next.startsWith("/") && !query.next.startsWith("//") ? query.next : "/";
  return (
    <main className="platform">
      <p className="kicker"><Link href="/">Taana</Link></p>
      <h1 style={{ fontSize: "3rem" }}>Sign in</h1>
      {query.deleted && <p className="note">Deletion request recorded. Open orders stay until the seller finishes them.</p>}
      <LoginForm next={next} />
      <details className="demo-accounts">
        <summary>Use a demo account</summary>
        <div className="note">
          <p>Password: SareeDemo!2026</p>
          <p>meera@varanasiweave.test runs Varanasi Weave House.</p>
          <p>lakshmi@kanjeevaram.test runs Kanjeevaram Atelier.</p>
          <p>ravi@varanasiweave.test can pack orders and cannot edit prices.</p>
          <p>platform@taana.test sees every store.</p>
          <p>ananya@example.com is a customer.</p>
        </div>
      </details>
    </main>
  );
}
