"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  organization_id: number | null;
};

type Organization = {
  id: number;
  name: string;
  status: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  async function loadData() {
    try {
      const [u, o] = await Promise.all([
        apiGet("/api/v1/users"),
        apiGet("/api/v1/organizations"),
      ]);
      setUsers(u.filter((x: User) => x.role === "issuer"));
      setOrgs(o.filter((x: Organization) => x.status === "active"));
    } catch {
      setMessage("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setMessage("");

    try {
      await apiPost("/api/v1/users", {
        name,
        email,
        password,
        role: "issuer",
        organization_id: Number(orgId),
        status: "active",
      });
      setMessage("Usuário emissor criado com sucesso!");
      setName("");
      setEmail("");
      setPassword("");
      setOrgId("");
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setMessage(err.message || "Erro ao criar usuário.");
    } finally {
      setFormLoading(false);
    }
  }

  function getOrgName(orgId: number | null) {
    if (!orgId) return "-";
    const org = orgs.find((o) => o.id === orgId);
    return org?.name || `#${orgId}`;
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="header-row">
        <h1>Usuários Emissores</h1>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "+ Novo Emissor"}
        </button>
      </div>

      {message && (
        <p className={message.includes("Erro") ? "error" : "success"}>
          {message}
        </p>
      )}

      {showForm && (
        <section className="card">
          <h2>Criar Usuário Emissor</h2>
          <form onSubmit={handleSubmit} className="form-grid" style={{ maxWidth: 500 }}>
            <div className="input-group">
              <label>Nome completo</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do emissor"
                required
              />
            </div>

            <div className="input-group">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="emissor@empresa.com"
                required
              />
            </div>

            <div className="input-group">
              <label>Senha inicial</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div className="input-group">
              <label>Organização</label>
              <select
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                required
              >
                <option value="">Selecione uma organização</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={formLoading}>
              {formLoading ? "Criando..." : "Criar Emissor"}
            </button>
          </form>
        </section>
      )}

      <section className="card">
        {users.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <h3>Nenhum emissor cadastrado</h3>
            <p>
              Crie usuários emissores para que possam emitir badges em nome das
              organizações.
            </p>
            <button onClick={() => setShowForm(true)}>Criar primeiro emissor</button>
          </div>
        ) : (
          <>
            <h2>Lista de Emissores ({users.length})</h2>
            <ul className="list">
              {users.map((u) => (
                <li key={u.id}>
                  <strong>{u.name}</strong> ({u.email})
                  <br />
                  <span className="muted">
                    Organização: {getOrgName(u.organization_id)} | Status:{" "}
                    <span
                      className={u.status === "active" ? "success" : "error"}
                    >
                      {u.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
