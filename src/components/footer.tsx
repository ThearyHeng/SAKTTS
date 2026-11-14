import React from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-workspace border-border/50 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-6 lg:gap-12">
          <div className="col-span-2 lg:col-span-2">
            <div className="mb-6 flex items-center gap-2">
              <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                <img
                  src="/logo.svg"
                  alt="SAKTTS Logo"
                  className="h-full w-full object-cover dark:invert"
                />
              </span>
              <span className="text-[19px] font-semibold tracking-tight">SAKTTS</span>
            </div>
            <p className="text-muted-foreground mb-6 max-w-xs text-[15px] leading-relaxed">
              The complete platform for building high-quality audio applications. Scale your voice
              synthesis with our global infrastructure.
            </p>
            <div className="flex gap-2">
              <a
                href="https://www.facebook.com/profile.php?id=61584204122479"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="bg-card text-foreground/80 hover:text-foreground grid h-10 w-10 place-items-center rounded-full transition-colors"
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5 9H16V6h-2.5C11.57 6 10 7.57 10 9.5V11H8v3h2v7h3v-7h2.5l.5-3H13v-1.5c0-.28.22-.5.5-.5z" />
                </svg>
              </a>
              <a
                href="https://github.com/blizzertech"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="bg-card text-foreground/80 hover:text-foreground grid h-10 w-10 place-items-center rounded-full transition-colors"
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.91c.58.11.79-.25.79-.55v-1.93c-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.02 11.02 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
                </svg>
              </a>
              <a
                href="https://huggingface.co/blizzer-tech"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Hugging Face"
                className="bg-card text-foreground/80 hover:text-foreground grid h-10 w-10 place-items-center rounded-full text-sm font-bold transition-colors"
              >
                🤗
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-muted-foreground mb-4 text-[13px] font-medium">Product</h2>
            <ul className="text-foreground/80 space-y-3 text-[15px]">
              <li><Link href="/#features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="/speech-to-text" className="hover:text-foreground transition-colors">Speech to Text</Link></li>
              <li><Link href="/text-to-speech" className="hover:text-foreground transition-colors">Text to Speech</Link></li>
              <li><Link href="/ai-voice-detector" className="hover:text-foreground transition-colors">AI Voice Detector</Link></li>
              <li><Link href="/download" className="hover:text-foreground transition-colors">Mobile App</Link></li>
              <li><Link href="/mcp" className="hover:text-foreground transition-colors">MCP Server</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-muted-foreground mb-4 text-[13px] font-medium">Resources</h2>
            <ul className="text-foreground/80 space-y-3 text-[15px]">
              <li><Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
              <li><Link href="/docs/quickstart" className="hover:text-foreground transition-colors">Quick Start</Link></li>
              <li><Link href="/docs/api" className="hover:text-foreground transition-colors">API Reference</Link></li>
              <li><Link href="/docs#faq" className="hover:text-foreground transition-colors">Help Center</Link></li>
              <li><Link href="/dashboard/settings" className="hover:text-foreground transition-colors">Studio Settings</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-muted-foreground mb-4 text-[13px] font-medium">Company</h2>
            <ul className="text-foreground/80 space-y-3 text-[15px]">
              <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Open Studio</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-muted-foreground mb-4 text-[13px] font-medium">Support</h2>
            <ul className="text-foreground/80 space-y-3 text-[15px]">
              <li>
                <a href="https://t.me/mrrtmob" target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
                  <Send className="h-3.5 w-3.5" /> Telegram
                </a>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" /> Messenger
                </Link>
              </li>
              <li>
                <a href="mailto:info@saktts.com" className="hover:text-foreground transition-colors">
                  info@saktts.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-border/60 text-muted-foreground flex flex-col items-center justify-between gap-4 border-t pt-8 text-[13px] sm:flex-row">
          <p>© {new Date().getFullYear()} SAKTTS Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
