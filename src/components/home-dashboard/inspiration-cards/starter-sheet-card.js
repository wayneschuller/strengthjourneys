import { ExternalLink, Sheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InspirationCard } from "./inspiration-card";

export function StarterSheetCard({ sheetUrl, animationDelay = 0 }) {
  return (
    <InspirationCard
      accent="primary"
      icon={Sheet}
      description="Starter Sheet"
      title="Replace the sample row"
      footer={
        <span>
          Open Google Sheets, log your real first session, and this dashboard
          becomes yours.
        </span>
      }
      footerMultiline
      action={
        sheetUrl ? (
          <Button asChild variant="ghost" size="icon" className="h-5 w-5">
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open your Google Sheet"
              title="Open your Google Sheet"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null
      }
      animationDelay={animationDelay}
    />
  );
}
