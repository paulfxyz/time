# Security

Timescreen is a static, client-side clock with an optional native Swift macOS shell. It does not need a user account, location permission, an API key, or access to personal files.

Do not include passwords, tokens, or private server information in public issues. Use GitHub's private vulnerability reporting when available; otherwise open a minimal issue requesting a private contact without disclosing sensitive details.

The production deployment workflow is manual, restricted to `main`, and receives its FTP password only through GitHub Actions secrets. TLS certificate validation must not be disabled to work around a hosting mismatch.

Third-party source assets have pinned SHA-256 checks. Satoshi and Earth textures are acquired during setup; the two SIL Open Font License typefaces are included alongside their license files.

## Native application boundary

- The app loads only `https://time.paulfleury.com` or its own `timescreen://app` content in the main window. External HTTP(S) links open in the default browser; arbitrary URL schemes and subframe navigations are denied.
- Native messages are accepted only from the trusted main frame. Commands are limited to readiness, saved setup, fullscreen, explicit keep-awake and setup copying.
- Setup messages are bounded and key-validated. JavaScript dispatch uses JSON serialization, not unescaped string interpolation of webpage content.
- The custom resource scheme stays inside the bundled resource root, resolves symlinks and rejects traversal. It does not expose arbitrary local files or run a local HTTP server.
- There is no shell-command bridge, remote binary updater, automatic login registration, credential store, or analytics SDK.
- The live website is trusted application code and shares the bounded native controls. A compromised site could still change what is shown or the allowed preferences; HTTPS is not a substitute for protecting the hosting account.

## Signing and installation

Release builds are ad-hoc signed for integrity checks but are not Developer ID-signed or Apple-notarized. Treat Gatekeeper warnings seriously; install only from the official release, optionally verify SHA-256, and use the documented per-app approval rather than disabling OS security globally.
