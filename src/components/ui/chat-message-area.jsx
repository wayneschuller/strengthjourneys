import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { ChevronDown } from "lucide-react";

export function ScrollButton({
    onClick,
    alignment = "right",
    className
}) {
	const alignmentClasses = {
		left: "left-4",
		center: "left-1/2 -translate-x-1/2",
		right: "right-4",
	};

	return (
        <Button
            variant="secondary"
            size="icon"
            className={cn(
                "absolute bottom-4 rounded-full shadow-lg hover:bg-secondary",
                alignmentClasses[alignment],
                className
            )}
            onClick={onClick}>
            <ChevronDown className="h-4 w-4" />
        </Button>
    );
}

export function ChatMessageArea({
    children,
    className,
    scrollButtonAlignment = "right"
}) {
	const [containerRef, showScrollButton, scrollToBottom] =
		useScrollToBottom();

	return (
        <ScrollArea className="flex-1 relative">
            <div ref={containerRef}>
				<div className={cn(className, "min-h-0")}>{children}</div>
			</div>
            {showScrollButton && (
				<ScrollButton
                    onClick={scrollToBottom}
                    alignment={scrollButtonAlignment}
                    className="absolute bottom-4 rounded-full shadow-lg hover:bg-secondary" />
			)}
        </ScrollArea>
    );
}

ChatMessageArea.displayName = "ChatMessageArea";
