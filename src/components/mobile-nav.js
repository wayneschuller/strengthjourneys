"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ViewVerticalIcon } from "@radix-ui/react-icons";
import { Menu } from "lucide-react";
import { featurePages } from "@/pages";
import Image from "next/image";
import { useTheme } from "next-themes";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getLogoForTheme } from "@/lib/theme-logos";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Crown, Shield, Skull, Luggage } from "lucide-react";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
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
          <Menu className="mr-2 h-7 w-7" />
          <div className="tracking-tight">Strength Journeys</div>
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
                  alt="logo"
                  className="inline-block rounded-lg"
                />
              </Link>
            </SheetClose>
          </SheetTitle>
          <SheetDescription></SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 text-lg font-medium tracking-tight">
            {featurePages.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
            {lifts.map((lift) => (
              <NavLink
                key={lift.slug}
                href={lift.slug}
                title={`${lift.liftType} Insights`}
                IconComponent={bigFourIcons[lift.liftType]}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
