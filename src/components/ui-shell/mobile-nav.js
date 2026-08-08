/**
 * Mobile navigation trigger and slide-out destination menu.
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Crown, Luggage, Menu, Shield, Skull } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeChooser } from "@/components/ui-shell/theme-chooser";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getLogoForTheme } from "@/lib/theme-logos";
import { cn } from "@/lib/utils";
import { featurePages } from "@/pages";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Slide-out mobile navigation drawer triggered by a hamburger button.
 * Renders the app logo, all feature page links, and Big Four lift insight links inside a shadcn Sheet.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { hasUserData } = useUserLiftingData();
  const logoWidth = 150;
  const { resolvedTheme, theme } = useTheme();
  const [logoSrc, setLogoSrc] = useState(() => {
    // Start with default theme for SSR/hydration consistency
    return getLogoForTheme("light");
  });

  // Set logo on mount and when theme changes
  useEffect(() => {
    let currentTheme = theme ?? resolvedTheme;
    
    // If theme not yet resolved, try to get from localStorage
    if (!currentTheme && typeof window !== "undefined") {
      const storedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME);
      if (storedTheme) {
        currentTheme = storedTheme;
      }
    }
    
    setLogoSrc(getLogoForTheme(currentTheme || "light"));
  }, [theme, resolvedTheme]);

  const lifts = bigFourLiftInsightData;

  const bigFourIcons = {
    "Back Squat": Crown,
    "Bench Press": Shield,
    Deadlift: Skull,
    "Strict Press": Luggage,
  };

  // Internal nav link row: icon + label, highlights the active route.
  const NavLink = ({ href, title, IconComponent }) => (
    <SheetClose asChild>
      <Link
        href={href}
        className={cn(
          "flex flex-row items-center gap-3 transition-colors hover:text-foreground/80",
          pathname === href ? "text-foreground" : "text-foreground/60",
        )}
      >
        <IconComponent size={24} strokeWidth={1} />
        {title}
      </Link>
    </SheetClose>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="px-2 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          aria-expanded={open}
        >
          <Menu className="h-7 w-7 sm:mr-2" />
          <div className="hidden tracking-tight sm:block">Strength Journeys</div>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col pr-0">
        <SheetHeader>
          <SheetTitle>
            <SheetClose asChild>
              <Link href="/" className="flex flex-col">
                {/* <span className="inline-block text-xl text-left font-bold tracking-tighter"> Strength Journeys Home </span> */}
                <Image
                  src={logoSrc}
                  key={logoSrc}
                  width={logoWidth}
                  height="auto"
                  alt="Strength Journeys logo"
                  className="inline-block origin-left scale-[1.2] rounded-lg"
                />
              </Link>
            </SheetClose>
          </SheetTitle>
          <SheetDescription></SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-6">
          <div className="flex flex-col gap-4 text-lg font-medium tracking-tight">
            {featurePages
              .filter((item) => !item.authRequired || hasUserData)
              .map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            {lifts.map((lift) => (
              <NavLink
                key={lift.slug}
                href={"/progress-guide/" + lift.slug}
                title={`${lift.liftType} Insights`}
                IconComponent={bigFourIcons[lift.liftType]}
              />
            ))}
          </div>
        </div>
        <div className="border-border flex shrink-0 items-center justify-between border-t pt-4 pr-6">
          <div>
            <p className="text-sm font-medium">Appearance</p>
            <p className="text-muted-foreground text-xs">
              Theme and background
            </p>
          </div>
          <ThemeChooser />
        </div>
      </SheetContent>
    </Sheet>
  );
}
