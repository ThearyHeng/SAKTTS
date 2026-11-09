"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { useStudio } from "@/components/providers";

export default function LoginPage() {
  const router = useRouter();
  const { refreshStore } = useStudio();

  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const emailInteractedRef = useRef(false);
  const passwordInteractedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPw, setShowPw] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password modal state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("saktts-remembered-email");
      if (savedEmail) setEmail(savedEmail);
    } catch {
      // ignore storage unavailability
    }
  }, []);

  const validateEmailField = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return "Please enter your email address.";
    const input = emailRef.current;
    if (input && input.validity.typeMismatch) {
      return "Please enter a valid email address (for example, you@example.com).";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Please enter a valid email address (for example, you@example.com).";
    }
    return null;
  };

  const validatePasswordField = (val: string): string | null => {
    if (!val) return "Please enter your password.";
    if (val.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const rememberDeviceEmail = (signedInEmail: string) => {
    try {
      if (rememberMe && signedInEmail) {
        localStorage.setItem("saktts-remembered-email", signedInEmail);
      } else {
        localStorage.removeItem("saktts-remembered-email");
      }
    } catch {
      // non-fatal storage sync
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const nextEmailErr = validateEmailField(email);
    const nextPwErr = validatePasswordField(password);
    setEmailError(nextEmailErr);
    setPasswordError(nextPwErr);

    if (nextEmailErr) {
      emailRef.current?.focus();
      return;
    }
    if (nextPwErr) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const cleanEmail = email.trim();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email: cleanEmail,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Invalid email or password.");
        setSubmitting(false);
        return;
      }

      rememberDeviceEmail(data.user?.email ?? cleanEmail);
      await refreshStore();
      router.push("/dashboard");
    } catch {
      setFormError("Unable to sign in right now. Please try again.");
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      const targetEmail = email.trim() || "studio@saktts.ai";
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "oauth_demo",
          email: targetEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Unable to continue with Google.");
        setSubmitting(false);
        return;
      }
      rememberDeviceEmail(data.user?.email ?? targetEmail);
      await refreshStore();
      router.push("/dashboard");
    } catch {
      setFormError("Unable to sign in right now. Please try again.");
      setSubmitting(false);
    }
  };

  const handleResetSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSent(true);
  };

  return (
    <main className="bg-workspace grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left showcase panel with SVG photo illustration */}
      <div className="bg-card border-border/60 hidden min-w-0 flex-col justify-between border-r p-10 xl:p-14 lg:flex">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5">
          <img
            src="/logo.svg"
            alt="SAKTTS"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg dark:invert"
          />
          <span className="text-lg font-semibold tracking-tight">SAKTTS</span>
        </Link>

        <div className="mx-auto my-auto flex w-full max-w-lg flex-col items-center space-y-6 py-8">
          <div className="w-full rounded-[2rem] bg-gradient-to-br from-blue-50/90 via-white to-emerald-50/60 p-8 shadow-sm ring-1 ring-black/[0.05] dark:from-white/[0.95] dark:via-white/[0.92] dark:to-white/[0.88]">
            <img
              src="/login-illustration.svg"
              alt="Creator working on a laptop with voice scripts, revenue, and analytics charts"
              width={420}
              height={300}
              className="mx-auto h-auto w-full max-w-[380px] select-none"
            />
          </div>

          <div className="w-full space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Khmer & English AI Voice Studio
            </h2>
            <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
              Manage your cloned voices, multi-paragraph speech scripts, transcripts, and API usage
              from one workspace.
            </p>
            <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 pt-1 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                48 kHz VoxCPM2 Cloning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Local & Private Storage
              </span>
            </div>
          </div>
        </div>

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>SAKTTS Studio Platform</span>
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>

      {/* Right column: Sign-in form */}
      <div className="flex min-w-0 flex-col items-center justify-center px-5 py-8 sm:p-10 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile top brand link */}
          <div className="flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="SAKTTS"
                width={28}
                height={28}
                className="h-7 w-7 rounded-lg dark:invert"
              />
              <span className="text-base font-semibold tracking-tight">SAKTTS</span>
            </Link>
            <Link href="/auth/register" className="text-muted-foreground hover:text-foreground text-xs font-medium">
              Create account
            </Link>
          </div>

          {/* Card header */}
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to access your voices, scripts, and audio history.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {/* Core sign-in form first so mobile keyboards never cover inputs or Sign In */}
          <form method="POST" onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-semibold">
                Email Address
              </label>
              <p id="login-email-hint" className="text-muted-foreground text-[11px]">
                Use your SAKTTS account email (e.g. you@example.com)
              </p>
              <input
                ref={emailRef}
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                enterKeyHint="next"
                required
                value={email}
                onChange={(e) => {
                  const next = e.target.value;
                  emailInteractedRef.current = true;
                  setEmail(next);
                  if (formError) setFormError(null);
                  if (emailError && !validateEmailField(next)) {
                    setEmailError(null);
                  }
                }}
                onBlur={() => {
                  if (emailInteractedRef.current || email.length > 0) {
                    setEmailError(validateEmailField(email));
                  }
                }}
                aria-describedby={emailError ? "login-email-hint login-email-error" : "login-email-hint"}
                aria-invalid={emailError ? "true" : undefined}
                placeholder="you@example.com"
                className="saktts-auth-input bg-card border-border/75 min-h-12 w-full rounded-2xl border px-4 text-base sm:text-sm outline-none transition-colors"
              />
              {emailError && (
                <p
                  id="login-email-error"
                  role="status"
                  className="text-destructive flex items-center gap-1.5 text-xs font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="login-password" className="block text-xs font-semibold">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSent(false);
                    setResetOpen(true);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <p id="login-password-hint" className="text-muted-foreground text-[11px]">
                Minimum 6 characters · Password manager autofill supported
              </p>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  minLength={6}
                  enterKeyHint="done"
                  required
                  value={password}
                  onChange={(e) => {
                    const next = e.target.value;
                    passwordInteractedRef.current = true;
                    setPassword(next);
                    if (formError) setFormError(null);
                    if (passwordError && !validatePasswordField(next)) {
                      setPasswordError(null);
                    }
                  }}
                  onBlur={() => {
                    if (passwordInteractedRef.current || password.length > 0) {
                      setPasswordError(validatePasswordField(password));
                    }
                  }}
                  aria-describedby={
                    passwordError
                      ? "login-password-hint login-password-error"
                      : "login-password-hint"
                  }
                  aria-invalid={passwordError ? "true" : undefined}
                  placeholder="Enter your password"
                  className="saktts-auth-input bg-card border-border/75 min-h-12 w-full rounded-2xl border pr-12 pl-4 text-base sm:text-sm outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-pressed={showPw}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-describedby="login-pw-toggle-warn"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
                <span id="login-pw-toggle-warn" className="sr-only">
                  Warning: showing your password will display it visibly on the screen.
                </span>
              </div>
              {passwordError && (
                <p
                  id="login-password-error"
                  role="status"
                  className="text-destructive flex items-center gap-1.5 text-xs font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label
                htmlFor="login-remember"
                className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-medium"
              >
                <input
                  id="login-remember"
                  name="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>Remember email on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-border/60 absolute inset-x-0 border-t" />
            <span className="bg-workspace text-muted-foreground relative px-3 text-xs">
              or continue with
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="bg-card border-border/75 hover:bg-foreground/[0.04] inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border text-sm font-medium transition-colors disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.3 13.8a6 6 0 0 1 0-3.7V7.4H2.9a10 10 0 0 0 0 9.1l3.4-2.7Z"
              />
              <path
                fill="#EA4335"
                d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 2.9 7.4l3.4 2.7C7.1 7.8 9.4 6 12 6Z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <p className="text-muted-foreground text-center text-sm">
            Don’t have an account?{" "}
            <Link href="/auth/register" className="text-foreground font-semibold hover:underline">
              Create one free
            </Link>
          </p>

          {/* Compact mobile illustration below form controls so virtual keyboard stays unobstructed */}
          <div className="rounded-3xl bg-gradient-to-br from-blue-50/90 via-white to-emerald-50/60 p-4 ring-1 ring-black/[0.05] dark:from-white/[0.94] dark:via-white/[0.90] dark:to-white/[0.86] lg:hidden">
            <img
              src="/login-illustration.svg"
              alt="Creator working on a laptop with voice scripts, revenue, and analytics charts"
              width={420}
              height={300}
              className="mx-auto h-auto max-h-40 w-auto select-none"
            />
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      <ModalDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset your password"
        description="Enter the email associated with your SAKTTS account."
        maxWidthClass="max-w-md"
      >
        {resetSent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                If an account exists for <strong className="font-semibold">{resetEmail}</strong>, a
                password reset link has been prepared.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="bg-primary text-primary-foreground min-h-11 w-full rounded-full text-sm font-semibold"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="block text-xs font-semibold">
                Account Email
              </label>
              <input
                id="reset-email"
                name="resetEmail"
                type="email"
                autoComplete="username"
                spellCheck={false}
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                className="saktts-auth-input bg-workspace border-border/75 min-h-12 w-full rounded-2xl border px-4 text-base sm:text-sm outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="bg-foreground/[0.06] hover:bg-foreground/[0.1] min-h-11 rounded-full px-5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 rounded-full px-6 text-sm font-semibold"
              >
                Send Reset Link
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </main>
  );
}
