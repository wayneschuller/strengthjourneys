import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Coffee,
  ExternalLink,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  Upload,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/sheet/google-sheets-icon";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { openSheetSetupDialog } from "@/lib/sheet/open-sheet-setup";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

/**
 * User avatar button in the nav bar. Shows a Google sign-in button when unauthenticated,
 * or a dropdown menu with sheet management, feedback, and sign-out options when authenticated.
 *
 * @param {Object} props - No props; all data is sourced from session and lifting data context.
 */
export function AvatarDropdown() {
  const { data: session, status: authStatus } = useSession();
  const { sheetInfo } = useUserLiftingData();

  if (authStatus !== "authenticated")
    return (
      <GoogleSignInButton
        variant="outline"
        cta="nav_avatar"
        aria-label="Sign in with Google"
      >
        <span className="hidden lg:inline">Sign in with Google</span>
      </GoogleSignInButton>
    );

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild aria-label="User menu">
              <button
                type="button"
                className="focus-visible:ring-ring relative ml-2 inline-flex rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <Avatar className="ring-muted-foreground h-8 w-8 hover:ring-2">
                  {session.user.image && (
                    <AvatarImage src={session.user.image} />
                  )}
                  <AvatarFallback>
                    {session.user.name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open user menu</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent className="w-60" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex min-w-0 flex-col gap-1">
            {session.user.name && (
              <p className="truncate text-sm font-semibold">
                {session.user.name}
              </p>
            )}
            <p className="text-muted-foreground truncate text-xs">
              {session.user.email}
            </p>
            {sheetInfo?.filename && (
              <p className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs">
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden
                />
                <span className="truncate">{sheetInfo.filename}</span>
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {sheetInfo?.url && (
            <DropdownMenuItem asChild>
              <a href={sheetInfo.url} target="_blank" rel="noreferrer">
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="mr-2 h-4 w-4 shrink-0"
                  aria-hidden
                />
                Open Google Sheet
                <ExternalLink
                  className="text-muted-foreground ml-auto size-3!"
                  aria-hidden
                />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              openSheetSetupDialog(
                sheetInfo?.ssid ? "switch_sheet" : "bootstrap",
              );
            }}
          >
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="mr-2 h-4 w-4 shrink-0"
              aria-hidden
            />
            {sheetInfo?.ssid ? "Select New Data Source" : "Set Up Google Sheet"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="mr-2 h-4 w-4" />
              Import / Export
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/changelog" prefetch={false}>
              <Megaphone className="mr-2 h-4 w-4" />
              What&apos;s New
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => window.dispatchEvent(new Event("open-feedback"))}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Send Feedback
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a
              href="https://buymeacoffee.com/lrhvbjxzqr"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Coffee className="mr-2 h-4 w-4" />
              Buy Me A Coffee
              <ExternalLink
                className="text-muted-foreground ml-auto size-3!"
                aria-hidden
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
