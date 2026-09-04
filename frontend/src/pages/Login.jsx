import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";

const DEMO = [
  { role: "Management", email: "management@sies.edu.in" },
  { role: "Finance Manager", email: "finance@sies.edu.in" },
  { role: "Accountant", email: "accountant@sies.edu.in" },
  { role: "Auditor", email: "auditor@sies.edu.in" },
  { role: "Procurement", email: "procurement@sies.edu.in" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("finance@sies.edu.in");
  const [password, setPassword] = useState("Sies@2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
        style={{ background: "#0B0F17" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <svg viewBox="0 0 500 500" className="h-full w-full">
            <path
              d="M0 380 C 80 300, 140 420, 220 340 S 360 260, 440 320 S 500 280, 500 260"
              fill="none"
              stroke="#F97316"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <path
              d="M0 420 C 90 360, 160 460, 240 400 S 380 340, 460 380"
              fill="none"
              stroke="#10B981"
              strokeWidth="1.5"
              opacity="0.4"
            />
          </svg>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="rounded-lg bg-white p-2">
            <img src="/sies-logo.jpg" alt="SIES" className="h-9 w-auto" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">SIES FinCore</p>
            <p className="text-slate-400 text-xs">Financial Intelligence Platform</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-white text-3xl font-bold tracking-tight leading-snug">
            The financial source of truth for the institution.
          </h2>
          <p className="mt-4 text-slate-400 text-sm max-w-md leading-relaxed">
            Accounting, fees, budgets, procurement and treasury unified into one
            auditable platform for SIES College of Arts, Science and Commerce
            (Autonomous), Nerul.
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-slate-500 text-xs">
          <ShieldCheck className="h-4 w-4" />
          Role based access, full audit trail, double entry accounting.
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="rounded-lg bg-white p-2 border border-border">
              <img src="/sies-logo.jpg" alt="SIES" className="h-8 w-auto" />
            </div>
            <p className="font-bold text-lg">SIES FinCore</p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your institutional credentials to continue.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p
                data-testid="login-error"
                className="text-sm text-negative bg-negative-soft border border-negative/20 rounded-md px-3 py-2"
              >
                {error}
              </p>
            )}
            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Demo accounts (password: Sies@2026)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  data-testid={`demo-login-${d.role.toLowerCase().replace(/ /g, "-")}`}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("Sies@2026");
                  }}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:border-brand/50 hover:text-brand transition-colors"
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
