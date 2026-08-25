import { lazy, Suspense, useState } from "react";
import { AboutDialog } from "./AboutDialog";
import {
  appVersion,
  CREDIT,
  desktopDownloadUrl,
  desktopMeta,
  externalRel,
  mithrilContactUrl,
  mithrilUrl,
  SAFETY,
  sourceUrl,
} from "./config";

const App = lazy(() => import("../App"));

function DownloadAction({ className }: { className?: string }) {
  if (!desktopDownloadUrl) {
    return (
      <span className={className ? `${className} is-disabled` : "is-disabled"} aria-disabled="true">
        Windows download (folder URL not configured)
      </span>
    );
  }
  return (
    <a className={className} href={desktopDownloadUrl} {...externalRel()}>
      Windows download
    </a>
  );
}

export function SiteApp() {
  const [about, setAbout] = useState(false);
  const hasDownload = Boolean(desktopDownloadUrl);

  return (
    <div className="site">
      <a className="skip-link" href="#workspace">
        Skip to live demo
      </a>
      <header className="site-header">
        <a className="site-lockup" href="#top">
          <img src="/brand/delvepath-lockup-transparent.png" alt="DelvePath" height={40} />
        </a>
        <nav className="site-nav" aria-label="DelvePath">
          <a href="#workspace">Live Demo</a>
          {hasDownload ? (
            <a href={desktopDownloadUrl} {...externalRel()}>
              Windows Download
            </a>
          ) : (
            <span className="nav-disabled" aria-disabled="true" title="Set VITE_DESKTOP_DOWNLOAD_URL">
              Windows Download
            </span>
          )}
          <a href={sourceUrl} {...externalRel()}>
            Source
          </a>
          <a href={mithrilUrl}>Mithril Consulting</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Mithril Consulting proof of work</p>
          <h1>Directional survey calculation you can actually run.</h1>
          <p className="lede">
            DelvePath reconstructs a borehole from MD, INC, and AZI with Minimum Curvature
            (ISCWSA). The same Rust engine that powers the Windows field app runs here in
            WebAssembly. Work stays on this device.
          </p>
          <p className="banner site-banner">{SAFETY}</p>
          <div className="hero-actions">
            <a className="primary-link" href="#workspace">
              Open the live demo
            </a>
            <DownloadAction className="secondary-link" />
          </div>
          {hasDownload && (
            <dl className="download-meta">
              <div>
                <dt>Desktop version</dt>
                <dd>{desktopMeta.version}</dd>
              </div>
              <div>
                <dt>Installer</dt>
                <dd>{desktopMeta.filename}</dd>
              </div>
              {desktopMeta.size ? (
                <div>
                  <dt>Size</dt>
                  <dd>{desktopMeta.size}</dd>
                </div>
              ) : null}
              {desktopMeta.date ? (
                <div>
                  <dt>Released</dt>
                  <dd>{desktopMeta.date}</dd>
                </div>
              ) : null}
              {desktopMeta.sha256 ? (
                <div>
                  <dt>SHA-256</dt>
                  <dd className="mono">{desktopMeta.sha256}</dd>
                </div>
              ) : null}
              <div>
                <dt>Windows</dt>
                <dd>{desktopMeta.windows}</dd>
              </div>
              {desktopMeta.githubRelease ? (
                <div>
                  <dt>Source tag</dt>
                  <dd>
                    <a href={desktopMeta.githubRelease} {...externalRel()}>
                      GitHub Release
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </section>

        <section className="guided" id="start">
          <h2>Guided demo</h2>
          <p>
            Use <strong>Start here</strong> in the workspace, then load the public Oregon
            example or the constructed dual-lateral. Switch holes, set a target, and turn on a
            Straight Line projection — projected stations stay labelled <strong>PROJECTED</strong>.
          </p>
        </section>

        <section className="workspace-section" id="workspace" aria-label="DelvePath workspace">
          <Suspense fallback={<p className="workspace-loading">Loading calculation workspace…</p>}>
            <App />
          </Suspense>
        </section>

        <section className="trust" id="trust">
          <h2>What this demonstrates</h2>
          <ul>
            <li>Minimum Curvature survey reconstruction from measured MD / INC / AZI.</li>
            <li>Parent wellbore plus a sidetrack tied on at a selected measured station.</li>
            <li>Plan, profile, and interactive 3-D views from the calculated path — not a screenshot.</li>
            <li>One Rust engine (`delve-core`) for desktop and browser. No second TypeScript solver.</li>
            <li>
              Automated tests: synthetic L1 cases, WinSERVE / COMPASS / HawkEye goldens within
              documented print-precision tolerances, storage migrations, and browser snapshot checks.
            </li>
            <li>
              Local-first privacy: browser projects stay in IndexedDB on this device. Nothing is
              uploaded. There is no account, analytics, or license server.
            </li>
          </ul>
          <p>
            <a href={sourceUrl} {...externalRel()}>
              Source repository
            </a>
            {" · "}
            <button type="button" className="linkish" onClick={() => setAbout(true)}>
              License, NOTICE, and third-party notices
            </button>
            {" · Apache-2.0"}
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <img src="/brand/delvepath-icon-transparent.png" alt="" width={36} height={36} />
        <div>
          <p className="credit">{CREDIT}</p>
          <p>
            <a href="/legal/LICENSE.txt">Apache-2.0</a>
            {" · "}
            <a href="/legal/NOTICE.txt">NOTICE</a>
            {" · "}
            <button type="button" className="linkish" onClick={() => setAbout(true)}>
              Licenses
            </button>
            {" · "}
            <a href={mithrilUrl}>Mithril Consulting</a>
            {" · "}
            <a href={mithrilContactUrl}>Contact</a>
            {` · v${appVersion}`}
          </p>
          <p className="muted">{SAFETY}</p>
        </div>
      </footer>
      {about && <AboutDialog onClose={() => setAbout(false)} />}
    </div>
  );
}
