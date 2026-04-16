"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/auth/FormField";
import GoogleButton from "@/components/auth/GoogleButton";
import PrimaryButton from "@/components/auth/PrimaryButton";
import api, { getGoogleAuthUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      toast.error(decodeURIComponent(error));
    }
  }, []);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/login", form);
      const payload = response.data;
      sessionStorage.setItem("pending_auth", JSON.stringify({ email: payload.email, purpose: "login" }));
      if (payload.dev_otp) {
        toast.success(`Dev OTP: ${payload.dev_otp}`);
      } else {
        toast.success("OTP sent to your email.");
      }
      router.push(`/verify-otp?email=${encodeURIComponent(payload.email)}&purpose=login`);
    } catch (error) {
      const message = error.response?.data?.detail || "Login failed. Please check your credentials.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = getGoogleAuthUrl();
  };

  return (
    <AuthShell
      title="Login to DATALYTICS"
      subtitle="Use email/password first, then verify with OTP for secure access."
      footerText="Don't have an account?"
      footerLink="/signup"
      footerLabel="Create one"
    >
      <motion.form
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <FormField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@company.com"
          autoComplete="email"
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Enter secure password"
          autoComplete="current-password"
        />

        <PrimaryButton type="submit" loading={loading}>
          Continue with OTP
        </PrimaryButton>
      </motion.form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-300" />
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">or</span>
        <span className="h-px flex-1 bg-slate-300" />
      </div>

      <GoogleButton onClick={handleGoogleLogin} loading={loading} />

      <p className="mt-6 text-xs leading-5 text-slate-500">
        By continuing, you agree to secure access policies and session controls for DATALYTICS.
      </p>
    </AuthShell>
  );
}
