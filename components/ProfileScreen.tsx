import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { de } from "@/lib/strings";

const t = de.profile;

export function ProfileScreen({
  onSave,
}: {
  onSave: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  return (
    <main className="auth-shell">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          const name = value.trim();
          if (name) onSave(name);
        }}
      >
        <BrandMark className="brand-mark large" />
        <h1 className="mt-6">{t.title}</h1>
        <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
          {t.text}
        </p>
        <label className="mt-7 block text-sm font-semibold" htmlFor="profile-name">
          {t.label}
        </label>
        <input
          className="auth-input mt-2"
          id="profile-name"
          required
          autoFocus
          autoComplete="given-name"
          maxLength={80}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.placeholder}
        />
        <button className="primary-button mt-4 w-full">
          {t.save} <ChevronRight size={17} />
        </button>
      </form>
    </main>
  );
}
