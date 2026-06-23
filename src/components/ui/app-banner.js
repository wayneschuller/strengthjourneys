/**
 * Reusable tinted banners for in-app notices, demo mode, promos, and soft CTAs.
 *
 * Two layouts share the same tint palette:
 * - strip: full-width bar under the nav (demo mode, import preview, data quality)
 * - card: rounded inset promo block (seasonal features, page-level nudges)
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Matches the main content horizontal inset used across the app shell. */
export const APP_BANNER_STRIP_INSET =
  "mx-0 md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]";

const bannerRootVariants = cva("", {
  variants: {
    tint: {
      amber:
        "border-amber-200/80 bg-amber-100/60 dark:border-amber-800/70 dark:bg-amber-950/50",
      amberAlert:
        "border-amber-300 bg-amber-50/90 dark:border-amber-800/70 dark:bg-amber-950/70",
      blue: "border-blue-200 bg-blue-50/80 dark:border-blue-800/60 dark:bg-blue-950/50",
      primary:
        "border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10",
    },
    layout: {
      strip: "mb-3 w-full border-y",
      card: "w-full rounded-xl border p-4 md:p-6",
    },
  },
  defaultVariants: {
    tint: "amber",
    layout: "strip",
  },
});

const bannerMessageVariants = cva("text-sm leading-tight", {
  variants: {
    tint: {
      amber: "text-amber-950 dark:text-amber-100",
      amberAlert: "text-amber-950 dark:text-amber-100",
      blue: "text-blue-900 dark:text-blue-200",
      primary: "text-foreground",
    },
  },
  defaultVariants: {
    tint: "amber",
  },
});

const bannerHintVariants = cva("text-center text-xs", {
  variants: {
    tint: {
      amber: "text-amber-900/70 dark:text-amber-200/70",
      amberAlert: "text-amber-900/70 dark:text-amber-200/70",
      blue: "text-blue-700/70 dark:text-blue-300/60",
      primary: "text-muted-foreground",
    },
  },
  defaultVariants: {
    tint: "amber",
  },
});

const bannerContentVariants = cva(
  cn("px-4 text-center", APP_BANNER_STRIP_INSET),
  {
    variants: {
      layout: {
        strip: "",
        card: "mx-0 px-0 text-left md:px-0",
      },
      density: {
        comfortable: "flex flex-col items-center justify-center gap-3 py-3",
        compact:
          "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2.5",
        card: "flex flex-col items-stretch justify-between gap-4 p-0 md:flex-row md:items-center",
      },
    },
    defaultVariants: {
      layout: "strip",
      density: "comfortable",
    },
  },
);

export const bannerAccentButtonClassName = cva("", {
  variants: {
    tint: {
      amber:
        "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500",
      amberAlert:
        "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500",
      blue: "border-blue-300 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600",
      primary: "",
    },
  },
  defaultVariants: {
    tint: "amber",
  },
});

export const bannerGhostButtonClassName = cva("h-7 text-xs", {
  variants: {
    tint: {
      amber:
        "text-amber-900/70 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-900/50",
      amberAlert:
        "text-amber-900/70 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-900/50",
      blue: "text-blue-800/60 hover:bg-blue-100 hover:text-blue-950 dark:text-blue-400/60 dark:hover:bg-blue-900/50",
      primary: "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
    },
  },
  defaultVariants: {
    tint: "amber",
  },
});

const BannerContext = React.createContext({
  tint: "amber",
  layout: "strip",
});

function useBannerContext() {
  return React.useContext(BannerContext);
}

/**
 * Root banner wrapper. Use strip layout under the nav; card layout inside page content.
 */
const AppBanner = React.forwardRef(function AppBanner(
  { className, tint = "amber", layout = "strip", as: Component = "section", children, ...props },
  ref,
) {
  return (
    <BannerContext.Provider value={{ tint, layout }}>
      <Component
        ref={ref}
        className={cn(bannerRootVariants({ tint, layout }), className)}
        {...props}
      >
        {children}
      </Component>
    </BannerContext.Provider>
  );
});
AppBanner.displayName = "AppBanner";

const AppBannerContent = React.forwardRef(function AppBannerContent(
  { className, density, layout: layoutProp, ...props },
  ref,
) {
  const { layout } = useBannerContext();
  const resolvedLayout = layoutProp || layout;
  const resolvedDensity =
    density || (resolvedLayout === "card" ? "card" : "comfortable");

  return (
    <div
      ref={ref}
      className={cn(
        bannerContentVariants({
          layout: resolvedLayout,
          density: resolvedDensity,
        }),
        className,
      )}
      {...props}
    />
  );
});
AppBannerContent.displayName = "AppBannerContent";

const AppBannerMessage = React.forwardRef(function AppBannerMessage(
  { className, tint: tintProp, ...props },
  ref,
) {
  const { tint } = useBannerContext();

  return (
    <p
      ref={ref}
      className={cn(bannerMessageVariants({ tint: tintProp || tint }), className)}
      {...props}
    />
  );
});
AppBannerMessage.displayName = "AppBannerMessage";

const AppBannerHint = React.forwardRef(function AppBannerHint(
  { className, tint: tintProp, size = "xs", ...props },
  ref,
) {
  const { tint } = useBannerContext();

  return (
    <p
      ref={ref}
      className={cn(
        bannerHintVariants({ tint: tintProp || tint }),
        size === "2xs" && "text-[11px]",
        className,
      )}
      {...props}
    />
  );
});
AppBannerHint.displayName = "AppBannerHint";

const AppBannerActions = React.forwardRef(function AppBannerActions(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center",
        className,
      )}
      {...props}
    />
  );
});
AppBannerActions.displayName = "AppBannerActions";

const AppBannerActionGroup = React.forwardRef(function AppBannerActionGroup(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col items-center", className)}
      {...props}
    />
  );
});
AppBannerActionGroup.displayName = "AppBannerActionGroup";

const AppBannerLeading = React.forwardRef(function AppBannerLeading(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-3", className)}
      {...props}
    />
  );
});
AppBannerLeading.displayName = "AppBannerLeading";

const AppBannerIconBadge = React.forwardRef(function AppBannerIconBadge(
  { className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("rounded-lg bg-primary/20 p-2", className)}
      {...props}
    >
      {children}
    </div>
  );
});
AppBannerIconBadge.displayName = "AppBannerIconBadge";

const AppBannerTitle = React.forwardRef(function AppBannerTitle(
  { className, ...props },
  ref,
) {
  return (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
});
AppBannerTitle.displayName = "AppBannerTitle";

const AppBannerDescription = React.forwardRef(function AppBannerDescription(
  { className, ...props },
  ref,
) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
AppBannerDescription.displayName = "AppBannerDescription";

const AppBannerCopy = React.forwardRef(function AppBannerCopy(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("space-y-0.5", className)} {...props} />;
});
AppBannerCopy.displayName = "AppBannerCopy";

export {
  AppBanner,
  AppBannerActionGroup,
  AppBannerActions,
  AppBannerContent,
  AppBannerCopy,
  AppBannerDescription,
  AppBannerHint,
  AppBannerIconBadge,
  AppBannerLeading,
  AppBannerMessage,
  AppBannerTitle,
  bannerMessageVariants,
  bannerRootVariants,
};
