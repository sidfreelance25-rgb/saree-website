import Link from "next/link";

export default function NotFound() {
  return (
    <main className="platform">
      <h1>That page is not on the loom.</h1>
      <p><Link href="/">Back to Taana</Link></p>
    </main>
  );
}
