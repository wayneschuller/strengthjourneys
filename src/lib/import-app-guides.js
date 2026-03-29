const IMPORT_PAGE_BASE_URL = "https://www.strengthjourneys.xyz/import";
const IMPORT_PRIVACY_ANSWER =
  "Your file is parsed in your browser first. If you choose to save it, Strength Journeys sends the parsed data to write into a Google Sheet in your own Google Drive. We do not keep a server-side copy of your workout history.";

export const IMPORT_APP_PAGES = [
  {
    slug: "hevy",
    appName: "Hevy",
    title: "Import Hevy Data to Google Sheets | Strength Journeys",
    metaDescription:
      "Export your Hevy workout history and see your strength progression instantly. PRs, trends, and progression charts — all from one CSV upload.",
    heroTitle: "Bring Your Hevy History to Life",
    hookLine: "The PRs hiding in your Hevy data",
    heroDescription:
      "Drop your Hevy export and see every PR and trend instantly.",
    cardDescription:
      "Switching apps? See the analytics Hevy never showed you.",
    whyItMatters:
      "Hevy is great for logging, but your training history deserves more than a locked database. Once your data is here, you can visualize years of progress, spot trends Hevy doesn't show you, and keep a permanent copy in your own Google Sheet that no app can take away.",
    exportSteps: [
      "In Hevy, open Profile → Settings → Export & Import Data.",
      "Tap Export Data and save the CSV file.",
      "Drop the file on the Strength Journeys import page.",
      "Instantly see your strength dashboard — or sign in to save it to your own Google Sheet.",
    ],
    whatYouGet: [
      "Progression charts, volume trends, and analytics that go deeper than Hevy's built-in stats.",
      "Automatic PR detection across every lift and rep range — including ones you forgot about.",
      "Merge with Strong, Wodify, BTWB, or any other app into one unified timeline.",
      "A Google Sheet you control: edit, share with a coach, or back up whenever you want.",
    ],
    mergeTitle: "Already used other apps too?",
    mergeBody:
      "Most lifters have history scattered across two or three apps. Just import each file — we normalize the data, skip duplicates, and merge everything into one timeline. Your years of training finally live in one place.",
    faqItems: [
      {
        question: "How do I export my data from Hevy?",
        answer:
          "Open Hevy → Profile → Settings → Export & Import Data → Export Data. Save the CSV file, then upload it here.",
      },
      {
        question: "Do I need an account to see my data?",
        answer:
          "No. You can preview your full dashboard without signing in. If you want to save your data permanently to a Google Sheet, you'll need to sign in with Google.",
      },
      {
        question: "Can I combine Hevy data with other apps?",
        answer:
          "Yes — import files from Strong, Wodify, BTWB, or any supported format. We'll merge them into one unified training history.",
      },
      {
        question: "What happens to my data?",
        answer: IMPORT_PRIVACY_ANSWER,
      },
    ],
  },
  {
    slug: "strong",
    appName: "Strong",
    title: "Import Strong CSV to Google Sheets | Strength Journeys",
    metaDescription:
      "Export your Strong workout data and see years of strength progression instantly. Upload your CSV and get PRs, trends, and charts — no account required.",
    heroTitle: "See Your Strong Data in a New Light",
    hookLine: "Years of gains you've never actually seen",
    heroDescription:
      "Drop your Strong CSV and watch years of progress come alive instantly.",
    cardDescription:
      "Got years of Strong data? Finally see your full progression arc.",
    whyItMatters:
      "Strong is a solid tracker, but your training data shouldn't be stuck in one app forever. Import it here to see progression charts, PR history across rep ranges, and training trends that a simple CSV can't show you. Your Google Sheet becomes the permanent home for everything.",
    exportSteps: [
      "In Strong, open Settings → Export Strong Data (or Export Data).",
      "Download the CSV file to your device.",
      "Drop the file on the Strength Journeys import page.",
      "See your full dashboard instantly — or sign in to save it to your own Google Sheet.",
    ],
    whatYouGet: [
      "See how your squat, bench, and deadlift have tracked over months and years — not just recent sessions.",
      "Every PR across every rep range, detected automatically from your full Strong history.",
      "We handle Strong's CSV quirks like semicolon delimiters and weight-unit headers.",
      "A portable Google Sheet that you own, not a file sitting forgotten in your Downloads folder.",
    ],
    mergeTitle: "Switching from another app?",
    mergeBody:
      "If your training history spans Strong and another tracker, import both files. We'll normalize lift names, handle duplicates, and give you one continuous timeline in Google Sheets. No manual cleanup needed.",
    faqItems: [
      {
        question: "How do I export my data from Strong?",
        answer:
          "Open Strong → Settings → Export Strong Data. Save the CSV, then upload it here.",
      },
      {
        question: "Do I need an account?",
        answer:
          "No. Preview mode shows your full dashboard without signing in. Sign in only when you want to save to your own Google Sheet.",
      },
      {
        question: "Can I merge Strong with Hevy?",
        answer:
          "Yes. Import both files and we'll combine them into one history. Duplicates are automatically skipped.",
      },
      {
        question: "Is my data secure?",
        answer: IMPORT_PRIVACY_ANSWER,
      },
    ],
  },
  {
    slug: "wodify",
    appName: "Wodify",
    title: "Import Wodify Data to Google Sheets | Strength Journeys",
    metaDescription:
      "Rescue your old Wodify workout history. Upload CSV, XLS, or XLSX exports and see your strength progression instantly — even years later.",
    heroTitle: "Rescue Your Wodify Lifting History",
    hookLine: "That old Wodify export isn't dead weight",
    heroDescription:
      "Drop your Wodify export — even years-old files work. Your data isn't lost.",
    cardDescription:
      "Gym switched platforms? Your old Wodify data still has stories to tell.",
    whyItMatters:
      "Wodify exports often end up forgotten in Downloads folders when gyms switch platforms. Instead of letting that history collect dust, bring it here. You'll see your progression over time, discover PRs you forgot about, and have everything in a Google Sheet that's yours regardless of which gym software comes next.",
    exportSteps: [
      "Export your Wodify performance or workout history as CSV, XLS, or XLSX.",
      "Save the file to your device.",
      "Drop it on the Strength Journeys import page.",
      "See your strength dashboard instantly — or sign in to save it to your own Google Sheet.",
    ],
    whatYouGet: [
      "Dust off old Wodify exports and see PRs you forgot you ever hit.",
      "CSV, XLS, and XLSX all supported — even exports from years ago work.",
      "Merge with Hevy, Strong, BTWB, or any other app into one career-spanning timeline.",
      "A Google Sheet you own that travels with you regardless of gym software.",
    ],
    mergeTitle: "History spread across gyms and apps?",
    mergeBody:
      "If your training started on Wodify, moved to BTWB, then landed in Hevy or Strong, just import each file. We'll stitch the timeline together so you can finally see your full training career in one place.",
    faqItems: [
      {
        question: "How do I export my data from Wodify?",
        answer:
          "Look for the export or reporting option in your Wodify account to download your performance history as CSV, XLS, or XLSX. Then upload the file here.",
      },
      {
        question: "My Wodify export is years old — will it still work?",
        answer:
          "Yes. We support multiple Wodify export formats including older CSV and XLS variants. Drop the file and see if it parses — most do.",
      },
      {
        question: "Can I combine Wodify with BTWB data?",
        answer:
          "Absolutely. Import both files and we'll merge them into one timeline. Common for lifters who trained at CrossFit gyms using different platforms over the years.",
      },
      {
        question: "What happens to my data?",
        answer: IMPORT_PRIVACY_ANSWER,
      },
    ],
  },
  {
    slug: "btwb",
    appName: "BTWB",
    title: "Import BTWB Data to Google Sheets | Strength Journeys",
    metaDescription:
      "Import your Beyond the Whiteboard workout history and see your full strength timeline instantly. Merge with Wodify, Hevy, or Strong — one unified view.",
    heroTitle: "Your BTWB History Deserves a Better Home",
    hookLine: "The training career you've never seen in full",
    heroDescription:
      "Drop your BTWB export and finally see your complete strength timeline.",
    cardDescription:
      "Bounced between gyms? Unify years of BTWB history with everything else.",
    whyItMatters:
      "BTWB has tracked your workouts faithfully, but that data is more powerful outside a single platform. Import it here and you'll see your strength progression visualized over time, with PRs automatically detected across every lift and rep range. Your Google Sheet becomes the permanent, portable record.",
    exportSteps: [
      "Export your BTWB workout history as a CSV or spreadsheet file.",
      "Save the file to your device.",
      "Drop it on the Strength Journeys import page.",
      "See your strength dashboard instantly — or sign in to save it to your own Google Sheet.",
    ],
    whatYouGet: [
      "Finally see your full BTWB career as one interactive timeline — not a static spreadsheet.",
      "PRs detected automatically across every lift and rep range, going back as far as your data does.",
      "We handle BTWB-specific quirks like multiline descriptions and weighted set parsing.",
      "Merge with Wodify, Hevy, or Strong to unify your gym-hopping history into one place.",
    ],
    mergeTitle: "Used other trackers too?",
    mergeBody:
      "If your training career spans BTWB, Wodify, and a solo app like Strong or Hevy, import each file. We'll normalize everything into one continuous timeline so you can see your full journey.",
    faqItems: [
      {
        question: "How do I export my data from BTWB?",
        answer:
          "Export your workout history from Beyond the Whiteboard as a CSV or spreadsheet file, then upload it here.",
      },
      {
        question: "Do I need to sign in?",
        answer:
          "No. You can preview your full dashboard without an account. Sign in when you're ready to save everything to your own Google Sheet.",
      },
      {
        question: "Can I combine BTWB with Wodify data?",
        answer:
          "Yes — very common for CrossFit athletes. Import both files and we'll merge them into one unified training history.",
      },
      {
        question: "Is my data private?",
        answer: IMPORT_PRIVACY_ANSWER,
      },
    ],
  },
];

export function getImportAppPageBySlug(slug) {
  return IMPORT_APP_PAGES.find((page) => page.slug === slug);
}

export function getImportAppUrl(slug) {
  return `${IMPORT_PAGE_BASE_URL}/${slug}`;
}
