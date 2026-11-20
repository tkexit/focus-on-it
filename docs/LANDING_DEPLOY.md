# Landing page deploy — Hetzner Cloud + Docker/Caddy

Deploy plan for two static sites on one box:

| Site | Served from | Source |
| --- | --- | --- |
| `unfry.dev` | `/srv/landing` | `landing/index.html` + `landing/og.png` |
| `app.unfry.dev` | `/srv/app` | `dist/` (from `npm run build`) |

`www.unfry.dev` is redirect-only (301 → `unfry.dev`).

The landing is a self-contained ~73 KB HTML file (fonts and favicon inlined; the
only external request is the GA4 tag) plus a 30 KB Open Graph image. The app is
a normal Vite build. Neither needs anything on the server beyond a web server
that does automatic HTTPS.

The config and provisioning files referenced below live in the repo:
`deploy/Caddyfile`, `deploy/docker-compose.yml`, `deploy/cloud-init.yaml`, and
`scripts/deploy.sh`.

**Locked-in choices**

| Decision | Choice | Why |
| --- | --- | --- |
| Server | Hetzner Cloud **CAX11** (Arm, 2 vCPU / 4 GB / 40 GB), Ubuntu 24.04 | Cheapest sensible box, ~€4/mo incl. IPv4. x86 alt: **CX22** same price. |
| Web server | **Caddy** in Docker | Automatic Let's Encrypt HTTPS + HTTP/2/3, gzip, one short config. |
| TLS | Caddy auto (Let's Encrypt) | Zero-touch issuance and renewal; certs persisted in a Docker volume. |
| Domain | **unfry.dev** | Own domain for the product; landing on the apex, app on `app.`. |
| Deploy | `scripts/deploy.sh` (rsync) → served instantly | No restart needed for content changes. |

Throughout, replace **`SERVER_IP`** with the server's IPv4 (and `SERVER_IPV6`
with its IPv6). The domain is filled in already.

> **`.dev` is HSTS-preloaded.** The entire `.dev` TLD ships in browsers' HSTS
> preload list, so Chrome/Safari/Firefox will refuse to load `http://` at all
> and jump straight to `https://`. Two consequences: HTTPS must work before the
> site is reachable in any browser (Caddy handles this automatically), and you
> can only test the plain-HTTP redirect with `curl`, never in a browser.

> Cheaper-still alternative you're skipping: a single static file could live on
> object storage/CDN or a Hetzner Storage Box for ~€1/mo, but you chose a
> Docker VPS — more control, room to grow, and the config below stays reusable.

---

## Phase 0 — Prerequisites (local, ~5 min)

