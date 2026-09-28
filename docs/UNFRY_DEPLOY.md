# Runbook — retire `intetim`, ship the landing on unfry.dev

Two parts, in this order:

- **Part A** — shut down the old Hetzner project `intetim` so it stops billing.
- **Part B** — a fresh Hetzner box with Caddy serving `landing/` at
  **https://unfry.dev**, the feedback form delivering leads via Formspree.

Repo files used: `landing/index.html`, `landing/og.png`, `deploy/Caddyfile`,
`deploy/docker-compose.yml`, `deploy/cloud-init.yaml`, `scripts/deploy.sh`.

| Decision | Choice | Why |
| --- | --- | --- |
| Server | New Hetzner Cloud **CAX11** (Arm, ~€4/mo), Ubuntu 24.04, in a **new** project | Clean slate; nothing from `intetim` leaks in. |
| Web server | Caddy in Docker | Automatic Let's Encrypt HTTPS, one short config. |
| DNS | Cloudflare (the registrar), records **DNS only** (grey cloud) | Caddy gets its own cert directly; no proxy/SSL-mode interplay. |
| Leads | Formspree (free tier: 50 submissions/mo) | Form is already wired; no backend. |
| Canonical host | `unfry.dev`; `www.unfry.dev` → 301 to apex | |

---

## Part A — Decommission `intetim` (~15 min)

Hetzner bills per resource, not per project. Deleting the server alone can
leave Primary IPs, volumes and snapshots running up a bill. Deletion is
**irreversible** — do A1 before anything else.

### A1. Save what you might want (skip if the project is truly worthless)

In console.hetzner.cloud → project **intetim**, write down the inventory of
every tab: *Servers, Volumes, Load Balancers, Primary IPs, Floating IPs,
Networks, Firewalls, Snapshots/Backups, Certificates*.

If anything on the server matters (DB dump, uploads, `.env`, configs), pull it
down now:

```bash
ssh root@OLD_IP 'tar czf - /etc /opt /srv /home /var/www 2>/dev/null' > ~/intetim-backup.tar.gz
# databases, if any — examples:
ssh root@OLD_IP 'docker ps --format "{{.Names}}"'            # what was running
ssh root@OLD_IP 'pg_dumpall -U postgres' > ~/intetim-pg.sql     # Postgres on host
```

Note the server's IPv4/IPv6 — you'll need them in A2.

### A2. Cut DNS that points at it

