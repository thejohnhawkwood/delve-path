# Release checklist

Created by Philip Bird — Mithril Consulting.

## Signed annotated tag

From a verified backup of `main`:

```text
git tag -a v0.1.1 -m "DelvePath 0.1.1 — evaluation prototype"
git -c user.signingkey=<GPG_OR_SSH_KEY> tag -s v0.1.1 -m "DelvePath 0.1.1"
git push origin v0.1.1
```

Do not rewrite old commits to change author metadata. Use consistent real-name
author metadata on **new** commits only.

## Artifact hashes

```text
Get-FileHash -Algorithm SHA256 dist/index.html
Get-FileHash -Algorithm SHA256 src-tauri/target/release/bundle/nsis/DelvePath_0.1.1_x64-setup.exe
```

Publish the hashes next to the GitHub Release or the Drive folder. Do not
embed the installer in the website repository.

## CI attestations

`.github/workflows/ci.yml` builds the web bundle and, when `id-token`
permissions are available, can attach GitHub Artifact Attestations to the
commit SHA. Enable that only after the public repository exists.

## Desktop legal files

Copy `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, and `AUTHORS.md` into the
Windows evaluation folder next to the installer.

## Owner actions (not performed by agents)

1. Legal-owner wording is set: Philip Bird owns the copyright; Mithril Consulting is his trade name, not a corporation. Change `NOTICE` only if you later incorporate.
2. Desktop download folder is configured:
   `https://drive.google.com/drive/folders/1nnhXHkcPL2cjl5L7wZVUMPQnb6cnc3_d?usp=sharing`
   Override with `VITE_DESKTOP_DOWNLOAD_URL` if the folder moves. Do not rewrite it into a direct-download URL.
3. Create the Netlify site and deploy `dist/`.
4. Point `delvepath.mithrilconsulting.io` at that site.
5. Decide repository visibility / public export using this manifest.
6. Obtain a Windows code-signing certificate if distributing a signed installer.
