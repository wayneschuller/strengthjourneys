# Copilot Instructions for Strength Journeys

## Project Overview
- **Strength Journeys** is a Next.js web app for visualizing barbell/gym lift progress using Google Sheets as the data source.
- Users connect their own Google Sheet (see `/src/components/instructions-cards.js` for onboarding logic and sample sheet link).
- The app is open source and deployed on Vercel; main branch is production.

## Architecture & Data Flow
- **Frontend:** Next.js (pages router), Tailwind CSS, shadcn/ui, Recharts.
- **Auth:** NextAuth.js (Google login).
- **Data:** User lifting data is read-only from Google Sheets via OAuth and the Google Picker API (`react-google-drive-picker`).
- **AI Features:** `/src/pages/ai-lifting-assistant.js` implements a chat assistant using proprietary prompts (stored in Vercel env `EXTENDED_AI_PROMPT`).
- **Analyzer/Visualizer:** `/src/pages/analyzer.js`, `/src/pages/visualizer.js` provide dashboards and insights.
- **Key UI Patterns:** Cards, grid layouts, onboarding flows, and privacy-first design (see `/public/privacy-policy.html`).

## Developer Workflows
- **Local Dev:**
  - `npm install` to set up dependencies.
  - `npm run dev` to start Next.js locally.
- **Deployment:**
  - Vercel auto-deploys from `main` branch.
  - Use `deploy_extended_AI_prompt.sh` to update AI prompt env variable across Vercel environments.
- **Google Sheet Integration:**
  - Use the sample sheet linked in onboarding cards for test data.
  - Sheet columns: `date`, `lift type`, `reps`, `weight` (kg/lb).

## Project-Specific Conventions
- **Privacy:** No user data is stored server-side; all analysis is client-side except for AI chat API.
- **Session Storage:** Chat history for AI assistant is stored in browser sessionStorage, capped at 20 messages.
- **Component Structure:** Major features are split into `/src/components/` and `/src/pages/` (e.g., `analyzer`, `ai-assistant`, `magicui`).
- **Icons/Images:** SVGs for lifts in `/public/`, mapped in insight pages.
- **Logging:** Use `devLog` utility for debug output.

## Integration Points
- **Google Picker:** See `/src/lib/handle-open-picker.js` and onboarding cards for usage.
- **AI Chat:** `/src/app/api/chat/route.js` for server-side prompt, `/src/pages/ai-lifting-assistant.js` for client logic.
- **Sample Sheet:** [Google Sheets sample](https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0)

## Examples
- **Onboarding:** `/src/components/instructions-cards.js` (ChooseSheetInstructionsCard, GettingStartedCard)
- **AI Assistant:** `/src/pages/ai-lifting-assistant.js` (AILiftingAssistantCard, bio details, chat logic)
- **Analyzer:** `/src/pages/analyzer.js` (dashboard, PR tracking)

---

_If any section is unclear or missing, please provide feedback for further refinement._
