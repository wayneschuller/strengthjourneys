
import { Children, isValidElement } from "react";
import { cn } from "@/lib/utils";
import { StrengthUnwrappedDecemberBanner } from "@/components/year-recap/strength-unwrapped-banner";

/**
 * Centered page wrapper. Tailwind v4 container does not center by default; uses mx-auto per docs.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes.
 * @param {React.ReactNode} props.children - Page content.
 */
export function PageContainer({ className, children, ...props }) {
  return (
    <div className={cn("container mx-auto px-2 sm:px-0", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Page header section with responsive layout. Accepts children; a single
 * PageHeaderRight child is rendered in a right-aligned section on desktop.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes.
 * @param {React.ReactNode} props.children - Header content. Use PageHeaderRight as a child
 *   for right-aligned content (e.g. diagram, controls).
 */
export function PageHeader({ className, children, hideRecapBanner, ...props }) {
  const childArray = Children.toArray(children);
  const rightSections = childArray.filter(
    (child) => isValidElement(child) && child.type === PageHeaderRight,
  );
  const rightSection = rightSections[0];

  if (process.env.NODE_ENV !== "production" && rightSections.length > 1) {
    console.warn(
      "PageHeader received multiple PageHeaderRight children. Only the first will be rendered.",
    );
  }

  const content = childArray.filter(
    (child) => !(isValidElement(child) && child.type === PageHeaderRight),
  );

  return (
    <section
      className={cn(
        "flex w-full flex-col items-start gap-8 px-3 pb-8 sm:px-[2vw] md:flex-row md:items-start md:justify-between md:gap-4 md:px-[3vw] lg:px-[4vw] xl:px-[5vw]",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {content}
        <StrengthUnwrappedDecemberBanner
          className="mt-6"
          hidden={hideRecapBanner}
        />
      </div>
      {rightSection}
    </section>
  );
}

/**
 * Right-aligned section for PageHeader. Use as a child of PageHeader to place
 * content (e.g. diagram, controls) on the right side on desktop.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes.
 * @param {React.ReactNode} props.children - Right-section content.
 */
export function PageHeaderRight({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center md:w-auto",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
PageHeaderRight.displayName = "PageHeaderRight";

/**
 * Page title (h1) with optional icon. Typically used inside PageHeader.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes.
 * @param {React.Component} [props.icon] - Lucide icon component to show before the heading.
 * @param {React.ReactNode} props.children - Heading text.
 */
export function PageHeaderHeading({ className, icon: Icon, ...props }) {
  return (
    <h1
      className={cn(
        "flex items-center text-3xl leading-tight font-bold tracking-tighter md:text-4xl lg:leading-[1.1]",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="mr-2 h-8 w-8" />}
      {props.children}
    </h1>
  );
}

/**
 * Subtitle/description text for a page header. Typically used below PageHeaderHeading.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes.
 * @param {React.ReactNode} props.children - Description content.
 */
export function PageHeaderDescription({ className, ...props }) {
  return (
    <div
      className={cn(
        "text-foreground max-w-4xl text-lg font-light text-pretty",
        className,
      )}
      {...props}
    />
  );
}
