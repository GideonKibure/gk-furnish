import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="field-input pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-navy"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function PasswordChecklist({ checks }: { checks: { ok: boolean; label: string }[] }) {
  return (
    <ul className="space-y-1 text-xs">
      {checks.map((c) => (
        <li key={c.label} className={cn("flex items-center gap-1.5", c.ok ? "text-emerald-700" : "text-muted-foreground")}>
          <span aria-hidden>{c.ok ? "✓" : "•"}</span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}
