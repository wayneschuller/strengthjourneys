/*
 * Home dashboard loading panel for phones and small tablets, shown while a returning lifter's
 * sheet is still on its way. Stacked into one column, the card skeletons filled the whole
 * screen with grey and read as something broken, so this says what is happening instead.
 *
 * Text only on purpose. The read usually lands in about a second, too quickly for an animated
 * lift drawing to be enjoyed (we tried one), so the panel just names the job and the sheet.
 */
import { motion } from "motion/react";
import { FileUp } from "lucide-react";

import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";

/**
 * Centred loading state for the dashboard below lg: what we are reading, and which sheet it
 * is. The row count is unknown until the read returns, so it stays in the header, where the
 * odometer rolls it as the cards arrive.
 *
 * @param {Object} props
 * @param {"sheet"|"preview"} [props.mode] - Source being loaded.
 * @param {string|null} [props.sheetFilename] - Linked sheet name, known before the read returns.
 * @param {string} [props.className] - Extra classes, e.g. to hide it at larger breakpoints.
 */
export function DashboardLoadingPanel({ mode = "sheet", sheetFilename, className = "" }) {
  const isPreviewMode = mode === "preview";
  const label = isPreviewMode ? "Preparing your imported preview" : "Reading your workout data";
  const sourceName = isPreviewMode ? null : (sheetFilename || "Your Google Sheet").trim();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className={`flex min-h-[50vh] flex-col items-center justify-center gap-1.5 text-center ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <p className="text-lg font-semibold">{label}</p>
      {isPreviewMode ? (
        <FileUp className="text-muted-foreground h-4 w-4" aria-hidden />
      ) : (
        <p className="text-muted-foreground flex max-w-full items-center gap-1.5 text-sm">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-4 w-4 shrink-0"
            aria-hidden
          />
          <span className="truncate">{sourceName}</span>
        </p>
      )}
    </motion.div>
  );
}
