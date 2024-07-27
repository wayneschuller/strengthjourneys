"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ViewVerticalIcon } from "@radix-ui/react-icons";
import { featurePages } from "@/pages";
import Image from "next/image";
import { useTheme } from "next-themes";

// import Logo from "../../public/logo_transparent.png";
// import Image from "next/image";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const pathname = usePathname();
  const iconSize = 16;
  const iconStrokeWidth = 1.25;

  const nav_logo =
    theme === "light" ? "/nav_logo_dark.png" : "/nav_logo_light.png";

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
        >
          <ViewVerticalIcon className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <div className="flex flex-col">
          <SheetClose asChild>
            <Link href="/" className="flex flex-col">
              <Image
                src={nav_logo}
                width={100}
                height={80}
                alt="logo"
                className="inline-block"
              />
              <span className="mb-6 inline-block text-xl font-bold">
                Strength Journeys Home
              </span>
            </Link>
          </SheetClose>
          <div className="flex flex-1 flex-col gap-4 text-lg font-medium">
            {featurePages.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
