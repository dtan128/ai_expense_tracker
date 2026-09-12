import { useState, FormEvent } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Incorrect passcode");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="login-label">Expenses ledger</p>
        <h1 className="login-title">Enter your passcode</h1>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className="login-input"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="••••"
        />
        {error && <p className="login-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
