"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError } from "@/lib/api";

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  name: string;
}

type MediaType = "IMAGE" | "VIDEO" | "REEL";
type RecurrenceType = "ONE_TIME" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";

function defaultMediaType(file: File): MediaType {
  return file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
}

function NewPostForm() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("IMAGE");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("ONE_TIME");
  const [interval, setInterval] = useState(1);
  const [cronExpression, setCronExpression] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ accounts: SocialAccount[] }>("/social-accounts").then((res) => setAccounts(res.accounts));
  }, []);

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) return setError("Please select a photo, video, or Reel to upload.");
    if (selectedAccountIds.length === 0) return setError("Select at least one connected account.");
    if (!startAt) return setError("Choose a start date/time.");
    if (recurrenceType === "CUSTOM" && !cronExpression) {
      return setError("Enter a cron expression for custom recurrence.");
    }

    setSubmitting(true);
    try {
      setProgress("Requesting upload URL...");
      const extension = `.${file.name.split(".").pop() ?? "bin"}`;
      const { uploadUrl, publicUrl, key } = await apiFetch<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
      }>("/media/upload-url", {
        method: "POST",
        body: JSON.stringify({ fileExtension: extension, contentType: file.type }),
      });

      setProgress("Uploading file...");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload to storage failed");

      setProgress("Saving media...");
      const { media } = await apiFetch<{ media: { id: string } }>("/media", {
        method: "POST",
        body: JSON.stringify({
          type: mediaType,
          url: publicUrl,
          storageKey: key,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      setProgress("Creating post...");
      const { post } = await apiFetch<{ post: { id: string } }>("/posts", {
        method: "POST",
        body: JSON.stringify({
          mediaId: media.id,
          caption,
          hashtags: hashtags
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean),
        }),
      });

      setProgress("Creating schedule...");
      await apiFetch("/schedules", {
        method: "POST",
        body: JSON.stringify({
          postId: post.id,
          socialAccountIds: selectedAccountIds,
          recurrenceType,
          interval,
          cronExpression: recurrenceType === "CUSTOM" ? cronExpression : undefined,
          timezone,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : undefined,
        }),
      });

      router.push("/schedules");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <>
      <h1>New Recurring Post</h1>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <h3>Content</h3>
          <div className="field">
            <label htmlFor="file">Image, video, or Reel</label>
            <input
              id="file"
              type="file"
              accept="image/*,video/*"
              required
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                if (selected) setMediaType(defaultMediaType(selected));
              }}
            />
          </div>
          {file && file.type.startsWith("video/") && (
            <div className="field">
              <label htmlFor="mediaType">Media type</label>
              <select id="mediaType" value={mediaType} onChange={(e) => setMediaType(e.target.value as MediaType)}>
                <option value="VIDEO">Video</option>
                <option value="REEL">Reel</option>
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="caption">Caption</label>
            <textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} />
          </div>
          <div className="field">
            <label htmlFor="hashtags">Hashtags (comma-separated)</label>
            <input
              id="hashtags"
              placeholder="marketing, smallbusiness"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <h3>Publish to</h3>
          {accounts.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No connected accounts yet. Connect one first.</p>
          )}
          {accounts.map((account) => (
            <label key={account.id} style={{ display: "block", marginBottom: 8, color: "var(--text)" }}>
              <input
                type="checkbox"
                checked={selectedAccountIds.includes(account.id)}
                onChange={() => toggleAccount(account.id)}
                style={{ marginRight: 8 }}
              />
              {account.platform} &mdash; {account.name}
            </label>
          ))}
        </div>

        <div className="card">
          <h3>Schedule</h3>
          <div className="field">
            <label htmlFor="recurrenceType">Recurrence</label>
            <select
              id="recurrenceType"
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
            >
              <option value="ONE_TIME">One-time</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="CUSTOM">Custom (cron expression)</option>
            </select>
          </div>

          {(recurrenceType === "DAILY" || recurrenceType === "WEEKLY" || recurrenceType === "MONTHLY") && (
            <div className="field">
              <label htmlFor="interval">
                Repeat every N {recurrenceType === "DAILY" ? "day(s)" : recurrenceType === "WEEKLY" ? "week(s)" : "month(s)"}
              </label>
              <input
                id="interval"
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              />
            </div>
          )}

          {recurrenceType === "CUSTOM" && (
            <div className="field">
              <label htmlFor="cron">Cron expression</label>
              <input
                id="cron"
                placeholder="0 9 * * 1,3,5"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="startAt">Start date &amp; time ({timezone})</label>
            <input id="startAt" type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>

          {recurrenceType !== "ONE_TIME" && (
            <div className="field">
              <label htmlFor="endAt">End date (optional)</label>
              <input id="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}
        {progress && <p style={{ color: "var(--muted)" }}>{progress}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create schedule"}
        </button>
      </form>
    </>
  );
}

export default function NewPostPage() {
  return (
    <AuthGuard>
      <NewPostForm />
    </AuthGuard>
  );
}
