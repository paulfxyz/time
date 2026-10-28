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
- There is no shell-command bridge, automatic login registration, credential store, or analytics SDK. The native updater is not exposed to webpage commands.
- The live website is trusted application code and shares the bounded native controls. A compromised site could still change what is shown or the allowed preferences; HTTPS is not a substitute for protecting the hosting account.

## Signing and installation

Release builds are ad-hoc signed for integrity checks but are not Developer ID-signed or Apple-notarized. Treat Gatekeeper warnings seriously; install only from the official release, optionally verify SHA-256, and use the documented per-app approval rather than disabling OS security globally.

## Signed automatic updates

Version 2.1.0 embeds a checksum-pinned Sparkle 2.10.1 framework. The app's `SUPublicEDKey` pins an Ed25519 verification key; both the feed and archive are signed, and archive verification is required before extraction.

`SURequireSignedFeed` is enabled and the signed-feed failure-expiration interval is zero, so an invalid feed cannot become accepted just because enough time has passed. The public update feed is the `appcast.xml` asset attached to the latest official GitHub release.

The private signing seed lives only in the encrypted repository secret `SPARKLE_PRIVATE_KEY`. Release tooling reads it through standard input, verifies signatures, and never writes the private key into the source tree, application, archive, command line or build log; do not rotate or regenerate it casually because installed apps trust its public key.

Automatic update checks are enabled by default. Automatic download/install is opt-in and managed through Sparkle's own preferences, not duplicate application defaults; installation occurs on quit or explicit install/relaunch. System-profile reporting is disabled.

Update signatures are independent of Apple Developer ID signing and notarization. They authenticate update artifacts but do not eliminate Gatekeeper first-open approval or make a managed Mac accept an application against its administrator's policy.
