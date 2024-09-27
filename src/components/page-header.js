import { cn } from "@/lib/utils";

export function PageHeader({ className, children, ...props }) {
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
    <p
      className={cn(
        "max-w-3xl text-balance text-lg font-light text-foreground",
        className,
      )}
      {...props}
    />
  );
}
