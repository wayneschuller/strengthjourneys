const IMPORT_PAGE_BASE_URL = "https://www.strengthjourneys.xyz/import";

export const IMPORT_APP_PAGES = [
  {
    slug: "hevy",
    appName: "Hevy",
    seoTitle: "Import Hevy Data to Google Sheets | Strength Journeys",
    metaDescription:
      "Export your Hevy workout history, upload the CSV, and turn it into a Google Sheet you own. Merge Hevy with Strong, Wodify, BTWB, or past Strength Journeys exports.",
    keywords:
      "Hevy export, import Hevy to Google Sheets, Hevy CSV import, merge Hevy and Strong, Hevy workout export",
    heroTitle: "Import Hevy Data Into Google Sheets",
    heroDescription:
      "Export your Hevy workout history, upload the file to Strength Journeys, and we turn it into a living Google Sheet you control. If you have data in other apps too, import those files as well and keep the whole training story in one place.",
    intro:
      "If you are searching for how to export data from Hevy, the practical answer is to get it out of the app and into a format you actually own. Strength Journeys gives you a cleaner endpoint than another locked dashboard: your workout history ends up in your own Google Sheet, ready to explore, edit, back up, and merge with other sources later.",
    exportSteps: [
      "In Hevy, open Profile, then Settings, then Export & Import Data.",
      "Choose Export Data and export your workouts file.",
      "Open Strength Journeys and upload the Hevy CSV on the import page.",
      "Preview the import in-browser, or sign in and write the data into your own Google Sheet.",
    ],
    comparisonTitle:
      "Why Strength Journeys is a better long-term home for Hevy data",
    comparisonBullets: [
      "Your imported data can live in your own Google Sheet instead of staying trapped inside one app account.",
      "You can merge Hevy with Strong, Wodify, BTWB, TurnKey, and old Strength Journeys exports in one place.",
      "You can preview imports in the browser before writing anything permanent.",
      "Once the data is in Sheets, it is easier to audit, export, share with a coach, or keep forever.",
    ],
    mergeTitle: "How to merge Hevy with Strong, Wodify, BTWB, or another app",
    mergeBody:
      "Import each export file into Strength Journeys one by one. We normalize lift names, skip duplicates where possible, and write the result into a single Google Sheet backend. That makes Strength Journeys a practical migration layer if your lifting history is scattered across multiple apps over the years.",
    faqItems: [
      {
        question: "How do I export data from Hevy?",
        answer:
          "In Hevy, go to Profile, Settings, Export & Import Data, then export your workout data. After that, upload the file to Strength Journeys to view it in preview mode or write it into your own Google Sheet.",
      },
      {
        question: "How do I import Hevy to Google Sheets?",
        answer:
          "The easiest route is to upload the Hevy export into Strength Journeys. If you are signed in, Strength Journeys creates or updates a Google Sheet for you so your history is stored in a spreadsheet you own.",
      },
      {
        question: "How do I merge Hevy with Strong or Wodify?",
        answer:
          "Upload each app export into Strength Journeys. The importer is built to combine supported app files into one normalized lifting history backed by Google Sheets.",
      },
      {
        question:
          "Why use Strength Journeys instead of keeping everything only in Hevy?",
        answer:
          "Hevy is useful for logging, but Strength Journeys is better for long-term ownership, cross-app migration, and storing your history in Google Sheets instead of one closed platform.",
      },
    ],
  },
  {
    slug: "strong",
    appName: "Strong",
    seoTitle: "Import Strong CSV to Google Sheets | Strength Journeys",
    metaDescription:
      "Export your Strong workout data, upload the CSV, and move your lifting history into a Google Sheet you own. Merge Strong with Hevy, Wodify, BTWB, and more.",
    keywords:
      "Strong CSV export, import Strong to Google Sheets, Strong workout export, merge Strong and Hevy, Strong CSV importer",
    heroTitle: "Import Strong Workout Data Into Google Sheets",
    heroDescription:
      "Take your Strong export out of app-only storage and turn it into a Google Sheet you actually control. Strength Journeys also gives you a clean place to merge Strong with Hevy, Wodify, BTWB, and older spreadsheet history.",
    intro:
      "Many lifters search for a Strong CSV import or a way to move Strong data to Google Sheets. That is the gap this page solves. Instead of leaving your history in one export file or one mobile app, you can route it through Strength Journeys and end up with a living sheet you can edit, keep, and build on.",
    exportSteps: [
      "In Strong, open Settings and use Export Strong Data or Export Data.",
      "Download the CSV file to your device.",
      "Upload the file on the Strength Journeys import page.",
      "Use preview mode to inspect it, or sign in and write the import into your Google Sheet.",
    ],
    comparisonTitle:
      "Why Strength Journeys is a better destination for Strong exports",
    comparisonBullets: [
      "Your data does not stop at a one-off CSV download. It becomes a Google Sheet backend you can keep using.",
      "You can combine Strong with Hevy, Wodify, BTWB, TurnKey, and Strength Journeys files in one history.",
      "The importer handles common Strong export variants like semicolon-delimited files and weight-unit headers.",
      "You keep a portable source of truth instead of depending on one app forever.",
    ],
    mergeTitle: "How to merge Strong with Hevy, Wodify, or BTWB",
    mergeBody:
      "Upload each export into Strength Journeys. The app can act like a translation layer between training platforms, with Google Sheets as the final destination. That is usually easier than trying to convert Strong files manually or forcing one app to import another app's exact format.",
    faqItems: [
      {
        question: "How do I export data from Strong?",
        answer:
          "Open Strong, go to Settings, and use the export option to download your workout data as CSV. Then upload that file into Strength Journeys.",
      },
      {
        question: "How do I import Strong CSV into Google Sheets?",
        answer:
          "Upload the Strong export to Strength Journeys. If you are signed in, Strength Journeys writes the parsed lifting history into your own Google Sheet.",
      },
      {
        question: "How do I merge Strong with Hevy?",
        answer:
          "Import the Strong file and the Hevy file into Strength Journeys. The result can live in one Google Sheet so you are no longer splitting history across two apps.",
      },
      {
        question:
          "Why is Strength Journeys better than just keeping a Strong CSV in Drive?",
        answer:
          "A raw CSV is only a dump. Strength Journeys turns that export into a normalized, app-usable Google Sheet and gives you analysis, deduping, and a cleaner place to keep adding future imports.",
      },
    ],
  },
  {
    slug: "wodify",
    appName: "Wodify",
    seoTitle: "Import Wodify Data to Google Sheets | Strength Journeys",
    metaDescription:
      "Move Wodify lifting history into a Google Sheet you own. Upload Wodify CSV, XLS, or XLSX exports to Strength Journeys and merge them with data from other apps.",
    keywords:
      "Wodify export, import Wodify to Google Sheets, Wodify CSV import, Wodify XLS import, merge Wodify and BTWB",
    heroTitle: "Import Wodify Data Into Google Sheets",
    heroDescription:
      "If your Wodify account or gym gives you a spreadsheet export, Strength Journeys can turn that file into a Google Sheet backend you own. It is also one of the easiest ways to merge Wodify lifting history with other apps you used before or after it.",
    intro:
      "Wodify exports often end up stuck in old CSV or spreadsheet files. Strength Journeys gives those exports a better home. Instead of treating Wodify as a dead archive, you can import the file, normalize the lifting data, and keep the result in Google Sheets for long-term access.",
    exportSteps: [
      "Export your Wodify performance or workout history as CSV, XLS, or XLSX if your account provides that option.",
      "Save the file locally.",
      "Upload it to Strength Journeys on the import page.",
      "Preview the results, then create or merge into your Google Sheet if you want a permanent backend.",
    ],
    comparisonTitle:
      "Why Strength Journeys is a better home for Wodify exports",
    comparisonBullets: [
      "Your history ends up in a spreadsheet you control instead of staying tied to one gym platform.",
      "You can merge Wodify with Hevy, Strong, BTWB, TurnKey, and Strength Journeys exports.",
      "CSV, XLS, and XLSX support means older Wodify spreadsheet files are easier to rescue.",
      "A Google Sheet is easier to audit, edit, and preserve when your gym software changes later.",
    ],
    mergeTitle: "How to merge Wodify with BTWB, Strong, or Hevy",
    mergeBody:
      "Upload each export into Strength Journeys rather than trying to make one app swallow another app's schema. That gives you a single normalized history in Google Sheets, even if your training moved between a gym platform, a CrossFit tracker, and a solo logging app over time.",
    faqItems: [
      {
        question: "How do I export data from Wodify?",
        answer:
          "Export your Wodify workout or performance history from the reporting or history view available in your account, then upload the spreadsheet file into Strength Journeys. Supported file types include CSV, XLS, and XLSX.",
      },
      {
        question: "How do I import Wodify into Google Sheets?",
        answer:
          "Upload the Wodify export to Strength Journeys. If you sign in, Strength Journeys will create a new Google Sheet or merge the imported lifting history into your existing one.",
      },
      {
        question: "How do I merge Wodify with BTWB or Strong?",
        answer:
          "Import each file into Strength Journeys. The goal is not to force the apps to talk to each other directly. The goal is to move them all into one owned Google Sheet backend.",
      },
      {
        question:
          "Why use Strength Journeys instead of leaving Wodify data in export files?",
        answer:
          "Because export files are archives, not a real home for your training history. Strength Journeys converts them into a sheet you can keep working with and combine with newer app data.",
      },
    ],
  },
  {
    slug: "btwb",
    appName: "BTWB",
    seoTitle: "Import BTWB Data to Google Sheets | Strength Journeys",
    metaDescription:
      "Import BTWB workout exports into a Google Sheet you own. Strength Journeys parses BTWB spreadsheet files and helps you merge them with Hevy, Strong, Wodify, and more.",
    keywords:
      "BTWB export, import BTWB to Google Sheets, Beyond the Whiteboard export, merge BTWB and Wodify, BTWB CSV importer",
    heroTitle: "Import BTWB Data Into Google Sheets",
    heroDescription:
      "Beyond the Whiteboard has years of history for a lot of lifters, but that history is more useful when it lives somewhere you control. Strength Journeys lets you upload BTWB exports, normalize the lifting entries, and write the result into your own Google Sheet.",
    intro:
      "If you are looking for how to export data from BTWB or how to move BTWB workouts into Google Sheets, the simplest route is to use Strength Journeys as the bridge. You upload the export file, we parse the strength data in the browser, and your long-term copy can live in a spreadsheet instead of staying locked inside a single platform.",
    exportSteps: [
      "Export your BTWB history as a CSV or spreadsheet file from Beyond the Whiteboard.",
      "Save the file locally.",
      "Upload it on the Strength Journeys import page.",
      "Preview the parsed lifts, then write them into a Google Sheet if you want a permanent backend.",
    ],
    comparisonTitle:
      "Why Strength Journeys is better for long-term BTWB data ownership",
    comparisonBullets: [
      "You can move years of BTWB history into a Google Sheet you own and can edit anytime.",
      "You can merge BTWB with Wodify, Hevy, Strong, TurnKey, and Strength Journeys exports.",
      "The importer is tuned for real BTWB export quirks like multiline descriptions and weighted set parsing.",
      "Google Sheets is a better archive than hoping one vendor always keeps the same export rules.",
    ],
    mergeTitle: "How to merge BTWB with Wodify, Strong, or Hevy",
    mergeBody:
      "Import each export into Strength Journeys and let Google Sheets become the shared source of truth. That is the easiest way to unify a history that started in BTWB and later moved into another workout tracker.",
    faqItems: [
      {
        question: "How do I export data from BTWB?",
        answer:
          "Export your workout history from BTWB as a CSV or spreadsheet file, then upload that file into Strength Journeys to preview or store the parsed lifting data in Google Sheets.",
      },
      {
        question: "How do I import BTWB into Google Sheets?",
        answer:
          "Upload the BTWB export to Strength Journeys. If you are signed in, Strength Journeys will create or update a Google Sheet with the parsed entries.",
      },
      {
        question: "How do I merge BTWB with Wodify or Strong?",
        answer:
          "Use Strength Journeys as the middle layer. Import each app export, then keep the combined training history in a single Google Sheet backend.",
      },
      {
        question:
          "Why use Strength Journeys instead of leaving BTWB as the only source of truth?",
        answer:
          "Strength Journeys is better for ownership, portability, and cross-app migration. Your data ends up in Google Sheets, which is easier to keep, inspect, and combine with future imports.",
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