- [ ] Hetzner account with a **Cloud project** created (console.hetzner.cloud).
- [ ] An **SSH keypair** (`ssh-keygen -t ed25519` if you don't have one). You'll
      upload the public key to Hetzner.
- [ ] Access to your **domain's DNS** (registrar or DNS host).
- [ ] `rsync`, `ssh`, `dig` available locally (all present on macOS).

## Phase 1 — Provision the server (~5 min)

In the Hetzner Cloud Console:

1. **Add your SSH key**: Project → *Security* → *SSH Keys* → paste
   `~/.ssh/id_ed25519.pub`.
2. **Create server**:
   - Location: closest to your audience (EU: Nuremberg/Falkenstein/Helsinki).
   - Image: **Ubuntu 24.04**.
   - Type: **CAX11** (Arm) — Caddy's image is multi-arch so Arm is fine.
   - Networking: IPv4 **and** IPv6 enabled.
   - SSH key: select the one from step 1.
3. **Firewall** (Project → *Firewalls* → create, attach to server):
   - Inbound allow **22/tcp** (SSH), **80/tcp**, **443/tcp**, **443/udp** (HTTP/3).
   - Everything else denied.
4. Note the server's **IPv4** and **IPv6**.

## Phase 2 — DNS (~5 min + propagation)

At whoever hosts DNS for `unfry.dev`, add six records — the apex, `www`, and
`app`, each with an A and an AAAA:

```
A     unfry.dev             SERVER_IP           TTL 300
AAAA  unfry.dev             SERVER_IPV6         TTL 300
A     www.unfry.dev         SERVER_IP           TTL 300
AAAA  www.unfry.dev         SERVER_IPV6         TTL 300
A     app.unfry.dev         SERVER_IP           TTL 300
AAAA  app.unfry.dev         SERVER_IPV6         TTL 300
```

In most DNS panels the apex is entered as `@` and the others as `www` / `app`.
Use A/AAAA on the apex, not a CNAME. Remove any parking/forwarding records the
registrar created for the apex or `www`, or they will shadow these.

Every name must resolve before Caddy starts, or certificate issuance fails for
whichever one is missing.

Verify before continuing — Caddy can't get a cert until the name resolves to
this box:

```bash
dig +short unfry.dev               # should print SERVER_IP
dig +short AAAA unfry.dev          # should print SERVER_IPV6
dig +short www.unfry.dev           # should print SERVER_IP
dig +short app.unfry.dev           # should print SERVER_IP
dig +short AAAA app.unfry.dev      # should print SERVER_IPV6
```

## Phase 3 — Baseline hardening (~10 min)

SSH in as root, then:

```bash
apt update && apt -y upgrade

# non-root sudo user
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/

# lock down SSH: no root login, keys only
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# automatic security updates
apt -y install unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
```

Open a **new** terminal and confirm `ssh deploy@SERVER_IP` works before closing
the root session.

Install Docker (as `deploy`, using sudo):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# log out / back in so the group applies, then: docker run hello-world
```

## Phase 4 — App layout + Caddy in Docker

The config files are in the repo, so this phase is mostly copying them up.
On the server, as `deploy` (skip if you used the cloud-init in the appendix,
which creates these directories for you):

```bash
sudo mkdir -p /opt/focusonit/site/landing /opt/focusonit/site/app
sudo chown -R deploy:deploy /opt/focusonit
```

From your **local** machine, repo root:

```bash
rsync -avz deploy/Caddyfile deploy/docker-compose.yml deploy@SERVER_IP:/opt/focusonit/
./scripts/deploy.sh all           # builds the app, uploads both sites
```

Then on the **server**:

```bash
cd /opt/focusonit && docker compose up -d
docker compose logs -f caddy      # watch it obtain both certificates
```

`deploy/Caddyfile` has one block per site. Two details matter:

- **SPA fallback** on `app.unfry.dev` (`try_files {path} /index.html`) so a deep
  link does not 404.
- **Cache headers.** `/assets/*` is content-hashed by Vite and pinned for a
  year; `index.html`, `sw.js`, and `manifest.webmanifest` are `no-cache`.
  `src/main.tsx` registers `/sw.js` in production, and a long-cached service
  worker would strand users on a stale build.

`www.unfry.dev` is a redirect-only block (301 → `https://unfry.dev`).

The `caddy_data` volume keeps the issued certificates across restarts and
redeploys — never delete it, or repeated `up`s can hit Let's Encrypt rate
limits.

## Phase 5 — Redeploy workflow

Content changes need no restart — Caddy serves the files live. From the repo
root, using `scripts/deploy.sh`:

```bash
./scripts/deploy.sh landing   # index.html + og.png  -> unfry.dev
./scripts/deploy.sh app       # npm run build, dist/ -> app.unfry.dev
./scripts/deploy.sh all
```

The host defaults to `deploy@unfry.dev`; override it while DNS is still
propagating:

```bash
DEPLOY_HOST=deploy@SERVER_IP ./scripts/deploy.sh all
```

The app target runs `npm run build` first (`tsc` + `vite build`), which is the
repo's only automated check — a type error correctly aborts the deploy. It
rsyncs with `--delete` so stale hashed assets don't pile up on the server. The
landing target never uses `--delete`: that directory is hand-curated, not a
build output.

Only if you change `Caddyfile` or `docker-compose.yml`:

```bash
rsync -avz deploy/Caddyfile deploy/docker-compose.yml deploy@SERVER_IP:/opt/focusonit/
ssh deploy@SERVER_IP 'cd /opt/focusonit && docker compose up -d'
```

## Phase 6 — Verify

```bash
curl -sI https://unfry.dev       | head        # 200, HTTP/2, valid cert
curl -sI https://app.unfry.dev   | head        # 200
curl -sI http://unfry.dev        | head        # 308 redirect → https
curl -sI https://www.unfry.dev   | grep -i location   # https://unfry.dev/

curl -sI https://app.unfry.dev/sw.js | grep -i cache-control          # no-cache
curl -sI https://app.unfry.dev/assets/ -o /dev/null                   # (see below)
curl -s https://unfry.dev/og.png -o /dev/null -w '%{http_code} %{size_download}\n'
```

Use `curl` for the redirect check, not a browser — `.dev` is HSTS-preloaded, so
a browser never issues the plain-HTTP request in the first place.

- [ ] `unfry.dev` and `app.unfry.dev` load over HTTPS with valid, auto-renewing certs.
- [ ] `http://` redirects to `https://` (curl only, per above).
- [ ] `og.png` returns 200 and ~30 KB.
- [ ] A deep link such as `https://app.unfry.dev/anything` serves the app, not a 404.
- [ ] `/sw.js` comes back `no-cache`; a file under `/assets/` comes back `immutable`.
- [ ] Consent banner appears on first visit, and not on the second.
- [ ] Pasting `https://unfry.dev` into Slack/Telegram shows the preview card.
- [ ] Dark mode / `theme-color` render on a real phone.
- [ ] Lighthouse pass on the landing (should be near-perfect — one file, ~40 lines of JS).

## Phase 7 — Optional polish & ops

- **Social preview**: done. `og:image` (`landing/og.png`, 1200×630),
  `og:url`, `og:site_name`, `twitter:card`, and `canonical` are all in the page.
  The image is regenerated with headless Chrome — no rasterizer is installed on
  this machine (`rsvg-convert`, `cairosvg`, ImageMagick are all absent):

  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --window-size=1200,630 \
    --screenshot="$PWD/landing/og.png" "file://$PWD/landing/og-source.html"
  ```

  (`og-source.html` is a throwaway — recreate it from the landing's own palette
  and `@font-face` rules if the card ever needs updating.)
- **App Store link**: there's no download/store link yet — add when v1 ships.
  The footer currently says "coming to the App Store" as plain text.
- **Signature phrase**: consider a short personal tagline in the copy (e.g.
  "From Prague with Love") — a future content idea, not blocking deploy.
- **Backups**: not really needed — everything is in git and the box is
  disposable. A Hetzner snapshot (~20% of server cost) is optional insurance.
- **Uptime check**: a free external monitor (UptimeRobot etc.) on both URLs.
- **Analytics**: wired with Measurement ID `G-SNDH5787L7` — see below.

## Phase 8 — Analytics: GA4 with Consent Mode v2

**Decision: option (b) — keep GA4, gated behind a consent banner.** The
alternatives considered were (a) drop analytics entirely and (c) self-host a
cookieless tool like Plausible; both were declined.

### What is already in the page

`landing/index.html` ships with:

- A `gtag('consent', 'default', …)` call that denies `ad_storage`,
  `ad_user_data`, `ad_personalization`, and `analytics_storage`, with
  `wait_for_update: 500`. It runs **before** `gtag.js` is requested — that
  ordering is what makes Consent Mode work, so don't reorder those two blocks.
- `gtag('config', …, { anonymize_ip: true })`.
- A banner at the foot of the page ("A quiet analytics cookie?" / *No thanks* /
  *Allow*), styled from the page's existing CSS tokens so it follows light and
  dark automatically. The choice is stored in `localStorage` under
  `focus-on-it-consent` and replayed into the `consent default` call on the next
  visit, so the banner is only ever shown once.
- While the banner is up, `body.consent-open` adds bottom padding sized from JS
  (`--consent-space`), so the fixed bar never covers the footer CTA.

The **Measurement ID is `G-SNDH5787L7`**, in three places: the explanatory
comment, the `gtag('config', …)` call, and the `gtag.js` URL. To change it,
replace all three (see *Wiring it in* below, substituting the old ID for the
placeholder).

> **What Consent Mode does and does not do.** With `analytics_storage: denied`,
> gtag.js still loads and still sends cookieless pings to Google — it sets no
> cookies and no persistent identifier, but the visitor's IP does reach Google.
> This is the standard, widely-deployed reading of consent-before-tracking. A
> strict reading would not load the tag at all before consent. If that matters
> to you, move the `<script async src="…gtag/js…">` line into the *Allow*
> handler so nothing is requested until the visitor opts in.

### Getting a GA4 Measurement ID (~5 min)

1. Go to **analytics.google.com** and sign in with your Google account.
2. **If you have no Analytics account yet**: click the gear icon (**Admin**,
   bottom-left) → **Create** → **Account**. Give it a name (e.g. `kexit`), take
   the default data-sharing checkboxes → **Next**.
3. **Create the property**: name it `Focus On It`, set reporting time zone to
   *Europe/Prague* and a currency → **Next** → answer the business-details
   questions (industry, size — they only shape default reports) → **Create** →
   accept the Terms of Service.
4. **Set up a data stream** — this is the step that mints the ID. Choose
   platform **Web**, then:
   - Website URL: `https://unfry.dev`
   - Stream name: `Focus On It landing`
   - Leave *Enhanced measurement* on (it adds scroll/outbound-click tracking
     with no extra code).
   - Click **Create stream**.
5. The **Web stream details** panel opens and shows **Measurement ID** in the
   top-right: `G-` followed by 10 characters. Copy it.

To find it again later: **Admin** → **Data streams** → click the stream →
**Measurement ID**.

> Don't confuse it with the **Stream ID** (a plain number, shown right next to
> it) or with a legacy Universal Analytics `UA-` ID. The tag needs the `G-` one.

### Wiring it in

Already done: `G-SNDH5787L7` is in `landing/index.html`. Analytics is
**landing-only** — the app (`index.html` at the repo root, iOS, Android) stays
tracker-free, matching the "Data Not Collected" store declarations in
docs/PUBLISH.md. Don't add gtag to the app without revisiting those.

To ship it, from the repo root:

```bash
grep -c 'G-SNDH5787L7' landing/index.html    # expect 3 (comment, config, script src)
./scripts/deploy.sh landing
```

To switch to a different ID later, replace all three occurrences
(`sed -i '' 's/G-SNDH5787L7/G-NEWID/g' landing/index.html`) and redeploy.
`scripts/deploy.sh` prints a warning if it uploads a page that still contains
the old `G-XXXXXXXXXX` placeholder.

Then confirm: open `https://unfry.dev`, click **Allow** on the banner, and
in GA4 go to **Reports** → **Realtime**. Your visit should appear within ~30
seconds. Data in the standard reports lags by 24–48 h — Realtime is the only
same-day confirmation that the tag fires.

If nothing shows up: check that you allowed consent (denying it is the intended
default), and that `localStorage['focus-on-it-consent']` is `granted`. Clearing
that key brings the banner back for retesting.

## Appendix — one-shot provisioning (optional)

To collapse Phases 3–4, paste **`deploy/cloud-init.yaml`** as cloud-init
user-data when creating the server (Console → server creation → *Cloud config*).
It creates the `deploy` user with key-only SSH, installs Docker, and lays down
`/opt/focusonit/site/{landing,app}`. Afterwards you still copy the two config
files up and start Caddy:

```bash
rsync -avz deploy/Caddyfile deploy/docker-compose.yml deploy@SERVER_IP:/opt/focusonit/
./scripts/deploy.sh all
ssh deploy@SERVER_IP 'cd /opt/focusonit && docker compose up -d'
```

The file ships with a `<your-ssh-public-key>` placeholder under
`ssh_authorized_keys` — paste your own public key there before using it.

Note the ordering inside it: `users:` runs **before** `runcmd:`, and the
`docker` group doesn't exist until the Docker install creates it. Listing
`docker` under `groups:` therefore fails at user-creation time — the group
membership has to be added with `usermod` after the install instead. `runcmd`
runs as root, so `mkdir`/`chown` need no `sudo`.

---

### Cost summary

| Item | ~Monthly |
| --- | --- |
| CAX11 server + IPv4 | ~€4 |
| Domain | `unfry.dev` renewal (registrar price, per year) |
| **Total** | **~€4/mo** |
