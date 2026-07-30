"use client";

import { FormEvent, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface ImportResult {
  targetedAccounts: { platform: string; name: string }[];
  imported: { week: number; topic: string; imagePostId: string; reelPostId: string }[];
  failed: { week: number; mediaType: "image" | "reel"; reason: string }[];
}

function ImportCampaignForm() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a .zip file first.");

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("zip", file);

      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/campaigns/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const body = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(body?.error ?? "Import failed");
      }
      setResult(body as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Import Campaign</h1>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <h3>Campaign zip</h3>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Zip containing <code>images/</code>, <code>reels/</code>, and <code>postpilot-content.json</code> at its
            root. Creates one image post (Tuesdays 9am) + one Reel post (Fridays 9am), America/Vancouver, per week
            entry, each recurring every 8 weeks.
          </p>
          <div className="field">
            <label htmlFor="zip">Zip file</label>
            <input
              id="zip"
              type="file"
              accept=".zip"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Importing..." : "Import campaign"}
        </button>
      </form>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Targeted accounts</h3>
          {result.targetedAccounts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>None.</p>
          ) : (
            <ul>
              {result.targetedAccounts.map((a, i) => (
                <li key={i}>
                  {a.platform}: {a.name}
                </li>
              ))}
            </ul>
          )}

          <h3>Imported</h3>
          {result.imported.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Nothing imported.</p>
          ) : (
            <ul>
              {result.imported.map((w, i) => (
                <li key={i}>
                  Week {w.week}: {w.topic}
                  {w.imagePostId ? " — image ✓" : " — image ✗"}
                  {w.reelPostId ? ", reel ✓" : ", reel ✗"}
                </li>
              ))}
            </ul>
          )}

          {result.failed.length > 0 && (
            <>
              <h3 style={{ color: "var(--danger)" }}>Failed</h3>
              <ul>
                {result.failed.map((f, i) => (
                  <li key={i} style={{ color: "var(--danger)" }}>
                    Week {f.week} ({f.mediaType}): {f.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function ImportCampaignPage() {
  return (
    <AuthGuard>
      <ImportCampaignForm />
    </AuthGuard>
  );
}
