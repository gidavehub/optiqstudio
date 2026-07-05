# Optiq Studio — Setup & Go-Live Checklist

## 1. Google Cloud sign-in (blocking — must be done by you)

This machine is currently signed in as `gidave01@gmail.com`, which **cannot
see** the `davelabs-tools` project. Run these in your own terminal and
complete the browser sign-in as **davelabs01@gmail.com**:

```powershell
gcloud auth login davelabs01@gmail.com
gcloud auth application-default login   # sign in as davelabs01@gmail.com again
gcloud config set project davelabs-tools
firebase login:add davelabs01@gmail.com
firebase login:use davelabs01@gmail.com
```

Then enable the required APIs (one-time):

```powershell
gcloud services enable aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com identitytoolkit.googleapis.com
```

In the [Firebase console](https://console.firebase.google.com/project/davelabs-tools):
- **Authentication → Sign-in method**: enable **Google** and **Email/Password**.
- **Authentication → Settings → Authorized domains**: add your production domain.
- **Firestore**: create the database (production mode) if it doesn't exist.

## 2. Generate all site media (videos + images via Vertex AI)

After step 1 works:

```powershell
node scripts/generate-assets.mjs
```

This produces the hero video, model cards, research background and dashboard
app thumbnails into `public/media/` using Veo + the Gemini image model —
all through Vertex AI on davelabs-tools. It's idempotent; delete a file to
regenerate it. Until assets exist, every slot renders an animated gradient.

## 3. Deploy rules + Cloud Functions

```powershell
firebase deploy --only firestore:rules,storage
firebase functions:secrets:set MODEM_WEBHOOK_SECRET   # paste secret from step 4
cd functions; npm install; cd ..
firebase deploy --only functions
```

## 4. ModemPay webhook (hand-off)

Register **one** of these URLs in the ModemPay dashboard →
**Developers → Webhooks**:

- Cloud Function (works immediately, even while the site runs on localhost):
  `https://us-east4-davelabs-tools.cloudfunctions.net/modemWebhook`
- Or the app route once the site is hosted publicly:
  `https://<your-domain>/api/payments/webhook`

Copy the **signing secret** ModemPay gives you into:
- `.env.local` → `MODEM_WEBHOOK_SECRET=...` (for the app route), and/or
- `firebase functions:secrets:set MODEM_WEBHOOK_SECRET` (for the function).

Both receivers verify the HMAC-SHA512 `x-modem-signature` header and are
idempotent (a charge fulfills exactly once, so ModemPay retries are safe).

⚠️ **Rotate the live secret key**: `sk_live_…` was pasted in chat. Generate a
fresh key in the ModemPay dashboard and update `MODEM_PAY_API_KEY` in
`.env.local`.

## 5. Run the app

```powershell
npm run dev
```

- `/` — landing page
- `/login` — Google or email sign-in (new users get 300 credits)
- `/dashboard` — the studio
- Pricing: Pro subscription $100/mo → 10,000 credits; packs: 1,000/$12,
  5,000/$50, 12,000/$100. Video: Omni 12 credits/s, Omni Fast 5 credits/s;
  images 5; character sheets 15; TTS 1 per 100 chars (min 5).

## Architecture map

| Piece | Where |
| --- | --- |
| Vertex AI client (Veo video, image, TTS, prompt-enhance) | `lib/vertex.ts` |
| Credit economy + Firestore transactions | `lib/credits.ts` |
| ModemPay client + webhook signature verification | `lib/modempay.ts` |
| API routes (generate/status/user/checkout/webhook) | `app/api/**` |
| Landing page (Runway-style, light theme) | `app/page.tsx` |
| Dashboard (icon rail + creator hub) | `app/dashboard/**` |
| Cloud Functions (public webhook + plan expiry sweep) | `functions/index.js` |
| Asset generator | `scripts/generate-assets.mjs` |

Model IDs default to `gemini-omni-flash-preview`, `gemini-3.1-flash-image-preview`, `gemini-3.5-flash`, and `gemini-3.1-flash-preview-tts`.
