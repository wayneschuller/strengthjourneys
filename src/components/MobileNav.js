"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ViewVerticalIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/router";

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

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
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
              <span className="inline-block font-bold">Strength Journeys</span>
            </Link>
          </SheetClose>

          <div className="flex flex-1 flex-col  gap-4 text-base font-medium">
            <SheetClose asChild>
              <Link
                href="/analyzer"
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === "/analyzer"
                    ? "text-foreground"
                    : "text-foreground/60",
                )}
              >
                PR Analyzer
              </Link>
            </SheetClose>

            <SheetClose asChild>
              <Link
                href="/visualizer"
                onOpenChange={setOpen}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === "/visualizer"
                    ? "text-foreground"
                    : "text-foreground/60",
                )}
              >
                Strength Visualizer
              </Link>
            </SheetClose>

            <SheetClose asChild>
              <Link
                href="/calculator"
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === "/calculator"
                    ? "text-foreground"
                    : "text-foreground/60",
                )}
              >
                One Rep Max Calculator
              </Link>
            </SheetClose>

            <SheetClose asChild>
              <Link
                href="/timer"
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === "/timer"
                    ? "text-foreground"
                    : "text-foreground/60",
                )}
              >
                Lifting Set Timer
              </Link>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
