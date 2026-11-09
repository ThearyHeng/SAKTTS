"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { COMPARISON_ROWS, PERSONAL_PLANS, TEAM_PLANS, PricingPlan } from "@/lib/pricing";
import { useLanguage } from "@/components/providers";

function PlanCard({ plan }: { plan: PricingPlan }) {
  if (plan.wide) {
    return (
      <div className="bg-card relative flex flex-col rounded-3xl p-6 ring-1 ring-black/[0.04] sm:p-8 lg:flex-row lg:items-center lg:gap-12 dark:ring-white/[0.06]">
        <div className="mb-8 shrink-0 lg:mb-0 lg:w-72">
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>
              <p className="text-muted-foreground text-[15px]">{plan.tagline}</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-[-0.03em]">
                {plan.price ?? "Custom"}
              </span>
              {plan.price && <span className="text-muted-foreground text-lg">/mo</span>}
            </div>
            <Link
              href={plan.href}
              className="bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1] flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-colors"
            >
              {plan.cta}
            </Link>
          </div>
        </div>

        <div className="bg-border/60 hidden w-px self-stretch lg:block" />

        <div className="flex-1">
          <p className="text-muted-foreground mb-4 text-[13px] font-medium">
            {plan.featuresLabel}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px]">
                <span className="bg-foreground/[0.07] mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-muted-foreground leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card relative flex flex-col rounded-3xl p-6 sm:p-7 ${
        plan.featured
          ? "ring-foreground ring-2"
          : "ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
      }`}
    >
      {plan.featured && (
        <span className="bg-foreground text-background absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold">
          Most Popular
        </span>
      )}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
        <p className="text-muted-foreground text-[14px]">{plan.tagline}</p>
      </div>
      <div className="my-6 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-[-0.03em]">{plan.price}</span>
        <span className="text-muted-foreground text-sm">/mo</span>
      </div>
      <Link
        href={plan.href}
        className={`flex h-11 w-full items-center justify-center rounded-full text-[14px] font-semibold transition-colors ${
          plan.featured
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]"
        }`}
      >
        {plan.cta}
      </Link>
      <p className="text-muted-foreground mt-6 mb-3 text-[12px] font-medium">
        {plan.featuresLabel}
      </p>
      <ul className="space-y-2.5 text-[14px]">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="bg-foreground/[0.07] mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full">
              <Check className="h-2.5 w-2.5" />
            </span>
            <span className="text-muted-foreground leading-snug">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingSection({ showCompare = true }: { showCompare?: boolean }) {
  const { t } = useLanguage();
  const [audience, setAudience] = useState<"personal" | "teams">("personal");

  const freePlan = PERSONAL_PLANS[0];
  const gridPlans = PERSONAL_PLANS.slice(1, 5);
  const enterprisePlan = PERSONAL_PLANS[5];

  return (
    <section id="pricing" className="relative isolate py-24 sm:py-32">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
          <h2 className="text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl">
            {t("pricing.title")}
          </h2>
          <p className="text-muted-foreground text-[17px] leading-relaxed sm:text-xl">
            {t("pricing.subtitle")}
          </p>
          <p className="text-muted-foreground/80 text-[13px]">{t("pricing.note")}</p>
        </div>

        <div
          role="tablist"
          aria-label="Plans for"
          className="bg-foreground/[0.06] mx-auto mb-10 flex w-fit items-center rounded-full p-1 sm:mb-14"
        >
          <button
            type="button"
            role="tab"
            aria-selected={audience === "personal"}
            onClick={() => setAudience("personal")}
            className={`h-10 rounded-full px-5 text-[14px] font-semibold transition-colors ${
              audience === "personal"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pricing.personal")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={audience === "teams"}
            onClick={() => setAudience("teams")}
            className={`h-10 rounded-full px-5 text-[14px] font-semibold transition-colors ${
              audience === "teams"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pricing.teams")}
          </button>
        </div>

        {audience === "personal" ? (
          <div className="space-y-6">
            <PlanCard plan={freePlan} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gridPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
            <PlanCard plan={enterprisePlan} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {TEAM_PLANS.slice(0, 2).map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
            <PlanCard plan={TEAM_PLANS[2]} />
          </div>
        )}

        {showCompare && (
          <div className="mt-20">
            <h3
              id="compare-plans-heading"
              className="mb-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Compare Plans
            </h3>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="compare-plans-heading"
              className="table-wrapper bg-card rounded-3xl p-4 ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]"
            >
              <table className="compare-table text-sm">
                <thead>
                  <tr className="border-border/70 bg-card border-b text-left">
                    <th className="py-3 pr-4 font-medium">Feature</th>
                    <th className="px-3 py-3 text-center font-semibold">Free</th>
                    <th className="px-3 py-3 text-center font-semibold">Basic</th>
                    <th className="px-3 py-3 text-center font-semibold">Starter</th>
                    <th className="px-3 py-3 text-center font-semibold">Studio</th>
                    <th className="px-3 py-3 text-center font-semibold">Studio Max</th>
                  </tr>
                </thead>
                <tbody className="divide-border/50 divide-y">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <th scope="row" className="py-3 pr-4 text-left font-medium">
                        {row.feature}
                      </th>
                      {row.values.map((val, idx) => (
                        <td key={idx} className="text-muted-foreground px-3 py-3 text-center">
                          {typeof val === "boolean" ? (
                            val ? (
                              <>
                                <Check className="mx-auto h-4 w-4 text-emerald-500" aria-hidden="true" />
                                <span className="sr-only">Included</span>
                              </>
                            ) : (
                              <>
                                <Minus className="mx-auto h-4 w-4 opacity-35" aria-hidden="true" />
                                <span className="sr-only">Not included</span>
                              </>
                            )
                          ) : (
                            <span className="font-medium text-foreground/90">{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <span>All plans include free updates and new voice releases. Cancel anytime.</span>
              <span className="hidden sm:inline">•</span>
              <Link href="/pricing" className="text-foreground hover:underline">
                See full pricing
              </Link>
              <span>•</span>
              <Link href="/pricing#faq" className="text-foreground hover:underline">
                Pricing FAQ
              </Link>
              <span>•</span>
              <Link href="/docs" className="text-foreground hover:underline">
                View documentation
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
