
## What changes

When a user clicks **Remind Me**, instead of silently creating a reminder, a dialog opens with:

1. A **date + time picker** for when the reminder should be delivered (defaults to release date at 9:00 AM, cannot be in the past).
2. Two checkboxes: **Email** and **WhatsApp** (at least one required).
3. If Email is checked and the profile has no email, prompt for it. If WhatsApp is checked and the profile has no mobile number, prompt for it (with country code, validated).
4. **Save reminder** writes the reminder and (if needed) updates the profile.

Delivery happens at the exact `remind_at` minute via a cron that runs every 5 minutes.

## Technical plan

### 1. Database migration

Modify `reminders` table:
- Change `release_date` semantics — add new column `remind_at timestamptz not null` (the user-chosen delivery moment). Keep `release_date date` for display.
- Add `notify_email boolean not null default true`.
- Add `notify_whatsapp boolean not null default false`.
- Add `notified_at timestamptz` (replaces `last_notified_on` semantically; keep old column for backfill, set NULL going forward).
- Index on `(remind_at) where notified_at is null` for fast cron scans.

No changes to RLS — existing user_id policies cover the new columns.

### 2. Frontend — new `ReminderDialog` component

Replaces the immediate-toggle flow inside `src/components/RemindMeButton.tsx`.

Built from shadcn primitives already in the project:
- `Dialog`, `Calendar` (with `pointer-events-auto`), `Popover`, `Input` (type=time), `Checkbox`, `Label`, `Button`.
- Validation with `zod`: `remind_at` in the future; at least one channel; email valid if entered; mobile_number = `+` followed by 8–15 digits if entered.
- On open, fetches the current profile (`email`, `mobile_number`) once. Conditionally renders missing-field inputs only when their channel is checked AND the profile value is empty.
- On submit:
  1. If new contact fields were entered, `update` the `profiles` row.
  2. `insert` into `reminders` with `remind_at`, `notify_email`, `notify_whatsapp`.
  3. Invalidate the existing `["reminder", contentId]` query so the button flips to "Remove reminder".

The "Remove reminder" path stays as-is.

`RemindMeButtonFixed.tsx` and `RemindMeButtonSimple.tsx` are legacy duplicates — point them at the new dialog or delete; will confirm during implementation.

### 3. Edge function — `send-due-reminders` rewrite

Switch from daily date-equality to minute-precision sweep:
- Select reminders where `notified_at is null and remind_at <= now()`.
- For each reminder, run the channels its user opted into:
  - **Email** → existing raw TCP/TLS SMTP path (unchanged).
  - **WhatsApp** → POST to WhatsApp Cloud API (Meta) using `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` env vars. Use a pre-approved template message (e.g. `bingeguide_reminder` with the title as a body parameter); if template not yet approved, fall back to a session text message and log a warning.
- Only set `notified_at = now()` when **all selected channels** for that reminder succeed. Partial failures stay un-notified so the next cron tick retries (with a max-retries guard via a new `retry_count` column to avoid loops).
- Preserve the `X-Function-Key` auth, force mode, and `reminderId` overrides.

### 4. Cron cadence

Update the existing `pg_cron` schedule for `send-due-reminders` from daily to every 5 minutes (chosen as a balance between "exact" and SMTP rate limits). Done via the Supabase insert tool with the project URL + anon key, not a migration.

### 5. Secrets required

- `WHATSAPP_TOKEN` — Meta long-lived access token.
- `WHATSAPP_PHONE_NUMBER_ID` — phone number ID from WhatsApp Business account.

Will be requested via the secrets tool right before the edge-function rewrite.

### 6. Code conventions

- All comments in plain language for non-technical readers (per project knowledge).
- Use `src/lib/logger.ts` — no raw `console.log` in frontend.
- All zod errors surfaced as `toast.error`.
- No secret printed or returned to client.

## Out of scope

- Editing an existing reminder's time/channels (delete + re-create still works).
- Recurring reminders.
- SMS fallback.
