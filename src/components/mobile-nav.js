"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ViewVerticalIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/router";

import { featurePages } from "@/pages";

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
  const pathname = usePathname();
  const iconSize = 16;
  const iconStrokeWidth = 1.25;

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
            <Link href="/" className="mb-6 flex gap-4">
              {/* <Image src={Logo} className="h-10 w-10" alt="Logo" /> */}
              <span className="inline-block text-xl font-bold">
                Strength Journeys
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
