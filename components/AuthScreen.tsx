import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";

export function AuthScreen({
  supabase,
}: {
  supabase: ReturnType<typeof createClient>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const result =
      step === "email"
        ? await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: true },
          })
        : await supabase.auth.verifyOtp({
            email: email.trim(),
            token: code,
            type: "email",
          });
    setBusy(false);
    if (result.error)
      setMessage("That request could not be completed. Please try again.");
    else setStep("code");
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <BrandMark className="brand-mark large" />
        <h1 className="mt-6">
          {step === "email" ? "Welcome to Across & Along" : "Check your email"}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
          {step === "email" ? (
            "A private crossword collection for family and friends. Sign in with a one-time code: no password, no ads."
          ) : (
            <>
              We sent a 6-digit code to <span className="font-semibold text-foreground">{email.trim()}</span>.
            </>
          )}
        </p>
        <label className="mt-7 block text-sm font-semibold" htmlFor="auth-value">
          {step === "email" ? "Email address" : "6-digit code"}
        </label>
        <input
          key={step}
          className={`auth-input mt-2 ${step === "code" ? "code" : ""}`}
          id="auth-value"
          required
          autoFocus
          type={step === "email" ? "email" : "text"}
          inputMode={step === "email" ? "email" : "numeric"}
          autoComplete={step === "email" ? "email" : "one-time-code"}
          maxLength={step === "code" ? 6 : undefined}
          value={step === "email" ? email : code}
          onChange={(e) =>
            step === "email"
              ? setEmail(e.target.value)
              : setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder={step === "email" ? "you@example.com" : "••••••"}
        />
        <button className="primary-button mt-4 w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : step === "email"
              ? "Send me a code"
              : "Enter the collection"}
          {!busy && <ChevronRight size={17} />}
        </button>
        {step === "code" && (
          <button
            type="button"
            className="back-link mx-auto mt-3 flex"
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage("");
            }}
          >
            <ChevronLeft size={17} /> Use a different email
          </button>
        )}
        {message && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
