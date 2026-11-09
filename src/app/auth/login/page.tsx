"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            “Natural speech and accurate transcripts, in the languages your audience speaks.”
          </p>
          <footer className="text-muted-foreground text-sm">— Why we built SAKTTS</footer>
        </blockquote>

        <p className="text-muted-foreground text-xs">Khmer & English AI Voice Studio</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to your SAKTTS studio workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="bg-card border-border/70 hover:bg-foreground/[0.04] flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors"
          >
            Continue with Google
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-border/60 inset-x-0 border-t" />
            <span className="bg-workspace text-muted-foreground px-3 text-xs">or</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-card border-border/70 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-pw" className="text-xs font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-pw"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-card border-border/70 h-11 w-full rounded-2xl border pr-11 pl-4 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground h-11 w-full rounded-full text-sm font-semibold"
            >
              Log In
            </button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            Don’t have an account?{" "}
            <Link href="/auth/register" className="text-foreground font-semibold hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
