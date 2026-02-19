import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Badge One App</h1>
      <p>MVP Sprint 1 inicializado.</p>
      <ul>
        <li><Link href="/login">Login</Link></li>
        <li><Link href="/admin">Painel Admin</Link></li>
        <li><Link href="/issuer">Painel Emissor</Link></li>
        <li><Link href="/verify/demo-credential">Validação Pública (demo)</Link></li>
      </ul>
    </main>
  );
}
