export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  price: string | null;
  priceValue: number | null;
  cta: string;
  href: string;
  featured?: boolean;
  wide?: boolean;
  featuresLabel: string;
  features: string[];
}

export const PERSONAL_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Perfect to get started",
    price: "$0",
    priceValue: 0,
    cta: "Get started free",
    href: "/dashboard",
    wide: true,
    featuresLabel: "Includes",
    features: [
      "2,000 credits / month (~6 min of audio)",
      "Or ~10 min of speech-to-text",
      "1 custom voice clone",
      "Voice cloning from just 10 seconds of audio",
      "Access to standard voice library",
      "Transcribe and history features",
      "No credit card required",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "For light personal use",
    price: "$2.99",
    priceValue: 2.99,
    cta: "Get started",
    href: "/dashboard",
    featuresLabel: "Includes",
    features: [
      "30,000 credits / month (~90 min of audio)",
      "Or ~170 min of speech-to-text",
      "10 custom voice clones",
      "Everything in Free",
      "Higher quality voice output",
      "Commercial use license",
      "Email support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For individuals and side projects",
    price: "$6.99",
    priceValue: 6.99,
    cta: "Get started",
    href: "/dashboard",
    featuresLabel: "Includes",
    features: [
      "70,000 credits / month (~210 min of audio)",
      "Or ~390 min of speech-to-text",
      "Everything in Basic",
      "20 custom voice clones",
      "Higher quality voice output",
      "Commercial use license included",
      "Advanced voice customization controls",
      "Priority processing",
      "API access",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For creators and growing teams",
    price: "$11.99",
    priceValue: 11.99,
    cta: "Get started",
    href: "/dashboard",
    featured: true,
    featuresLabel: "Includes",
    features: [
      "150,000 credits / month (~450 min of audio)",
      "Or ~830 min of speech-to-text",
      "Everything in Starter",
      "No cap on saved voice profiles",
      "Maximum voice output quality",
      "Fastest priority processing",
      "Full commercial use license",
      "API access",
      "Priority support",
    ],
  },
  {
    id: "studio_max",
    name: "Studio Max",
    tagline: "For studios and high-volume apps",
    price: "$49.99",
    priceValue: 49.99,
    cta: "Get started",
    href: "/dashboard",
    featuresLabel: "Includes",
    features: [
      "800,000 credits / month (~2,400 min of audio)",
      "Or ~4,400 min of speech-to-text",
      "Everything in Studio",
      "No cap on saved voice profiles",
      "Maximum voice output quality",
      "Fastest priority processing",
      "Full commercial use license",
      "Advanced customization & controls",
      "Dedicated support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For large organizations",
    price: null,
    priceValue: null,
    cta: "Contact Sales",
    href: "/contact",
    wide: true,
    featuresLabel: "Everything in Studio Max, plus",
    features: [
      "Unlimited credits",
      "Unlimited speech-to-text",
      "Everything in Studio Max",
      "No cap on saved voice profiles",
      "Custom voice training",
      "On-premise deployment option",
      "Team workspace with unlimited seats and roles",
      "Single sign-on (OpenID Connect: JumpCloud, Okta, Entra ID)",
      "Custom SLA & uptime guarantee",
      "Dedicated account manager",
    ],
  },
];

export const TEAM_PLANS: PricingPlan[] = [
  {
    id: "team",
    name: "Team",
    tagline: "For small teams sharing one pool of credits",
    price: "$19.99",
    priceValue: 19.99,
    cta: "Start a team",
    href: "/dashboard",
    featuresLabel: "Includes",
    features: [
      "200,000 credits / month, shared by the team",
      "5 seats with owner, admin, billing and member roles",
      "Shared API keys, projects and history",
      "API access",
      "100 API requests a minute",
      "10 realtime sessions at once",
      "Buy extra credits whenever you run short",
    ],
  },
  {
    id: "team_pro",
    name: "Team Pro",
    tagline: "For teams shipping with voice every day",
    price: "$69.99",
    priceValue: 69.99,
    cta: "Start a team",
    href: "/dashboard",
    featured: true,
    featuresLabel: "Everything in Team, plus",
    features: [
      "1,000,000 credits / month, shared by the team",
      "20 seats",
      "Professional voice clones",
      "500 API requests a minute",
      "20 realtime sessions at once",
      "Priority processing queue",
      "Priority email & Telegram support",
    ],
  },
  {
    id: "team_scale",
    name: "Enterprise Team",
    tagline: "Custom SLAs, SSO and dedicated capacity",
    price: null,
    priceValue: null,
    cta: "Contact Sales",
    href: "/contact",
    wide: true,
    featuresLabel: "Everything in Team Pro, plus",
    features: [
      "Unlimited seats and workspace roles",
      "Single sign-on (JumpCloud, Okta, Entra ID)",
      "Dedicated GPU inference & custom voice training",
      "On-premise or VPC deployment",
      "99.95% uptime SLA",
    ],
  },
];

export interface ComparisonRow {
  feature: string;
  values: [string | boolean, string | boolean, string | boolean, string | boolean, string | boolean];
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Monthly credits (est. audio)",
    values: [
      "2,000 (~6 min)",
      "30,000 (~90 min)",
      "70,000 (~210 min)",
      "150,000 (~450 min)",
      "800,000 (~2,400 min)",
    ],
  },
  {
    feature: "Speech-to-text (est. audio)",
    values: ["~10 min", "~170 min", "~390 min", "~830 min", "~4,400 min"],
  },
  {
    feature: "Custom voice clones",
    values: ["1", "10", "20", "No limit", "No limit"],
  },
  { feature: "Voice cloning from 10s audio", values: [true, true, true, true, true] },
  { feature: "Standard voice library", values: [true, true, true, true, true] },
  { feature: "Transcribe & history", values: [true, true, true, true, true] },
  { feature: "Higher quality voice output", values: [false, true, true, true, true] },
  { feature: "Commercial use license", values: [false, true, true, true, true] },
  { feature: "Advanced voice customization", values: [false, false, true, true, true] },
  { feature: "Priority processing", values: [false, false, true, true, true] },
  { feature: "Maximum voice output quality", values: [false, false, false, true, true] },
  { feature: "Full commercial use license", values: [false, false, false, true, true] },
  { feature: "API access", values: [false, false, true, true, true] },
  { feature: "Fastest priority processing", values: [false, false, false, true, true] },
  { feature: "Dedicated support", values: [false, false, false, false, true] },
  { feature: "Support tier", values: ["Community", "Email", "Email", "Priority", "Dedicated"] },
  { feature: "Price / month", values: ["$0", "$2.99", "$6.99", "$11.99", "$49.99"] },
];
