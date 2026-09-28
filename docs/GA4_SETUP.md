# GA4 on the unfry.dev landing — personal setup notes

Temporary checklist; delete once analytics is live.

The landing (`landing/index.html`) already ships Google Analytics 4 with
Consent Mode v2: nothing is stored until the visitor clicks **Allow** in the
banner (choice kept in `localStorage['focus-on-it-consent']`). The only thing
missing is the real Measurement ID — the page still has the placeholder
`G-XXXXXXXXXX` in three places.

## 1. Get a Measurement ID (~5 min)

1. analytics.google.com → sign in.
2. No Analytics account yet: **Admin** (gear, bottom-left) → **Create** →
   **Account**, name it (e.g. `kartoshkin`) → **Next**.
3. **Property**: name `Focus On It`, time zone *Europe/Prague*, currency
   *EUR* → **Next** → business details (any) → **Create** → accept ToS.
4. **Data stream** → **Web**:
   - Website URL: `https://unfry.dev`
   - Stream name: `Focus On It landing`
   - Keep *Enhanced measurement* on.
   - **Create stream**.
5. Copy **Measurement ID** (top-right of *Web stream details*): `G-` + 10
   characters. Not the numeric *Stream ID*.

Find it later: **Admin** → **Data streams** → the stream.

## 2. Put it in the page

```bash
sed -i '' 's/G-XXXXXXXXXX/G-YOURREALID/g' landing/index.html
grep -c 'G-YOURREALID' landing/index.html     # expect 3
./scripts/deploy.sh landing                     # warning about the placeholder is gone
```

## 3. Check it fires

1. Open https://unfry.dev in a normal (non-incognito) window, click **Allow**.
2. GA4 → **Reports** → **Realtime**: your visit appears within ~30 s.
   Standard reports lag 24–48 h; Realtime is the only same-day check.

Nothing shows? Make sure you clicked **Allow** (declining is the default) and
that `localStorage['focus-on-it-consent']` is `granted` (DevTools →
Application → Local Storage). Delete that key to see the banner again.
Ad blockers also block gtag — test with them off.

## 4. Useful extras (optional)

- **Count signups as a conversion.** The form doesn't send a GA event yet.
  Formspree is the source of truth for leads; if you also want them in GA,
  add `gtag('event', 'generate_lead')` in the form's `res.ok` branch (end of
  `landing/index.html`), deploy, then **Admin** → **Events** → mark
  `generate_lead` as a key event.
- **Filter your own visits**: **Admin** → **Data streams** → stream →
  *Configure tag settings* → *Define internal traffic* (your IP), then
  **Admin** → **Data filters** → activate *Internal Traffic*.
- **Stricter privacy** (load nothing before consent): move the
  `<script async src="…gtag/js…">` tag into the *Allow* handler. Current
  setup sends cookieless pings (IP reaches Google) before consent.
