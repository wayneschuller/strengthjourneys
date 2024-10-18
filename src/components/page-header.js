import { cn } from "@/lib/utils";

export function PageHeader({ className, children, rightSection, ...props }) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full flex-col items-start gap-4 px-4 pb-8 md:flex-row md:items-start md:justify-between md:gap-4",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {rightSection}
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

export function PageHeaderRightSection({ className, children, ...props }) {
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
