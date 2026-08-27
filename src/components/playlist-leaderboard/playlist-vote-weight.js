import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

/**
 * Shows the visitor what their vote is actually worth, and gives them a way to increase it.
 *
 * The weighting has existed in getVoteWeight() since launch but was never surfaced, and the
 * page promised "extra vote weighting" without offering a sign-in button anywhere.
 *
 * @param {string} authStatus - next-auth session status.
 */
export function VoteWeightBanner({ authStatus }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (authStatus === "loading") return;

    let isCurrent = true;
    fetch("/api/vote-weight")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => isCurrent && setInfo(data))
      .catch(() => {});

    return () => {
      isCurrent = false;
    };
  }, [authStatus]);

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
            {isSignedIn
              ? `Your votes count ${weight}×`
              : "Your votes count 1×"}
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
