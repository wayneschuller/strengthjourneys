import { cn } from "@/lib/utils";

export function PageHeader({ className, children, ...props }) {
  // Find the right section if it exists
  const rightSection = children?.find(
    (child) => child?.type?.displayName === "PageHeaderRight",
  );

  // Get all other children
  const content = children?.filter(
    (child) => child?.type?.displayName !== "PageHeaderRight",
  );

  return (
    <section
      className={cn(
        "mx-auto flex w-full flex-col items-start gap-8 px-4 pb-8 md:flex-row md:items-start md:justify-between md:gap-4",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">{content}</div>
      {rightSection}
    </section>
  );
}

// Use displayName to identify this component
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

export function PageHeaderHeading({ className, icon: Icon, ...props }) {
  return (
    <h1
      className={cn(
        "flex items-center text-3xl font-bold leading-tight tracking-tighter md:text-4xl lg:leading-[1.1]",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="mr-2 h-8 w-8" />}
      {props.children}
    </h1>
  );
}

export function PageHeaderDescription({ className, ...props }) {
  return (
    <div
      className={cn(
        "max-w-4xl text-pretty text-lg font-light text-foreground",
        className,
      )}
      {...props}
    />
  );
}
