"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  name: string;
  externalId: string;
  connectedAt: string;
  tokenExpiresAt: string | null;
}

function ConnectPageContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const result = await apiFetch<{ accounts: SocialAccount[] }>("/social-accounts");
    setAccounts(result.accounts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function connect() {
    const token = getToken();
    window.location.href = `${API_BASE_URL}/auth/meta/connect?token=${encodeURIComponent(token ?? "")}`;
  }

  async function disconnect(id: string) {
    if (!confirm("Disconnect this account? Schedules targeting it will fail to publish.")) return;
    await apiFetch(`/social-accounts/${id}`, { method: "DELETE" });
    load();
  }

  const success = searchParams.get("success");

  return (
    <>
      <h1>Connected Accounts</h1>
      {success === "true" && <p style={{ color: "var(--success)" }}>Accounts connected successfully.</p>}
      {success === "false" && <p className="error-text">Something went wrong connecting your account. Please try again.</p>}

      <div className="card">
        <p style={{ color: "var(--muted)" }}>
          Connect a Facebook Page to publish posts, or an Instagram Professional account linked to a
          Page to publish photos, videos, and Reels.
        </p>
        <button onClick={connect}>Connect with Meta</button>
      </div>

      <div className="card">
        <h3>Your accounts</h3>
        {loading && <p>Loading...</p>}
        {!loading && accounts.length === 0 && <p style={{ color: "var(--muted)" }}>No accounts connected yet.</p>}
        {accounts.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Name</th>
                <th>Connected</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.platform}</td>
                  <td>{account.name}</td>
                  <td>{new Date(account.connectedAt).toLocaleDateString()}</td>
                  <td>
                    <button className="danger" onClick={() => disconnect(account.id)}>
                      Disconnect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function ConnectPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <ConnectPageContent />
      </Suspense>
    </AuthGuard>
  );
}