Anything still resolving to `OLD_IP` will break (or, worse, later point at
someone else's server once Hetzner recycles the IP). In every DNS zone you
own (Cloudflare and elsewhere), find and delete A/AAAA records with the old
IPs. Also check Supabase/OAuth redirect URLs, webhooks, uptime monitors,
GitHub Actions secrets that reference the old host.

### A3. Delete resources (console, inside project `intetim`)

Order matters because of attachments:

1. **Servers** → each server → *Delete*. If you want a last-resort copy,
   *Power off → Create snapshot* first (billed ~€0.01/GB/mo; delete it later).
2. **Volumes** → detach if still attached → *Delete*.
3. **Primary IPs** → delete any unassigned ones (they bill even without a server).
4. **Floating IPs**, **Load Balancers** → delete.
5. **Snapshots / Backups** → delete (keep the one from step 1 only if you really want it).
6. **Firewalls**, **Networks**, **Certificates**, **SSH keys** → delete (free, but clutter).

### A4. Delete the project

Project → *Settings* (or the `⋯` menu on the project card) → *Delete project*.
Hetzner refuses while any resource remains — that's a useful final check.

Last: next month's invoice in *Billing* should show no `intetim` lines. If you
also had a **Robot** (dedicated server / Storage Box) under that account,
cancel it separately at robot.hetzner.com — the Cloud console does not see
Robot products.

---

## Part B — Deploy the landing to unfry.dev (~30 min)

> **`.dev` is HSTS-preloaded.** Browsers never request `http://` on `.dev`, so
> the site is unreachable until HTTPS works. Test the HTTP→HTTPS redirect with
> `curl` only.

### B1. Create the server (~5 min)

console.hetzner.cloud → **New project** `unfry` → *Add server*:

- Location: Falkenstein / Nuremberg / Helsinki (EU).
- Image: **Ubuntu 24.04**. Type: **CAX11** (Arm; Caddy's image is multi-arch).
- Networking: IPv4 + IPv6.
- SSH key: add `~/.ssh/id_ed25519_personal.pub`.
- **Cloud config**: paste the whole of `deploy/cloud-init.yaml`. It creates the
  `deploy` user (key-only SSH, root login off), installs Docker and
  unattended-upgrades, and creates `/opt/focusonit/site/{landing,app}`.

Then *Firewalls* → create, attach to the server: inbound **22/tcp, 80/tcp,
443/tcp, 443/udp**; everything else denied.

Note `SERVER_IP` and `SERVER_IPV6`. Cloud-init needs ~2–3 min; check with:

```bash
ssh -i ~/.ssh/id_ed25519_personal deploy@SERVER_IP 'cloud-init status --wait && docker --version'
```

### B2. DNS in Cloudflare (~5 min)

dash.cloudflare.com → `unfry.dev` → *DNS* → *Records*. Add, all with
**Proxy status: DNS only (grey cloud)**:

```
A      unfry.dev      SERVER_IP
AAAA   unfry.dev      SERVER_IPV6
CNAME  www            unfry.dev
```

Why grey cloud: with the orange proxy, Cloudflare terminates TLS and Caddy's
Let's Encrypt challenge can fail (e.g. with *Always Use HTTPS* on). You can
switch to orange later — set *SSL/TLS → Full (strict)* first — but it buys
little for one static page.

If Cloudflare created any default/parking records for the apex, delete them.
Verify:

```bash
dig +short unfry.dev          # SERVER_IP
dig +short AAAA unfry.dev     # SERVER_IPV6
dig +short www.unfry.dev      # unfry.dev. + SERVER_IP
```

### B3. Formspree — where the leads land (~5 min)

1. formspree.io → sign up → *New form* → name `unfry landing`, target email =
   yours. Confirm the email Formspree sends.
2. Copy the form endpoint: `https://formspree.io/f/xxxxxxxx`.
3. In the form's *Settings* → *Restrict to domain*: `unfry.dev` (blocks abuse
   of the endpoint from other sites).
4. Wire it in:

```bash
sed -i '' 's#formspree.io/f/FORM_ID#formspree.io/f/xxxxxxxx#' landing/index.html
grep -c 'formspree.io/f/xxxxxxxx' landing/index.html   # expect 1
```

Submissions show up in the Formspree dashboard (exportable to CSV) and by
email. The form sends a required `email`, plus optional `platform`
(Web/iOS/Android) and `message`; a honeypot (`_gotcha`) filters bots.

Optional now, doable later: GA4 — see `docs/GA4_SETUP.md`. Until then the
page just loads a dead tag.

### B4. Upload and start Caddy (~5 min)

From the repo root:

```bash
export DEPLOY_HOST=deploy@SERVER_IP     # until DNS is confirmed; later the default deploy@unfry.dev works
rsync -avz deploy/Caddyfile deploy/docker-compose.yml $DEPLOY_HOST:/opt/focusonit/
./scripts/deploy.sh landing
ssh $DEPLOY_HOST 'cd /opt/focusonit && docker compose up -d && docker compose logs -f caddy'
```

Wait for `certificate obtained successfully` for `unfry.dev` and
`www.unfry.dev`, then Ctrl-C. SSH uses your default key; if it doesn't pick
the right one, add to `~/.ssh/config`:

```
Host unfry.dev SERVER_IP
  User deploy
  IdentityFile ~/.ssh/id_ed25519_personal
```

### B5. Verify

```bash
curl -sI https://unfry.dev | head -5              # 200, HTTP/2
curl -sI https://www.unfry.dev | grep -i location # https://unfry.dev/
curl -sI http://unfry.dev | head -3               # 308 → https
curl -s https://unfry.dev/og.png -o /dev/null -w '%{http_code} %{size_download}\n'   # 200 ~30 KB
```

- [ ] Page loads on desktop and phone, light + dark.
- [ ] **Submit the form yourself** → "Thank you — noted." → entry in the
      Formspree dashboard + email arrives. (First submission may ask you to
      confirm the form.)
- [ ] Pasting `https://unfry.dev` into Telegram/Slack shows the preview card.
- [ ] Consent banner shows on first visit only.

### B6. Day-to-day

```bash
./scripts/deploy.sh landing     # after editing landing/index.html — live instantly, no restart
```

Only after editing `Caddyfile`/`docker-compose.yml`:

```bash
rsync -avz deploy/Caddyfile deploy/docker-compose.yml deploy@unfry.dev:/opt/focusonit/
ssh deploy@unfry.dev 'cd /opt/focusonit && docker compose up -d'
```

Never delete the `caddy_data` Docker volume — it holds the certificates.

When the web app is ready: add `A/AAAA app` records (grey cloud), uncomment
the `app.unfry.dev` block in `deploy/Caddyfile`, push it as above, then
`./scripts/deploy.sh app`.

### Cost

| Item | ~Monthly |
| --- | --- |
| CAX11 + IPv4 | ~€4 |
| unfry.dev (Cloudflare, at cost) | ~€1 (billed yearly) |
| Formspree free tier | €0 |
