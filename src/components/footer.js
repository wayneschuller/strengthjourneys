/** @format */

import Link from "next/link";
import { PageContainer } from "@/components/page-header";

const TOOLS = [
  { href: "/calculator", label: "One Rep Max Calculator" },
  { href: "/1000lb-club-calculator", label: "1000lb Club Calculator" },
  { href: "/big-four-strength-standards-calculator", label: "Strength Standards" },
  { href: "/how-strong-am-i", label: "How Strong Am I?" },
  { href: "/warm-up-sets-calculator", label: "Warm Up Sets Calculator" },
  { href: "/ai-lifting-assistant", label: "AI Lifting Assistant" },
];

const RESOURCES = [
  { href: "/articles", label: "Strength Articles" },
  { href: "/analyzer", label: "PR Analyzer" },
  { href: "/visualizer", label: "Strength Visualizer" },
  { href: "/tonnage", label: "Tonnage Tracker" },
  { href: "/gym-playlist-leaderboard", label: "Gym Playlists" },
  { href: "/changelog", label: "Changelog" },
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
              href="https://github.com/wayneschuller/strengthjourneys"
              label="GitHub (open source)"
              external
            />
            <FooterLink
              href="https://strengthjourneys.canny.io/feature-requests"
              label="Feature requests"
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

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Strength Journeys · Free and open source · Your data stays
          yours
        </div>
      </PageContainer>
    </footer>
  );
}
