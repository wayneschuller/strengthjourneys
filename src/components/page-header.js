import { cn } from "@/lib/utils";

export function PageHeader({ className, children, ...props }) {
  return (
    <section
      className={cn(
        "mx-auto flex flex-col items-start justify-between gap-2 px-4 pb-8 md:flex-row md:items-center",
        className,
      )}
      {...props}
    >
      <div>{children}</div>
      <PageHeaderRightSection className="mt-4 md:ml-auto md:mt-0" />
    </section>
  );
}

export function PageHeaderOld({ className, children, ...props }) {
  return (
    <section
      className={cn(
        "mx-auto flex flex-col items-start gap-2 px-4 pb-8",
        // "mx-auto flex flex-col items-start gap-2 px-4 py-8 md:py-12 md:pb-8 lg:py-12 lg:pb-10",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

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

// Define the right section subcomponent
export function PageHeaderRightSection({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex w-full items-center md:w-auto", // full width on mobile, auto on larger screens
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
