"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

import AuthShell from "@/components/auth/AuthShell";
import FormField from "@/components/auth/FormField";
import PrimaryButton from "@/components/auth/PrimaryButton";
import api from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/signup", form);
      const payload = response.data;
      sessionStorage.setItem("pending_auth", JSON.stringify({ email: payload.email, purpose: "signup" }));
      if (payload.dev_otp) {
        toast.success(`Dev OTP: ${payload.dev_otp}`);
      } else {
        toast.success("Signup OTP sent to your email.");
      }
      router.push(`/verify-otp?email=${encodeURIComponent(payload.email)}&purpose=signup`);
    } catch (error) {
      const raw = error.response?.data?.detail;
      const message = Array.isArray(raw) ? raw[0]?.msg : raw || "Signup failed. Please retry.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your DATALYTICS account"
      subtitle="Sign up with email, verify OTP, and unlock a secure analytics workspace."
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Login here"
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
          placeholder="Min 8 chars, uppercase, lowercase, number"
          autoComplete="new-password"
        />

        <FormField
          label="Confirm Password"
          name="confirm_password"
          type="password"
          value={form.confirm_password}
          onChange={handleChange}
          placeholder="Re-enter password"
          autoComplete="new-password"
        />

        <PrimaryButton type="submit" loading={loading}>
          Create Account & Send OTP
        </PrimaryButton>
      </motion.form>
    </AuthShell>
  );
}
