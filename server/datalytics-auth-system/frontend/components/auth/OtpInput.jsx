"use client";

import { useRef } from "react";

export default function OtpInput({ value, onChange }) {
  const inputsRef = useRef([]);

  const handleDigitChange = (index, nextValue) => {
    const digit = nextValue.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[index] = digit;
    const updated = chars.join("");
    onChange(updated);

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          className="otp-cell"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[index] || ""}
          onChange={(event) => handleDigitChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
