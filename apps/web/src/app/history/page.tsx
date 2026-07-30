"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api";

interface HistoryEntry {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  status: "PENDING" | "SUCCESS" | "FAILED";
  externalPostId: string | null;
  errorMessage: string | null;
  runAt: string;
  attemptedAt: string;
  socialAccount: { name: string };
  schedule: { post: { label: string | null; fbCaption: string; igCaption: string } };
}

function HistoryList() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ history: HistoryEntry[] }>("/publish-history").then((res) => {
      setHistory(res.history);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <h1>Publish History</h1>
      {loading && <p>Loading...</p>}
      {!loading && history.length === 0 && <p style={{ color: "var(--muted)" }}>No publish attempts yet.</p>}
      {history.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Account</th>
                <th>Post</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.attemptedAt).toLocaleString()}</td>
                  <td>
                    {entry.platform}: {entry.socialAccount.name}
                  </td>
                  <td>
                    {(entry.schedule.post.label ||
                      (entry.platform === "FACEBOOK"
                        ? entry.schedule.post.fbCaption
                        : entry.schedule.post.igCaption)
                    ).slice(0, 60) || "(no caption)"}
                  </td>
                  <td>
                    <span className={`badge ${entry.status.toLowerCase()}`}>{entry.status}</span>
                  </td>
                  <td style={{ color: entry.status === "FAILED" ? "var(--danger)" : "var(--muted)" }}>
                    {entry.status === "FAILED" ? (
                      <pre
                        style={{
                          margin: 0,
                          maxWidth: 360,
                          maxHeight: 120,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          fontSize: 12,
                        }}
                      >
                        {entry.errorMessage}
                      </pre>
                    ) : (
                      entry.externalPostId
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryList />
    </AuthGuard>
  );
}
