import Link from "next/link";

export default function Home() {
  return (
    <main className="centered">
      <section className="card">
        <span className="badge">Badge One</span>
        <h1 style={{ marginTop: 10 }}>Plataforma de Credenciais</h1>
        <p>Ambiente de administração, emissão e validação pública de badges digitais.</p>

        <ul className="list">
          <li><Link href="/login">Entrar no sistema</Link></li>
          <li><Link href="/issuer">Painel Emissor</Link></li>
          <li><Link href="/winner">Painel do Ganhador</Link></li>
          <li><Link href="/verify/demo-credential">Validação Pública</Link></li>
        </ul>
      </section>
    </main>
  );
}
