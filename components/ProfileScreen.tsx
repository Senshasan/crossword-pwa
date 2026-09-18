import { useState } from "react";
import { Users, ChevronRight } from "lucide-react";

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
        <span className="brand-mark">
          <Users size={19} />
        </span>
        <p className="eyebrow mt-8">One last detail</p>
        <h1 className="mt-3 text-3xl font-semibold">
          What should we call you?
        </h1>
        <input
          className="auth-input mt-8"
          required
          autoFocus
          maxLength={80}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
        />
        <button className="primary-button mt-4 w-full">
          Save my name <ChevronRight size={17} />
        </button>
      </form>
    </main>
  );
}
