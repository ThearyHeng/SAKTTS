"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Mail, MapPin, Phone } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="text-muted-foreground bg-card inline-flex rounded-full px-3.5 py-1 text-xs font-medium">
              We usually reply within one business day
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Get in touch</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Questions about pricing, a custom voice, or running SAKTTS at scale? Tell us what you
              need and the right person will answer.
            </p>

            <div className="space-y-3 pt-2 text-sm">
              <div className="bg-card flex items-center gap-3 rounded-2xl p-4">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span>info@saktts.com</span>
              </div>
              <div className="bg-card flex items-center gap-3 rounded-2xl p-4">
                <Phone className="text-muted-foreground h-4 w-4" />
                <span>+855 96 698 2983</span>
              </div>
              <div className="bg-card flex items-center gap-3 rounded-2xl p-4">
                <MapPin className="text-muted-foreground h-4 w-4" />
                <span>Toul Kork, Phnom Penh, Cambodia</span>
              </div>
            </div>

            <div className="bg-card rounded-3xl p-5">
              <p className="font-semibold">Looking for docs?</p>
              <p className="text-muted-foreground mt-1 text-xs">
                API keys, endpoints and pricing are all documented.
              </p>
              <Link
                href="/docs"
                className="mt-3 inline-block text-xs font-semibold underline-offset-4 hover:underline"
              >
                Read the docs →
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] sm:p-8 dark:ring-white/[0.06]"
          >
            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="bg-foreground text-background flex h-12 w-12 items-center justify-center rounded-full">
                  <Check className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-xl font-semibold">Message queued</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Thanks {name || "there"} — we have logged your inquiry for {email || "your team"}.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="bg-foreground/[0.07] mt-6 rounded-full px-5 py-2 text-xs font-semibold"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="c-name" className="text-xs font-medium">Name</label>
                  <input
                    id="c-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-foreground/[0.04] border-border/60 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="c-email" className="text-xs font-medium">Email</label>
                  <input
                    id="c-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-foreground/[0.04] border-border/60 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="c-subject" className="text-xs font-medium">Subject</label>
                  <input
                    id="c-subject"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="bg-foreground/[0.04] border-border/60 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="c-message" className="text-xs font-medium">Message</label>
                  <textarea
                    id="c-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-foreground/[0.04] border-border/60 w-full resize-none rounded-2xl border p-4 text-sm outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground h-11 w-full rounded-full text-sm font-semibold"
                >
                  Send message
                </button>
              </>
            )}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
