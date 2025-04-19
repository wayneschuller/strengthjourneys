"use client";;
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTextareaResize } from "@/hooks/use-textarea-resize";
import { ArrowUpIcon } from "lucide-react";
import { createContext, useContext } from "react";

const ChatInputContext = createContext({});

function ChatInput({
    children,
    className,
    variant = "default",
    value,
    onChange,
    onSubmit,
    loading,
    onStop,
    rows = 1
}) {
	const contextValue = {
		value,
		onChange,
		onSubmit,
		loading,
		onStop,
		variant,
		rows,
	};

	return (
        <ChatInputContext.Provider value={contextValue}>
            <div
                className={cn(variant === "default" &&
                    "flex flex-col items-end w-full p-2 rounded-2xl border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring focus-within:outline-none", variant === "unstyled" && "flex items-start gap-2 w-full", className)}>
				{children}
			</div>
        </ChatInputContext.Provider>
    );
}

ChatInput.displayName = "ChatInput";

function ChatInputTextArea({
    onSubmit: onSubmitProp,
    value: valueProp,
    onChange: onChangeProp,
    className,
    variant: variantProp,
    ...props
}) {
	const context = useContext(ChatInputContext);
	const value = valueProp ?? context.value ?? "";
	const onChange = onChangeProp ?? context.onChange;
	const onSubmit = onSubmitProp ?? context.onSubmit;
	const rows = context.rows ?? 1;

	// Convert parent variant to textarea variant unless explicitly overridden
	const variant =
		variantProp ?? (context.variant === "default" ? "unstyled" : "default");

	const textareaRef = useTextareaResize(value, rows);
	const handleKeyDown = (e) => {
		if (!onSubmit) {
			return;
		}
		if (e.key === "Enter" && !e.shiftKey) {
			if (typeof value !== "string" || value.trim().length === 0) {
				return;
			}
			e.preventDefault();
			onSubmit();
		}
	};

	return (
        <Textarea
            ref={textareaRef}
            {...props}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            className={cn(
                "max-h-[400px] min-h-0 resize-none overflow-x-hidden",
                variant === "unstyled" &&
					"border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
                className
            )}
            rows={rows} />
    );
}

ChatInputTextArea.displayName = "ChatInputTextArea";

function ChatInputSubmit({
    onSubmit: onSubmitProp,
    loading: loadingProp,
    onStop: onStopProp,
    className,
    ...props
}) {
	const context = useContext(ChatInputContext);
	const loading = loadingProp ?? context.loading;
	const onStop = onStopProp ?? context.onStop;
	const onSubmit = onSubmitProp ?? context.onSubmit;

	if (loading && onStop) {
		return (
            <Button
                onClick={onStop}
                className={cn("shrink-0 rounded-full p-1.5 h-fit border dark:border-zinc-600", className)}
                {...props}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-label="Stop">
					<title>Stop</title>
					<rect x="6" y="6" width="12" height="12" />
				</svg>
            </Button>
        );
	}

	const isDisabled =
		typeof context.value !== "string" || context.value.trim().length === 0;

	return (
        <Button
            className={cn("shrink-0 rounded-full p-1.5 h-fit border dark:border-zinc-600", className)}
            disabled={isDisabled}
            onClick={(event) => {
				event.preventDefault();
				if (!isDisabled) {
					onSubmit?.();
				}
			}}
            {...props}>
            <ArrowUpIcon />
        </Button>
    );
}

ChatInputSubmit.displayName = "ChatInputSubmit";

export { ChatInput, ChatInputTextArea, ChatInputSubmit };
