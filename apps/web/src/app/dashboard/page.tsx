"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <h1>Dashboard</h1>
      <div className="card">
        <h3>Get started</h3>
        <ol>
          <li>
            <Link href="/connect">Connect a Facebook Page or Instagram account</Link>
          </li>
          <li>
            <Link href="/posts/new">Upload content and set a recurring schedule</Link>
          </li>
          <li>
            <Link href="/schedules">Manage your schedules</Link> (pause, resume, edit, delete)
          </li>
          <li>
            <Link href="/history">Review publish history</Link>
          </li>
        </ol>
      </div>
    </AuthGuard>
  );
}
