import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-page">
      <div className="landing-hero">
        <div className="landing-logo">🏅</div>
        <h1>Badge One</h1>
        <p className="landing-tagline">Plataforma de Credenciamento Digital</p>
        <p className="landing-description">
          Emissão, gestão e validação de badges digitais para empresas e organizações.
        </p>
        
        <div className="landing-actions">
          <Link href="/login" className="landing-btn-primary">
            Acessar Sistema
          </Link>
          <Link href="/verify/demo-credential" className="landing-btn-secondary">
            Verificar Badge
          </Link>
        </div>
      </div>

      <div className="landing-features">
        <div className="landing-feature">
          <span className="landing-icon">🏢</span>
          <h3>Para Empresas</h3>
          <p>Gerencie credenciais e certificados da sua organização</p>
        </div>
        <div className="landing-feature">
          <span className="landing-icon">🏆</span>
          <h3>Para Ganhadores</h3>
          <p>Acesse e compartilhe seus badges digitais</p>
        </div>
        <div className="landing-feature">
          <span className="landing-icon">🔍</span>
          <h3>Validação Pública</h3>
          <p>Verifique a autenticidade de qualquer badge</p>
        </div>
      </div>

      <footer className="landing-footer">
        <p>© 2025 Badge One - Todos os direitos reservados</p>
      </footer>
    </main>
  );
}
