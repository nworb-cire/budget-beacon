# Budget Beacon for Safari (macOS)

The Safari port reuses the Firefox extension's settings, optional rule names, many-to-many page/category mappings, popup actions, budget calculations, cache, and banner. It targets Safari 16.4 or newer on macOS. Your Safari connection and rules live in Safari's extension storage; they do not automatically share Firefox data.

## Build and install on your Mac

Install full Xcode and Node.js, copy this project to your Mac, and run from its root:

```sh
npm run package:safari
```

This generates `dist/safari-xcode` using Apple's Safari Web Extension Packager (or the older Web Extension Converter when necessary). It copies the shared web resources, installs our native Swift handler, and enables the extension's outgoing network entitlement. It does not overwrite an existing Xcode project or change Safari security settings.

1. Open the generated `.xcodeproj` in Xcode.
2. In **Signing & Capabilities**, configure the macOS app and extension targets with your Apple development team and unique bundle identifiers. Keep **Outgoing Connections (Client)** enabled on the extension target.
3. Select the macOS app scheme, then **Product > Run**. The containing app registers the extension with Safari. For an unsigned local development build, use Apple's developer-mode steps linked below; unsigned permission resets when Safari quits. For persistent everyday use, sign the app and extension appropriately rather than relying on temporary or unsigned loading.
4. In **Safari > Settings > Extensions**, enable **Budget Beacon**, including the profiles where you want it available.
5. Open its toolbar menu and settings. Connect to Monarch, then create your rules. Allow website access for Monarch and your configured shopping pages when Safari asks.

After installation, grant access from Safari's extension toolbar menu / **Manage Websites** if a matching page does not show a banner. The popup uses `activeTab` to identify a page you invoke it on before you've granted ongoing access to that site.

## Updating

`--copy-resources` makes the generated Xcode project self-contained. To update an existing project, run `npm run build:safari`, copy the refreshed files from `dist/safari` into the extension's resource group, and copy `safari/SafariWebExtensionHandler.swift` into the extension target. Rebuild/run in Xcode. Alternatively, move the existing Xcode project aside and generate a new one; configure signing again.

## Monarch transport

Safari does not support Firefox's `webRequestBlocking` header modifications. We use Safari native messaging for Monarch requests instead:

- The JavaScript background worker handles account state and reads Monarch session cookies through Safari's cookies API when connecting a browser session.
- The bundled Swift app extension sends fixed-origin HTTPS requests to `api.monarch.com`, using Monarch's expected Origin/Referer/CSRF headers.
- Only the login endpoint and the read-only `BudgetBeacon` GraphQL operation are accepted. Redirects are refused so credentials cannot be forwarded to another destination.
- Native requests use ephemeral URLSession state. The handler logs and persists no passwords, cookies, or budget responses. Passwords/MFA codes remain transient; a returned session token may be stored in the extension's local storage just as in Firefox.
- Safari native messaging is unavailable to shopping-page content scripts. The existing background message checks also prevent those scripts from reading account state.

A bare temporarily loaded Safari extension folder can test demo mode, but cannot perform live Monarch authentication: the native handler is part of the packaged app extension. Use the Xcode app project for authentication tests. Native URLSession requests may still encounter Monarch CAPTCHA; browser-session mode is the fallback, subject to live account validation.

## Local validation and limitations

```sh
npm run build:safari   # Creates the MV3 WebExtension resources under dist/safari
npm test              # Includes Safari manifest, native-message adapter, and script registration tests
npm run test:firefox   # Checks that the shared implementation still works in Firefox
```

The current Linux workspace cannot run Xcode, compile against SafariServices, sign a Mac app, or run Safari. The Swift handler and the generated project therefore require a macOS build and live Safari QA before this is considered a tested Safari release. The current packaging target is macOS; iPhone/iPad packaging is not included.

Apple references: [packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari), [running and signing](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension), [API compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility), and [native messaging](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension).
