/** @format */

"use client";
import { featurePages } from "@/pages";

export function Footer() {
  // return null;

  return (
    <footer className="py-6 md:px-8 md:py-0">
      <div className="container flex flex-col items-center gap-2 text-muted-foreground md:h-24 md:flex-row md:gap-4">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built by{" "}
          <a
            href="https://x.com/wayneschuller"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            Wayne Schuller
          </a>
          .
        </p>
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          The source code is available on{" "}
          <a
            href="https://github.com/wayneschuller/strengthjourneys"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </p>
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          Buy me a{" "}
          <a
            href="https://buymeacoffee.com/lrhvbjxzqr"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            coffee
          </a>
          .
        </p>
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          <a
            data-canny-link
            className="font-medium underline underline-offset-4"
            href="https://strengthjourneys.canny.io/feature-requests"
          >
            Give feedback
          </a>
        </p>
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          <a
            href="https://strengthjourneys.canny.io/changelog"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            Full Changelog
          </a>
        </p>
      </div>
    </footer>
  );
}
