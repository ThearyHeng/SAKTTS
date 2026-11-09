"use client";

import React from "react";
import { useLanguage } from "@/components/providers";

const PARTNERS = [
  "Blizzer",
  "Transcribify",
  "SAKTTS Studio",
  "Phnom Penh Media",
  "Angkor Audio",
  "Mekong Labs",
  "KhmerCast",
  "VoiceCraft Asia",
];

export function PartnerMarquee() {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-muted-foreground mb-8 text-center text-[13px] font-medium">
          {t("marquee.title")}
        </p>
        <div className="mask-linear-fade relative overflow-hidden">
          <div className="animate-marquee flex items-center gap-16">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-16">
                {PARTNERS.map((name) => (
                  <div
                    key={`${dup}-${name}`}
                    className="text-muted-foreground/45 hover:text-foreground cursor-default text-xl font-semibold tracking-tight transition-colors duration-300"
                  >
                    {name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
