"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import AuthShell from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import api from "@/lib/api";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ email: "", purpose: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromQuery = params.get("email");
    const purposeFromQuery = params.get("purpose");
    if (emailFromQuery && purposeFromQuery) {
      setMeta({ email: emailFromQuery, purpose: purposeFromQuery });
      return;
    }

    const pending = sessionStorage.getItem("pending_auth");
    if (pending) {
      const parsed = JSON.parse(pending);
      setMeta({ email: parsed.email, purpose: parsed.purpose });
    }
  }, []);

  const pageTitle = useMemo(() => {
    if (meta.purpose === "signup") return "Verify signup OTP";
    if (meta.purpose === "login") return "Verify login OTP";
    return "Verify OTP";
  }, [meta.purpose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!meta.email || !meta.purpose) {
      toast.error("Missing email or auth purpose. Please retry.");
      return;
    }
    if (otp.length !== 6) {
      toast.error("Enter all 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/verify-otp", {
        email: meta.email,
        otp,
        purpose: meta.purpose,
      });
      const payload = response.data;
      toast.success(payload.message);

      if (payload.access_token) {
        localStorage.setItem("datalytics_token", payload.access_token);
        sessionStorage.removeItem("pending_auth");
        router.push("/dashboard");
        return;
      }

      sessionStorage.removeItem("pending_auth");
      router.push("/login");
    } catch (error) {
      const message = error.response?.data?.detail || "OTP verification failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={pageTitle}
      subtitle={`Code sent to ${meta.email || "your email"}. Enter OTP to continue securely.`}
      footerText="Need to switch account?"
      footerLink="/login"
      footerLabel="Back to login"
    >
      <motion.form
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <OtpInput value={otp} onChange={(next) => setOtp(next)} />

        <PrimaryButton type="submit" loading={loading}>
          Verify OTP
        </PrimaryButton>
      </motion.form>
    </AuthShell>
  );
}
