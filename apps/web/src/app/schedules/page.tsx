"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError } from "@/lib/api";

interface Schedule {
  id: string;
  recurrenceType: string;
  interval: number;
  cronExpression: string | null;
  timezone: string;
  startAt: string;
  endAt: string | null;
  nextRunAt: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  post: { caption: string; media: { url: string; type: string } };
  targets: { socialAccount: { platform: string; name: string } }[];
}

function statusClass(status: string) {
  return status.toLowerCase();
}

function EditForm({ schedule, onSaved, onCancel }: { schedule: Schedule; onSaved: () => void; onCancel: () => void }) {
  const [startAt, setStartAt] = useState(schedule.startAt.slice(0, 16));
  const [endAt, setEndAt] = useState(schedule.endAt ? schedule.endAt.slice(0, 16) : "");
  const [interval, setInterval] = useState(schedule.interval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/schedules/${schedule.id}`, {
        method: "PUT",
        body: JSON.stringify({
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : null,
          interval,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="field">
        <label>Start date &amp; time</label>
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      </div>
      <div className="field">
        <label>End date (optional)</label>
        <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
      </div>
      <div className="field">
        <label>Interval</label>
        <input type="number" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save changes"}
      </button>{" "}
      <button className="secondary" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function SchedulesList() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await apiFetch<{ schedules: Schedule[] }>("/schedules");
    setSchedules(res.schedules);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function pause(id: string) {
    await apiFetch(`/schedules/${id}/pause`, { method: "PATCH" });
    load();
  }

  async function resume(id: string) {
    await apiFetch(`/schedules/${id}/resume`, { method: "PATCH" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this schedule? This cannot be undone.")) return;
    await apiFetch(`/schedules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <h1>Schedules</h1>
      {loading && <p>Loading...</p>}
      {!loading && schedules.length === 0 && <p style={{ color: "var(--muted)" }}>No schedules yet.</p>}

      {schedules.map((schedule) => (
        <div key={schedule.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <p style={{ margin: 0 }}>
                <strong>{schedule.post.caption || "(no caption)"}</strong>
              </p>
              <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: 13 }}>
                {schedule.targets.map((t) => `${t.socialAccount.platform}: ${t.socialAccount.name}`).join(", ")}
              </p>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                {schedule.recurrenceType}
                {schedule.recurrenceType === "CUSTOM" && ` (${schedule.cronExpression})`} &middot; next run:{" "}
                {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : "—"}
              </p>
            </div>
            <span className={`badge ${statusClass(schedule.status)}`}>{schedule.status}</span>
          </div>

          {editingId === schedule.id ? (
            <EditForm
              schedule={schedule}
              onSaved={() => {
                setEditingId(null);
                load();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              {schedule.status === "ACTIVE" && (
                <button className="secondary" onClick={() => pause(schedule.id)}>
                  Pause
                </button>
              )}
              {schedule.status === "PAUSED" && (
                <button className="secondary" onClick={() => resume(schedule.id)}>
                  Resume
                </button>
              )}
              <button className="secondary" onClick={() => setEditingId(schedule.id)}>
                Edit
              </button>
              <button className="danger" onClick={() => remove(schedule.id)}>
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function SchedulesPage() {
  return (
    <AuthGuard>
      <SchedulesList />
    </AuthGuard>
  );
}
