# Deployment

The production hostname is `https://time.paulfleury.com`. Prefer a dedicated FTP account scoped to this site's document root; an operator using a broader existing hosting account must first verify the exact Time root against independently checked public file hashes.

## Guarded operator deployment

The deployer accepts `EXPECTED_INDEX_SHA256` and `EXPECTED_RELEASE_SHA256` environment variables. When set, it verifies both before staging and again before activation, and stops if either file changed.

Do not derive a baseline hash from an HTTP 200 response without checking its content. Hosting bot checks can return a small HTML challenge with a success status; compare a real browser response with the intended source and use an inspect-only FTPS pass before publishing.

The approved production path can run from the operator's private hosting repository without copying its credential into this public repository. It checks out an immutable Timescreen commit and only writes to the hash-verified Time document root.

## GitHub configuration

In repository Settings → Secrets and variables → Actions:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `FTP_USERNAME` | The dedicated site's FTP username |
| Secret | `FTP_PASSWORD` | Its password, entered directly in GitHub's encrypted secret form |
| Variable | `FTP_HOST` | The connection hostname |
| Variable | `FTP_TLS_SERVER_NAME` | Optional hosting-provider certificate name, if different from the connection hostname |
| Variable | `FTP_DIRECTORY` | The dedicated account's website root, normally `/` |

Never add the password to a workflow file, commit, issue, README, `.env` file, or command log. The workflow passes the secret to the FTPS process in the runner environment; it does not print it.

## First deployment

1. Run **Deploy to time.paulfleury.com** with mode **inspect**.
2. Confirm the listed directory is the dedicated site's document root.
3. Run the same workflow with mode **deploy**.
4. Check the live page on desktop and mobile. Confirm `release.json` reports the expected commit.

The script enforces certificate verification on control and data channels. The optional TLS server name lets a shared host present its provider certificate while the connection remains to the configured FTP host. It does not disable certificate validation.

## Files and recovery

Every file in `public/` is uploaded to a unique temporary name, read back, and verified before activation. Bootstrap documents are activated after their dependencies. Existing matching files are moved into a protected `.time-backups/<timestamp>/` directory before replacement.

If activation fails, the script attempts to restore the previous copies. Unrelated remote files are never deleted. Backups are not automatically pruned; inspect and remove old backups deliberately after verifying newer releases.

The protection rules assume Apache-compatible `.htaccess` behavior. The shipped `.htaccess` disables directory listing, denies backup/staging paths, and sets explicit MIME types and sensible revalidation for changing code. Confirm the backup path returns 403 or 404 after first deployment.

The workflow's final HTTPS check validates the published release commit and key assets. A rendered browser check remains necessary; file transfer success alone does not prove the UI works.

## Other hosts

Run `npm ci && npm run build`, then serve the contents of `public/` over HTTPS. No backend process is needed. Fullscreen, clipboard, service-worker caching, and wake lock depend on browser permissions and capabilities.

Do not package the acquired third-party font binaries into a redistributable source archive. They are obtained during setup for the builder's own permitted website use.
