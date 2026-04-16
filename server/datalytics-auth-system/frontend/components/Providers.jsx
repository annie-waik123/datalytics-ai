"use client";

import { Toaster } from "react-hot-toast";

export default function Providers({ children }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "12px",
            border: "1px solid rgba(251, 191, 36, 0.35)",
            background: "rgba(255, 255, 255, 0.95)",
            color: "#1f2937",
          },
        }}
      />
    </>
  );
}
