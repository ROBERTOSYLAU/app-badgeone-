"use client";

import { useEffect, useState } from "react";

type Verify = {
  public_id: string;
  recipient_name: string;
  course_name: string;
  status: string;
  metadata_uri: string;
  tx_hash: string;
  token_id: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

export default function VerifyPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Verify | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/credentials/verify/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Credencial não encontrada"));
  }, [params.id]);

  return (
    <main style={{ maxWidth: 760, margin: "30px auto", padding: 24 }}>
      <h1>Validação Pública</h1>
      <p>Public ID: <strong>{params.id}</strong></p>

      {error && <p style={{ color: "#ff8c8c" }}>{error}</p>}

      {data && (
        <div style={{ border: "1px solid #2b3f7a", borderRadius: 10, padding: 16 }}>
          <p><strong>Status:</strong> {data.status.toUpperCase()}</p>
          <p><strong>Nome:</strong> {data.recipient_name}</p>
          <p><strong>Curso:</strong> {data.course_name}</p>
          <p><strong>Token ID:</strong> {data.token_id}</p>
          <p><strong>Tx:</strong> <code>{data.tx_hash}</code></p>
          <p><strong>Metadata:</strong> <code>{data.metadata_uri}</code></p>
        </div>
      )}
    </main>
  );
}
