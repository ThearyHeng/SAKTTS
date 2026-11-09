"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { email } }),
      });
    }
    router.push("/dashboard");
  };

  return (
    <div className="bg-workspace grid min-h-screen lg:grid-cols-2">
      <div className="bg-card border-border/60 hidden flex-col justify-between border-r p-12 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="SAKTTS" className="h-8 w-8 rounded-lg dark:invert" />
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
          2,000 free monthly credits · No credit card required
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Create Account</h1>
            <p className="text-muted-foreground text-sm">
              Join SAKTTS and start creating voices
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="bg-card border-border/70 hover:bg-foreground/[0.04] flex h-11 w-full items-center justify-center rounded-full border text-sm font-medium"
          >
            Sign up with Google
          </button>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="text-xs font-medium">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-card border-border/70 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-pw" className="text-xs font-medium">
                Password (min 8 characters)
              </label>
              <div className="relative">
                <input
                  id="reg-pw"
                  type={showPw ? "text" : "password"}
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-card border-border/70 h-11 w-full rounded-2xl border pr-11 pl-4 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="Toggle password visibility"
                  className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="text-xs font-medium">
                Confirm Password
              </label>
              <input
                id="reg-confirm"
                type={showPw ? "text" : "password"}
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-card border-border/70 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
              />
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground h-11 w-full rounded-full text-sm font-semibold"
            >
              Create Free Account
            </button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-foreground font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
