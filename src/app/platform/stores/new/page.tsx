import Link from "next/link";
import { CreateStoreForm } from "@/components/create-store";
import { platformContext } from "@/lib/session";

export default async function NewStorePage() {
  await platformContext();
  return (
    <main className="platform">
      <p className="kicker"><Link href="/platform">Platform</Link></p>
      <h1 style={{ fontSize: "2.4rem" }}>New store</h1>
      <CreateStoreForm />
    </main>
  );
}
