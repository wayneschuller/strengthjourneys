# AI coach prompt editions

The AI lifting assistant's system prompt is proprietary, so its text is never
committed. It lives in KV as dated, append-only **editions**, with a backup on
Wayne's laptop. The repo only holds the code that reads them.

## How it fits together

- `src/lib/ai/prompt-editions.js` owns the KV keys and the rules.
- `src/pages/api/chat.js` reads the active edition (cached 60 seconds per warm
  instance) and tags every reply with `{ edition, model }` message metadata.
  If no edition is active it falls back to `EXTENDED_AI_PROMPT`, then to the
  open-source `SYSTEM_PROMPT`; those replies carry `edition: null`.
- `src/components/feedback/ai-reply-feedback.js` shows thumbs and a quiet
  "Sep 26 edition" label on the latest reply. After a vote the lifter can
  choose to share the chat, which is emailed to Wayne.
- `src/pages/api/chat/feedback.js` counts votes in KV (numbers only) and emails
  shared chats (never stored).

The model is deliberately **not** part of an edition. It is picked per request
and may one day depend on the user's tier, so votes are counted per edition
and model pair.

## KV keys

| Key | Holds |
| --- | --- |
| `sj:ai:prompt:edition:<id>` | `{ text, note, createdAt }`, written once, never changed |
| `sj:ai:prompt:active` | the live edition ID; switching and rollback change only this |
| `sj:ai:prompt:votes:<id>` | hash of `<model>:up` / `<model>:down` counts |

Edition IDs are the local date of creation, with `b`, `c`… for later editions
that day: `2026-09-26`, `2026-09-26b`. The UI shows them as "Sep 26" / "Sep 26b".

The local `.env` points at **production** KV, so the dev server serves the live
edition. Votes from the dev server are not counted.

## Changing the prompt

Write the new text to a file (outside the repo, e.g. in
`~/hacking/strengthjourneys-private/prompts/`), then:

```
node scripts/ai-prompt-editions.mjs create <file> "<what changed and why>"
node scripts/ai-prompt-editions.mjs activate <id>
```

`create --activate` does both. Activation reaches production within a minute,
with no redeploy. **Rollback** is `activate` with the previous ID. Never write
edition keys by hand, and never delete one: the history is the point.

Activating changes what every lifter gets, so only do it when Wayne asks.

## Reviewing history, diffs and votes

Every create and activate, plus a daily systemd user timer
(`~/.config/systemd/user/sj-prompt-backup.timer`), mirrors KV to
`~/hacking/strengthjourneys-private/prompts/editions/`:

- `<id>.txt`: each edition's text
- `editions.json`: notes, dates, the active ID and vote counts per model

Run `node scripts/ai-prompt-editions.mjs backup` for fresh numbers, then read
the folder: `diff editions/2026-07-10.txt editions/2026-07-10b.txt` compares two
editions. Timer logs: `journalctl --user -u sj-prompt-backup`.
