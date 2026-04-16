"use client";

import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import api from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("datalytics_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadUser = async () => {
      try {
        const response = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem("datalytics_token");
        toast.error("Session expired. Please login again.");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("datalytics_token");
    router.replace("/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8">
      <section className="glass-card p-7 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">DATALYTICS DASHBOARD</p>
            <h1 className="mt-2 text-3xl font-[var(--font-display)] text-slate-900">Welcome, {user?.email}</h1>
            <p className="mt-2 text-sm text-slate-600">Authentication complete. Your secure workspace is active.</p>
          </div>
          <button className="secondary-btn w-auto px-5" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/50 bg-white/50 p-5">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-semibold">Security Status</h2>
            </div>
            <p className="mt-2 text-sm text-slate-700">JWT session active with OTP-verified access for this account.</p>
          </article>

          <article className="rounded-2xl border border-white/50 bg-white/50 p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <Sparkles className="h-5 w-5" />
              <h2 className="font-semibold">Provider</h2>
            </div>
            <p className="mt-2 text-sm text-slate-700 capitalize">
              Signed in using <strong>{user?.provider || "local"}</strong>
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
