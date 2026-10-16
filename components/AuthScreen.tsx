import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { de } from "@/lib/strings";

const t = de.auth;

// Supabase returns English server text; never show it, map it to a German message.
function authErrorMessage(error: unknown) {
  if (isAuthRetryableFetchError(error) || !navigator.onLine) return t.errors.network;
  if (isAuthApiError(error)) {
    if (error.status === 429 || error.code?.startsWith("over_")) return t.errors.rateLimit;
    // A wrong code and an expired code both come back as otp_expired.
    if (error.code === "otp_expired") return t.errors.invalidCode;
    if (error.code === "email_address_invalid" || error.code === "validation_failed") return t.errors.invalidEmail;
  }
  return t.errors.generic;
}

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
      setMessage(authErrorMessage(result.error));
    else setStep("code");
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <BrandMark className="brand-mark large" />
        <h1 className="mt-6">
          {step === "email" ? t.welcome : t.checkEmail}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
          {step === "email" ? (
            t.intro
          ) : (
            <>
              {t.codeSentBefore}
              <span className="font-semibold text-foreground">{email.trim()}</span>
              {t.codeSentAfter}
            </>
          )}
        </p>
        <label className="mt-7 block text-sm font-semibold" htmlFor="auth-value">
          {step === "email" ? t.emailLabel : t.codeLabel}
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
          placeholder={step === "email" ? t.emailPlaceholder : "••••••"}
        />
        <button className="primary-button mt-4 w-full" disabled={busy}>
          {busy
            ? t.wait
            : step === "email"
              ? t.sendCode
              : t.enter}
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
            <ChevronLeft size={17} /> {t.otherEmail}
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
