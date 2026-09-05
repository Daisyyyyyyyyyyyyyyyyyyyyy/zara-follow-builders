# Cloud setup for daily email digest

This fork keeps the original `follow-builders` feed and prompt flow, but runs the final digest generation in **GitHub Actions** so you can receive the digest on your phone without keeping your computer on.

## What this fork does

Every day, GitHub Actions will:

1. Fetch the latest prepared content from the upstream `follow-builders` feeds
2. Ask your GLM model to turn that JSON into a final digest
3. Send the digest to your email inbox through Resend

## Repo secrets you need

Add these in **GitHub → Settings → Secrets and variables → Actions → Secrets**:

- `GLM_API_KEY` — your z.ai / GLM API key
- `RESEND_API_KEY` — your Resend API key
- `DIGEST_TO_EMAIL` — the inbox that should receive the daily digest
- `RESEND_FROM_EMAIL` — recommended; either a verified sender like `digest@yourdomain.com` or `AI Builders Digest <onboarding@resend.dev>` for quick testing

## Repo variables you should set

Add these in **GitHub → Settings → Secrets and variables → Actions → Variables**:

- `GLM_BASE_URL` = `https://api.z.ai/api/coding/paas/v4`
- `GLM_MODEL` = `glm-4.7`
- `DIGEST_LANGUAGE` = `zh` (or `en`, `bilingual`)

Optional:

- `FOLLOW_BUILDERS_REMOTE_BASE` — only set this if you want to override the upstream source of the central feeds/prompts. Leave it empty to keep using the original project as the feed source.

## Schedule

The workflow file is:

```text
.github/workflows/daily-email-digest.yml
```

This repo also includes a watchdog workflow:

```text
.github/workflows/daily-email-watchdog.yml
```

It runs after the main digest window and checks whether **Daily Email Digest** has had a
successful run in the last 36 hours. If not, it automatically triggers a fallback
`workflow_dispatch` run so a missed GitHub schedule is less likely to cause multiple days
of missed emails.

Current cron:

```text
0 7 * * *
```

GitHub Actions cron uses **UTC**. For Hong Kong time, `0 7 * * *` means **15:00 HKT every day**.

This timing is intentional: the upstream `follow-builders` feed refresh runs later in the
day (currently `17 6 * * *`, or **14:17 HKT**). Sending the email at **15:00 HKT** gives
GitHub Actions enough buffer to pick up the freshly published feed instead of an older one.

If you want a different send time, edit the cron expression in that workflow file.

## First run

After pushing this fork to your GitHub repo:

1. Open the **Actions** tab
2. Open **Daily Email Digest**
3. Click **Run workflow**
4. Confirm that:
   - the job succeeds
   - the digest artifact exists
   - the email arrives in your inbox

## Recommended email setup

For the smoothest long-term delivery:

- use Resend
- verify a sender domain in Resend
- set `RESEND_FROM_EMAIL` to that verified address

If you only want a quick test first, try:

```text
AI Builders Digest <onboarding@resend.dev>
```

Depending on your Resend account state, test-mode restrictions may apply.

## Troubleshooting

- The **Node.js 20 actions are deprecated** message is a **warning**, not the direct cause of the failed run.
- If the **Daily Email Digest** workflow does not appear to run on schedule, check whether
  **Daily Email Watchdog** triggered a fallback run later that day.
- If the workflow fails specifically at **Send digest email**, the digest was generated successfully and the failure happened when calling the **Resend API**.
- The most common causes are:
  - `RESEND_FROM_EMAIL` is not a sender allowed by your Resend account
  - your Resend account is still under test-mode restrictions
  - the recipient address is not allowed in your current Resend account state

This workflow now uploads `follow-builders-delivery.json` in the artifact so the next run will show the exact Resend error message more clearly.

## Push this fork to your own GitHub repo

If you cloned from upstream and want this in your own repository:

```bash
cd zara-follow-builders
git remote rename origin upstream
git remote add origin <your-new-repo-url>
git push -u origin main
```

Then configure the Actions secrets/variables listed above.