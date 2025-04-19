import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cva } from "class-variance-authority";
import { SparklesIcon, UserIcon } from "lucide-react";
import React from "react";

const chatMessageVariants = cva("flex gap-4 w-full", {
	variants: {
		variant: {
			default: "",
			bubble: "",
			full: "p-5",
		},
		type: {
			incoming: "justify-start mr-auto",
			outgoing: "justify-end ml-auto",
		},
	},
	compoundVariants: [
		{
			variant: "full",
			type: "outgoing",
			className: "bg-muted",
		},
		{
			variant: "full",
			type: "incoming",
			className: "bg-background",
		},
	],
	defaultVariants: {
		variant: "default",
		type: "incoming",
	},
});

const ChatMessageContext = React.createContext(null);

const useChatMessage = () => {
	const context = React.useContext(ChatMessageContext);
	return context;
};

const ChatMessage = React.forwardRef((
    {
        className,
        variant = "default",
        type = "incoming",
        id,
        children,
        ...props
    },
    ref,
) => {
    return (
        <ChatMessageContext.Provider value={{ variant, type, id }}>
            <div
                ref={ref}
                className={cn(chatMessageVariants({ variant, type, className }))}
                {...props}>
                {children}
            </div>
        </ChatMessageContext.Provider>
    );
});
ChatMessage.displayName = "ChatMessage";

// Avatar component

const chatMessageAvatarVariants = cva(
    "w-8 h-8 flex items-center rounded-full justify-center ring-1 shrink-0 bg-transparent overflow-hidden",
    {
		variants: {
			type: {
				incoming: "ring-border",
				outgoing: "ring-muted-foreground/30",
			},
		},
		defaultVariants: {
			type: "incoming",
		},
	}
);

const ChatMessageAvatar = React.forwardRef(({ className, icon: iconProps, imageSrc, ...props }, ref) => {
	const context = useChatMessage();
	const type = context?.type ?? "incoming";
	const icon =
		iconProps ?? (type === "incoming" ? <SparklesIcon /> : <UserIcon />);
	return (
        <div
            ref={ref}
            className={cn(chatMessageAvatarVariants({ type, className }))}
            {...props}>
            {imageSrc ? (
				<img src={imageSrc} alt="Avatar" className="h-full w-full object-cover" />
			) : (
				<div className="translate-y-px [&_svg]:size-4 [&_svg]:shrink-0">
					{icon}
				</div>
			)}
        </div>
    );
});
ChatMessageAvatar.displayName = "ChatMessageAvatar";

// Content component

const chatMessageContentVariants = cva("flex flex-col gap-2", {
	variants: {
		variant: {
			default: "",
			bubble: "rounded-xl px-3 py-2",
			full: "",
		},
		type: {
			incoming: "",
			outgoing: "",
		},
	},
	compoundVariants: [
		{
			variant: "bubble",
			type: "incoming",
			className: "bg-secondary text-secondary-foreground",
		},
		{
			variant: "bubble",
			type: "outgoing",
			className: "bg-primary text-primary-foreground",
		},
	],
	defaultVariants: {
		variant: "default",
		type: "incoming",
	},
});

const ChatMessageContent = React.forwardRef(({ className, content, id: idProp, children, ...props }, ref) => {
	const context = useChatMessage();

	const variant = context?.variant ?? "default";
	const type = context?.type ?? "incoming";
	const id = idProp ?? context?.id ?? "";

	return (
        <div
            ref={ref}
            className={cn(chatMessageContentVariants({ variant, type, className }))}
            {...props}>
            {content.length > 0 && <MarkdownContent id={id} content={content} />}
            {children}
        </div>
    );
});
ChatMessageContent.displayName = "ChatMessageContent";

export { ChatMessage, ChatMessageAvatar, ChatMessageContent };
