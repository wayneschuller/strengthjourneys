/** @format */

import Link from "next/link";
import { PageContainer } from "@/components/page-header";

const TOOLS = [
  { href: "/calculator", label: "One Rep Max Calculator" },
  { href: "/strength-levels", label: "Strength Levels" },
  { href: "/how-strong-am-i", label: "How Strong Am I?" },
  { href: "/warm-up-sets-calculator", label: "Warm Up Sets Calculator" },
  { href: "/ai-lifting-assistant", label: "AI Lifting Assistant" },
];

const LIFT_CALCULATORS = [
  { href: "/calculator/squat-1rm-calculator", label: "Squat 1RM Calculator" },
  { href: "/calculator/bench-press-1rm-calculator", label: "Bench Press 1RM Calculator" },
  { href: "/calculator/deadlift-1rm-calculator", label: "Deadlift 1RM Calculator" },
  { href: "/calculator/strict-press-1rm-calculator", label: "Strict Press 1RM Calculator" },
];

const FORMULA_CALCULATORS = [
  { href: "/calculator/epley-formula-1rm-calculator", label: "Epley Formula 1RM Calculator" },
  { href: "/calculator/brzycki-formula-1rm-calculator", label: "Brzycki Formula 1RM Calculator" },
  { href: "/calculator/mayhew-1rm-formula-calculator", label: "Mayhew Formula 1RM Calculator" },
  { href: "/calculator/wathan-1rm-formula-calculator", label: "Wathan Formula 1RM Calculator" },
  { href: "/calculator/mcglothin-formula-1rm-calculator", label: "McGlothin Formula 1RM Calculator" },
  { href: "/calculator/lombardi-formula-1rm-calculator", label: "Lombardi Formula 1RM Calculator" },
  { href: "/calculator/oconner-formula-1rm-calculator", label: "O'Conner Formula 1RM Calculator" },
];

const STRENGTH_STANDARDS_LINKS = [
  { href: "/strength-levels/squat", label: "Squat Strength Levels" },
  { href: "/strength-levels/bench-press", label: "Bench Press Strength Levels" },
  { href: "/strength-levels/deadlift", label: "Deadlift Strength Levels" },
  { href: "/strength-levels/strict-press", label: "Strict Press Strength Levels" },
  { href: "/1000lb-club-calculator", label: "1000lb Club" },
  { href: "/200-300-400-500-strength-club-calculator", label: "200/300/400/500 Club" },
];

const RESOURCES = [
  { href: "/articles", label: "Strength Articles" },
  { href: "/lift-explorer", label: "Lift Explorer" },
  { href: "/visualizer", label: "Strength Visualizer" },
  { href: "/tonnage", label: "Tonnage Metrics" },
  { href: "/timer", label: "Gym Timer" },
  { href: "/gym-playlist-leaderboard", label: "Gym Playlists" },
];

const LEGAL = [
  { href: "/privacy-policy.html", label: "Privacy Policy" },
  { href: "/terms-of-service.html", label: "Terms of Service" },
];

function FooterLink({ href, label, external }) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function FooterSection({ title, children }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

/**
 * Site-wide footer with tool links, resources, legal pages, and author info.
 */
export function Footer() {
  return (
    <footer className="mt-16 border-t">
      <PageContainer className="py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <FooterSection title="Tools">
            {TOOLS.map(({ href, label }) => (
              <FooterLink key={href} href={href} label={label} />
            ))}
          </FooterSection>

          <FooterSection title="Resources">
            {RESOURCES.map(({ href, label }) => (
              <FooterLink key={href} href={href} label={label} />
            ))}
          </FooterSection>

          <FooterSection title="Project">
            <FooterLink
              href="https://strengthjourneys.canny.io/changelog"
              label="What's new"
              external
            />
            <FooterLink
              href="https://strengthjourneys.canny.io/feature-requests"
              label="Feature requests"
              external
            />
            <FooterLink
              href="https://github.com/wayneschuller/strengthjourneys"
              label="GitHub (open source)"
              external
            />
            <FooterLink
              href="https://buymeacoffee.com/lrhvbjxzqr"
              label="Buy me a coffee"
              external
            />
            <FooterLink href="https://x.com/wayneschuller" label="@wayneschuller" external />
          </FooterSection>

          <FooterSection title="Legal">
            {LEGAL.map(({ href, label }) => (
              <FooterLink key={href} href={href} label={label} />
            ))}
          </FooterSection>
        </div>

        <div className="mt-8 border-t pt-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">
                More Calculators
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[...LIFT_CALCULATORS, ...FORMULA_CALCULATORS].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">
                Strength Standards & Levels
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {STRENGTH_STANDARDS_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Strength Journeys · Free and open source · Your data stays
          yours
        </div>
      </PageContainer>
    </footer>
  );
}
