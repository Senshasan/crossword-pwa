import { useState } from "react";
import { Grid2X2, ChevronRight, ChevronLeft } from "lucide-react";
import type { createClient } from "@/lib/supabase/client";

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
        <span className="brand-mark">
          <Grid2X2 size={19} />
        </span>
        <p className="eyebrow mt-8">A private family collection</p>
        <h1 className="mt-3 text-3xl font-semibold">
          Welcome to Across & Along
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Sign in with a one-time code. No password to remember, no ads.
        </p>
        <label className="mt-8 block text-sm font-medium" htmlFor="auth-value">
          {step === "email" ? "Email address" : "6-digit code"}
        </label>
        <input
          className="auth-input mt-2"
          id="auth-value"
          required
          autoFocus
          type={step === "email" ? "email" : "text"}
          inputMode={step === "email" ? "email" : "numeric"}
          maxLength={step === "code" ? 6 : undefined}
          value={step === "email" ? email : code}
          onChange={(e) =>
            step === "email"
              ? setEmail(e.target.value)
              : setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder={step === "email" ? "you@example.com" : "000000"}
        />
        <button className="primary-button mt-4 w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : step === "email"
              ? "Send me a code"
              : "Enter the collection"}{" "}
          <ChevronRight size={17} />
        </button>
        {step === "code" && (
          <button
            type="button"
            className="back-link mx-auto mt-4"
            onClick={() => setStep("email")}
          >
            <ChevronLeft size={17} /> Use a different email
          </button>
        )}
        {message && (
          <p className="mt-4 text-sm text-coral" role="alert">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
