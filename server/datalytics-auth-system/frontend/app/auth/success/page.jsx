"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";

export default function GoogleAuthSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      toast.error("Google authentication failed.");
      router.replace("/login");
      return;
    }

    localStorage.setItem("datalytics_token", token);
    toast.success("Google login successful.");
    const timer = setTimeout(() => {
      router.replace("/dashboard");
    }, 900);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-[var(--font-display)] text-slate-900">Authentication Completed</h1>
        <p className="mt-2 text-sm text-slate-600">Setting up your secure session and redirecting to dashboard.</p>
        <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-amber-600" />
      </div>
    </main>
  );
}
