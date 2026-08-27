import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

/**
 * Shows the visitor what their vote is actually worth, and what would make it worth more.
 *
 * Weight rides the same ladder as the unlockable themes, so the tier shown here is the theme
 * the lifter has earned. One body of logged training, two rewards.
 *
 * @param {string} authStatus - next-auth session status.
 * @param {string} [ssid] - Linked spreadsheet id, so the server can verify training volume.
 */
export function VoteWeightBanner({ authStatus, ssid }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (authStatus === "loading") return;

    let isCurrent = true;
    fetch(`/api/vote-weight${ssid ? `?ssid=${encodeURIComponent(ssid)}` : ""}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => isCurrent && setInfo(data))
      .catch(() => {});

    return () => {
      isCurrent = false;
    };
  }, [authStatus, ssid]);

  const handleSignIn = () => {
    gaTrackSignInClick("gym-playlist-leaderboard", "vote-weight-banner");
    signIn("google");
  };

  const weight = info?.weight ?? 1;
  const isSignedIn = info?.signedIn;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5 text-sm">
        <span className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 font-bold tabular-nums text-primary">
          <Zap className="h-3.5 w-3.5 fill-current" />
          {weight}&times;
        </span>
        <div className="min-w-0">
          <p className="font-medium">
            Your votes count {weight}&times;
            {isSignedIn && info?.label && info.unlockedCount > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}
                &middot; {info.label}
              </span>
            )}
          </p>
          {info?.blurb && (
            <p className="text-xs text-muted-foreground">{info.blurb}</p>
          )}
        </div>
      </div>

      {info && !isSignedIn && (
        <Button size="sm" onClick={handleSignIn} className="shrink-0">
          Sign in to vote heavier
        </Button>
      )}
    </div>
  );
}
