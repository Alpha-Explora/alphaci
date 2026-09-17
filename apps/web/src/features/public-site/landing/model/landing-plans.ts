export type LandingPlanStatus = "available" | "coming_soon";

export interface LandingPlan {
  id: string;
  name: string;
  description: string;
  priceAmount: number | null;
  currency: "PHP";
  interval: "month" | "year" | null;
  priceLabel: string;
  periodLabel: string;
  priceCompact: string;
  status: LandingPlanStatus;
  featured: boolean;
  apiCode: null;
  billingCode: string | null;
  tagline: string;
  useCase: string;
  whyThisPlan: string | null;
  features: Array<{ label: string; included: boolean }>;
  comparisonValues: string[];
}

// Replace these placeholders with the billing.checkout capability when billing is implemented.
export const LANDING_PLACEHOLDER_PLANS: LandingPlan[] = [
  {
    id: "solo_basic",
    name: "Solo Basic",
    description: "For active builders shipping small projects with recurring automation needs.",
    priceAmount: 399,
    currency: "PHP",
    interval: "month",
    priceLabel: "₱399",
    periodLabel: "/ month",
    priceCompact: "₱399.00",
    status: "available",
    featured: true,
    apiCode: null,
    billingCode: null,
    tagline: "Ship cleanly with governed workflows.",
    useCase: "Best for individual developers.",
    whyThisPlan: null,
    features: [
      { label: "Governed projects, branches, and deployments", included: true },
      { label: "Managed environments and workflow updates", included: true },
      { label: "Usage quotas and plan limits", included: true },
      { label: "Workspace members and role-based access", included: true },
    ],
    comparisonValues: ["₱399", "Yes", "Yes", "Unlimited"],
  },
  {
    id: "solo_plus",
    name: "Solo Plus",
    description: "For teams that need pooled usage, shared governance, and audit history.",
    priceAmount: null,
    currency: "PHP",
    interval: null,
    priceLabel: "Coming soon",
    periodLabel: "",
    priceCompact: "Custom",
    status: "coming_soon",
    featured: false,
    apiCode: null,
    billingCode: null,
    tagline: "More shared control is on the way.",
    useCase: "Best for growing development teams.",
    whyThisPlan: "Team controls and pooled credits are planned.",
    features: [
      { label: "Pooled workspace credits", included: true },
      { label: "Team roles and shared controls", included: true },
      { label: "Audit and release history", included: true },
      { label: "Higher usage needs", included: true },
    ],
    comparisonValues: ["Pooled credits planned", "Higher team usage", "Team review controls", "Shared history"],
  },
  {
    id: "business",
    name: "AlphaCI Business",
    description: "For organizations that need advanced controls, support, and custom scale.",
    priceAmount: null,
    currency: "PHP",
    interval: null,
    priceLabel: "Coming soon",
    periodLabel: "",
    priceCompact: "Contact sales",
    status: "coming_soon",
    featured: false,
    apiCode: null,
    billingCode: null,
    tagline: "Governance for teams at organizational scale.",
    useCase: "Best for organizations and platform teams.",
    whyThisPlan: "Advanced governance and assisted onboarding are planned.",
    features: [
      { label: "Advanced governance", included: true },
      { label: "Custom usage planning", included: true },
      { label: "Priority support path", included: true },
      { label: "Future custom terms", included: true },
    ],
    comparisonValues: ["Custom scale planned", "Custom usage planning", "Advanced controls", "Dedicated support"],
  },
];

