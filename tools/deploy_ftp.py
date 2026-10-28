"""Explicit FTPS deployment. Secrets are supplied only by GitHub Actions.

Stages and verifies all files before activation; keeps a protected previous-copy
directory and attempts rollback if activation fails. Never deletes unrelated
remote files. The remote root is the dedicated Time FTP account's directory.
"""
import argparse
import ftplib
import hashlib
import io
import json
import os
import posixpath
import ssl
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


class VerifiedFTP_TLS(ftplib.FTP_TLS):
    def __init__(self, *args, tls_server_name=None, **kwargs):
        self.tls_server_name = tls_server_name
        super().__init__(*args, **kwargs)

    def auth(self):
        if isinstance(self.sock, ssl.SSLSocket):
            raise ValueError("TLS already active")
        response = self.voidcmd("AUTH TLS")
        self.sock = self.context.wrap_socket(
            self.sock, server_hostname=self.tls_server_name or self.host
        )
        self.file = self.sock.makefile(mode="r", encoding=self.encoding)
        return response

    def ntransfercmd(self, cmd, rest=None):
        connection, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
        if self._prot_p:
            connection = self.context.wrap_socket(
                connection,
                server_hostname=self.tls_server_name or self.host,
                session=self.sock.session,
            )
        return connection, size


def exists(ftp, name):
    try:
        return ftp.size(name) is not None
    except ftplib.error_perm as error:
        if str(error).startswith("550"):
            return False
        raise


def ensure_directory(ftp, directory):
    if directory in ("", "."):
        return
    for index, _part in enumerate(directory.split("/"), 1):
        path = "/".join(directory.split("/")[:index])
        try:
            ftp.mkd(path)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise


def remote_sha256(ftp, name):
    digest = hashlib.sha256()
    ftp.retrbinary("RETR " + name, digest.update)
    return digest.hexdigest()

def guard_baseline(ftp):
    for name, variable in [("index.html", "EXPECTED_INDEX_SHA256"), ("release.json", "EXPECTED_RELEASE_SHA256")]:
        expected = os.environ.get(variable)
        if expected and remote_sha256(ftp, name) != expected:
            raise ValueError("The Time site changed since review. No activation permitted.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["inspect", "deploy"], default="inspect")
    args = parser.parse_args()
    host = os.environ.get("FTP_HOST", "")
    username = os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("FTP_PASSWORD", "")
    directory = os.environ.get("FTP_DIRECTORY", "/")
    tls_name = os.environ.get("FTP_TLS_SERVER_NAME") or host
    if not all([host, username, password]):
        raise ValueError("FTP_HOST, FTP_USERNAME and FTP_PASSWORD must be configured.")
    if ".." in directory.split("/") or "\r" in directory or "\n" in directory:
        raise ValueError("Invalid FTP_DIRECTORY.")
    ftp = VerifiedFTP_TLS(context=ssl.create_default_context(), timeout=45, tls_server_name=tls_name)
    ftp.connect(host, int(os.environ.get("FTP_PORT", "21")))
    ftp.login(username, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    ftp.trust_server_pasv_ipv4_address = False
    ftp.cwd(directory)
    ftp.voidcmd("TYPE I")
    guard_baseline(ftp)
    try:
        remote = [
            {"name": name, "type": info.get("type"), "size": info.get("size")}
            for name, info in ftp.mlsd() if name not in (".", "..")
        ]
    except ftplib.error_perm:
        remote = [{"name": name} for name in ftp.nlst() if name not in (".", "..")]
    print(json.dumps({"directory":ftp.pwd(), "tls_verified":True, "mode":args.mode, "existing":remote[:60]}))
    if args.mode == "inspect":
        ftp.quit()
        return

    public = Path(__file__).resolve().parents[1] / "public"
    files = sorted(p for p in public.rglob("*") if p.is_file())
    if not (public / "index.html").is_file() or not (public / "release.json").is_file():
        raise ValueError("Run npm run build before deploying.")
    for file in files:
        if file.is_symlink() or file.name.startswith(".env"):
            raise ValueError("Refusing a symlink or environment file.")
    marker = uuid4().hex[:12]
    backup = ".time-backups/" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + marker
    staged, activated = [], []
    try:
        for file in files:
            relative = file.relative_to(public).as_posix()
            ensure_directory(ftp, posixpath.dirname(relative))
            temporary = relative + ".upload-" + marker
            with file.open("rb") as source:
                ftp.storbinary("STOR " + temporary, source)
            digest = hashlib.sha256(file.read_bytes()).hexdigest()
            if remote_sha256(ftp, temporary) != digest:
                raise ValueError("Uploaded-file checksum mismatch.")
            staged.append((relative, temporary, digest))
        ensure_directory(ftp, ".time-backups")
        guard_baseline(ftp)
        ftp.storbinary("STOR .time-backups/.htaccess", io.BytesIO(b"Require all denied\n"))
        # Bootstrap documents are activated after their dependencies.
        priority = {".htaccess": -1, "index.html": 10, "sw.js": 11, "release.json": 12}
        staged.sort(key=lambda row: (priority.get(row[0], 0), row[0]))
        for relative, temporary, digest in staged:
            previous = None
            if exists(ftp, relative):
                previous = posixpath.join(backup, relative)
                ensure_directory(ftp, posixpath.dirname(previous))
                ftp.rename(relative, previous)
            try:
                ftp.rename(temporary, relative)
            except Exception:
                if previous:
                    ftp.rename(previous, relative)
                raise
            activated.append((relative, previous))
        for relative, _temporary, digest in staged:
            if remote_sha256(ftp, relative) != digest:
                raise ValueError("Post-activation checksum mismatch.")
        print(json.dumps({"status":"deployed", "files":len(staged), "sha256_verified":True, "backup":backup, "url":"https://time.paulfleury.com"}))
    except Exception:
        for relative, previous in reversed(activated):
            try:
                ftp.delete(relative)
                if previous:
                    ftp.rename(previous, relative)
            except Exception:
                print("A rollback operation needs manual inspection.", file=sys.stderr)
        raise
    finally:
        for _relative, temporary, _digest in staged:
            try:
                ftp.delete(temporary)
            except ftplib.all_errors:
                pass
        try:
            ftp.quit()
        except ftplib.all_errors:
            ftp.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not print a traceback or credential-bearing environment variables.
        print(f"FTPS operation failed ({type(error).__name__}). Check the encrypted secrets, TLS server name and dedicated FTP directory.", file=sys.stderr)
        sys.exit(1)
