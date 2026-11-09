"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Gift, Loader2 } from "lucide-react";
import { useStudio } from "@/components/providers";

export default function RegisterPage() {
  const router = useRouter();
  const { creditPolicy, refreshStore } = useStudio();

  const nameRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (code) setRefCode(code);
    } catch {
      // ignore
    }
  }, []);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validateName = (val: string) =>
    !val.trim() ? "Please enter your full name." : null;

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Please enter a valid email address (for example, you@example.com).";
    }
    return null;
  };

  const validatePassword = (val: string) => {
    if (!val) return "Please create a password.";
    if (val.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const validateConfirm = (val: string, pw: string) => {
    if (!val) return "Please re-enter your password.";
    if (val !== pw) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validateConfirm(confirm, password);

    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmError(cErr);

    if (nErr) {
      nameRef.current?.focus();
      return;
    }
    if (eErr) {
      emailRef.current?.focus();
      return;
    }
    if (pErr) {
      passwordRef.current?.focus();
      return;
    }
    if (cErr) {
      confirmRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "register",
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Unable to create account.");
        setSubmitting(false);
        return;
      }

      try {
        localStorage.setItem("saktts-remembered-email", data.user?.email ?? email.trim());
      } catch {
        // ignore storage errors
      }
      await refreshStore();
      router.push("/dashboard");
    } catch {
      setFormError("Unable to create account right now. Please try again.");
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "oauth_demo",
          name: name.trim() || "Google Studio User",
          email: email.trim() || "studio@saktts.ai",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Unable to continue with Google.");
        setSubmitting(false);
        return;
      }
      await refreshStore();
      router.push("/dashboard");
    } catch {
      setFormError("Unable to continue with Google right now.");
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-workspace grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="bg-card border-border/60 hidden min-w-0 flex-col justify-between border-r p-12 lg:flex">
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

        <blockquote className="max-w-md space-y-4">
          <p className="text-2xl leading-snug font-medium tracking-tight">
            “Clone a voice from a short sample and keep it in your library, ready for every project
            after.”
          </p>
          <footer className="text-muted-foreground text-sm">— Voice cloning</footer>
        </blockquote>

        <p className="text-muted-foreground text-xs">
          {creditPolicy.defaultSignupCredits.toLocaleString()} free welcome credits · No credit card
          required
        </p>
      </div>

      <div className="flex min-w-0 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
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
            <Link
              href="/auth/login"
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Sign in
            </Link>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Create Account</h1>
            <p className="text-muted-foreground text-sm">
              Join SAKTTS and start with{" "}
              <strong className="text-foreground font-mono">
                {creditPolicy.defaultSignupCredits.toLocaleString()}
              </strong>{" "}
              free studio credits
            </p>
          </div>

          {refCode && (
            <div className="bg-card border-border/75 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium">
              <Gift className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                Invite applied: <strong className="font-mono">{refCode}</strong>
              </span>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form method="POST" onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="block text-xs font-semibold">
                Full Name
              </label>
              <input
                ref={nameRef}
                id="reg-name"
                name="name"
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                required
                value={name}
                onChange={(e) => {
                  const next = e.target.value;
                  setName(next);
                  if (formError) setFormError(null);
                  if (nameError && !validateName(next)) setNameError(null);
                }}
                onBlur={() => {
                  if (name.length > 0) setNameError(validateName(name));
                }}
                aria-describedby={nameError ? "reg-name-error" : undefined}
                aria-invalid={nameError ? "true" : undefined}
                placeholder="Sokha Dara"
                className="saktts-auth-input bg-card border-border/75 min-h-12 w-full rounded-2xl border px-4 text-base sm:text-sm outline-none transition-colors"
              />
              {nameError && (
                <p
                  id="reg-name-error"
                  role="status"
                  className="text-destructive flex items-center gap-1.5 text-xs font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="block text-xs font-semibold">
                Email Address
              </label>
              <input
                ref={emailRef}
                id="reg-email"
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
                  setEmail(next);
                  if (formError) setFormError(null);
                  if (emailError && !validateEmail(next)) setEmailError(null);
                }}
                onBlur={() => {
                  if (email.length > 0) setEmailError(validateEmail(email));
                }}
                aria-describedby={emailError ? "reg-email-error" : undefined}
                aria-invalid={emailError ? "true" : undefined}
                placeholder="you@example.com"
                className="saktts-auth-input bg-card border-border/75 min-h-12 w-full rounded-2xl border px-4 text-base sm:text-sm outline-none transition-colors"
              />
              {emailError && (
                <p
                  id="reg-email-error"
                  role="status"
                  className="text-destructive flex items-center gap-1.5 text-xs font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-pw" className="block text-xs font-semibold">
                Password
              </label>
              <p id="reg-pw-hint" className="text-muted-foreground text-[11px]">
                Minimum 6 characters
              </p>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="reg-pw"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  enterKeyHint="next"
                  required
                  value={password}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPassword(next);
                    if (formError) setFormError(null);
                    if (passwordError && !validatePassword(next)) setPasswordError(null);
                    if (confirmError && confirm && !validateConfirm(confirm, next)) {
                      setConfirmError(null);
                    }
                  }}
                  onBlur={() => {
                    if (password.length > 0) setPasswordError(validatePassword(password));
                  }}
                  aria-describedby={
                    passwordError ? "reg-pw-hint reg-pw-error" : "reg-pw-hint"
                  }
                  aria-invalid={passwordError ? "true" : undefined}
                  placeholder="Create a password"
                  className="saktts-auth-input bg-card border-border/75 min-h-12 w-full rounded-2xl border pr-12 pl-4 text-base sm:text-sm outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-pressed={showPw}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-describedby="reg-pw-toggle-warn"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <span id="reg-pw-toggle-warn" className="sr-only">
                  Warning: showing your password will display it visibly on the screen.
                </span>
              </div>
              {passwordError && (
                <p
                  id="reg-pw-error"
                  role="status"
                  className="text-destructive flex items-center gap-1.5 text-xs font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="block text-xs font-semibold">
                Confirm Password
              </label>
              <input
                ref={confirmRef}
                id="reg-confirm"
                name="confirmPassword"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                enterKeyHint="done"
                required
                value={confirm}
                onChange={(e) => {
                  const next = e.target.value;
                  setConfirm(next);
                  if (formError) setFormError(null);
                  if (confirmError && !validateConfirm(next, password)) setConfirmError(null);
                }}
                onBlur={() => {
                  if (confirm.length > 0) setConfirmError(validateConfirm(confirm, password));
                }}
                aria-describedby={confirmError ? "reg-confirm-error" : undefined}
                aria-invalid={confirmError ? "true" : undefined}
                placeholder="Re-enter your password"
                className="saktts-auth-input bg-card border-border/75 min-h-12 w-full rounded-2xl border px-4 text-base sm:text-sm outline-none transition-colors"
              />
              {confirmError && (
                <p
                  id="reg-confirm-error"
                  role="status"
                  className="text-destructive flex items-center gap-1.5 text-xs font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{confirmError}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                "Create Free Account"
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
            onClick={handleGoogleSignUp}
            disabled={submitting}
            className="bg-card border-border/75 hover:bg-foreground/[0.04] flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border text-sm font-medium transition-colors disabled:opacity-60"
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
            Already have an account?{" "}
            <Link href="/auth/login" className="text-foreground font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
