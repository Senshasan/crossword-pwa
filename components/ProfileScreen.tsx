import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

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
        <h1 className="mt-6">What should we call you?</h1>
        <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
          This is the name family and friends will see on the leaderboard.
        </p>
        <label className="mt-7 block text-sm font-semibold" htmlFor="profile-name">
          Your name
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
          placeholder="e.g. Grandma Rose"
        />
        <button className="primary-button mt-4 w-full">
          Save my name <ChevronRight size={17} />
        </button>
      </form>
    </main>
  );
}
