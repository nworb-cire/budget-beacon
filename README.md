<img src="extension/icons/beacon.svg" width="64" height="64" alt="Budget Beacon">

# Budget Beacon

A local Firefox extension that shows your remaining Monarch budget on shopping pages you choose. Settings use forms and category checkboxes; no JSON editing is needed.

## Install in your current Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `/home/eric/.t3/projects/walmart-budget/extension/manifest.json`.
4. The settings page opens. Sign in to [Monarch](https://app.monarch.com) in this Firefox profile, then choose **Connect browser session**. Alternatively, use email/password and your current MFA authenticator code.
5. Click **Add website**, enter `walmart.com/cart`, check the desired groups or categories, and **Save website**. Allow Firefox's website permission prompt.
6. Visit or refresh the matching page. Use the toolbar extension button to reopen settings.

Temporary installation lasts until Firefox restarts. Load the manifest again after a restart. A permanent installation requires Mozilla signing; this prototype does not change Firefox's signature protections. Firefox desktop 140+ is required.

## Run locally

```sh
npm ci
npm run firefox       # Opens a separate development Firefox with the add-on installed
npm run preview       # http://localhost:4173 — settings UI with demo data only
npm test              # Budget calculations, URL rules, and authentication adapter tests
npm run test:firefox   # Actual headless Firefox integration test, isolated temporary profile
npm run lint          # Mozilla extension validator
npm run build         # dist/budget_beacon-0.1.0.zip, unsigned
```

The extension has no runtime npm dependencies and needs no server. The preview cannot connect to Monarch; real authentication is available only in the installed extension. **Try with demo data** explicitly replaces the extension's connection with sample balances; disconnect removes credentials and cached balances, retaining page rules.

## Behavior

- Rules match the specified domain (including its `www` form) and path plus child paths. `/cart` matches `/cart/checkout`, not `/cartoon`. Query strings and fragments do not affect matching. Other subdomains need their own rule. HTTP and HTTPS are supported; an explicit port must match.
- All enabled rules matching the page contribute their selected categories. Overlaps and parent/child selections are counted once.
- Monarch groups are the parent level; categories are the child level. Selecting a category-budgeted group includes all its children. For a group-level budget, selecting the group uses Monarch's group balance. Child categories without a separate balance cannot supply a total.
- Uses Monarch's `remainingAmount` for the local current calendar month, preserving rollover and negative balances. Missing or removed categories show an unavailable message, rather than an incomplete dollar total.
- Refreshes every 15 minutes and when needed on a matched page. Same-month cached balances can appear with a **Cached** label after a failed refresh; previous-month balances are never shown. Choose USD or CAD to match your Monarch account currency; this formats the balance without converting currencies.
- Handles in-page navigation, existing open tabs, on/off controls, editing, deletion, and dismissal until you navigate to another URL.

## Monarch connection and privacy

This is an unofficial integration, based on the current read-only GraphQL and authentication shapes in [monarchmoneycommunity](https://github.com/bradleyseanf/monarchmoneycommunity). It is not affiliated with Monarch. API changes, CAPTCHA, SSO, or session expiration may require reconnecting or changes to the adapter. Live account authentication must be validated with your account; no account credentials are included in this repository.

Browser-session mode reads `session_id` and `csrftoken` from Firefox's Monarch cookies for each request. It does not copy them into extension storage. Requests use Monarch's expected Origin, Referer, and CSRF headers; the header adapter is restricted to requests initiated by this extension to `api.monarch.com`. Google/SSO users should use browser-session mode.

Email/password mode sends credentials directly to Monarch over HTTPS and stores only the returned session token. Passwords and MFA codes are cleared from the form and are never persisted. The session token, cached category balances, and rules are in `browser.storage.local` in your Firefox profile, not encrypted by this prototype. Disconnect removes the extension token and cached budget; it does not log you out of the Monarch website.

Shopping-page content scripts can request only their own display payload. They cannot read the token or full account state. Financial balances intentionally appear on selected pages; a page could observe the presence of the banner, so configure sites you trust. No analytics, external fonts, backend, or telemetry are used. Shopping URLs are not transmitted to Monarch. Permissions to inject scripts are requested per configured host, rather than blanket access to all websites.

## Structure

- `extension/core.js`: pure budget normalization, deduplication, and URL matching
- `extension/monarch.js`: read-only Monarch adapter and scoped request headers
- `extension/background.js`: credentials, cache, optional host permissions, content script registration
- `extension/content.js`: isolated banner and route updates
- `extension/options.html`, `options.js`, `styles.css`: settings GUI
- `extension/popup.html`, `popup.js`: toolbar summary
- `scripts/preview.cjs`: local UI preview, demo only
- `scripts/firefox-smoke.cjs`: isolated actual-Firefox integration harness
