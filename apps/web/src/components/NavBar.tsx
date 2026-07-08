"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";

export function NavBar() {
  const router = useRouter();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <nav className="topnav">
      <Link className="brand" href="/dashboard">
        PostPilot
      </Link>
      <Link href="/connect">Connected Accounts</Link>
      <Link href="/posts/new">New Post</Link>
      <Link href="/schedules">Schedules</Link>
      <Link href="/history">History</Link>
      <button className="secondary" onClick={logout}>
        Log out
      </button>
    </nav>
  );
}
