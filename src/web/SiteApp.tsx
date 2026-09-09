import { lazy, Suspense, useEffect, useState } from "react";
import { AboutDialog } from "./AboutDialog";
import {
  appVersion,
  CREDIT,
  desktopDownloadUrl,
  desktopMeta,
  externalRel,
  mithrilContactUrl,
  mithrilUrl,
  publicUrl,
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
  const [working, setWorking] = useState(() => location.hash === "#workspace");
  useEffect(() => {
    const change = () => setWorking(location.hash === "#workspace");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const hasDownload = Boolean(desktopDownloadUrl);

  return (
    <div className={"site" + (working ? " site-working" : "")}>
      <a className="skip-link" href="#workspace">
        Skip to live demo
      </a>
      <header className="site-header">
        <a className="site-lockup" href="#top">
          <img src={publicUrl("brand/delvepath-lockup-transparent.png")} alt="DelvePath" height={40} />
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
            DelvePath 0.2 is an offline Plan & Flight Deck workspace: accepted surveys, estimated
            bit, user-authored scenarios, planning constructors, target geometry, centerline
            screening, depth datums, and handover reports. The anti-collision lab adds layered
            uncertainty previews and traceable geometric correction candidates. The same Rust engines run in the
            Windows field app and here in WebAssembly. Work stays on this device.
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
            Use <strong>Start here</strong>, then load Oregon, the dual-lateral, or{" "}
            <strong>Curve Recovery — Plan & Flight Deck</strong>. Click a forecast card to change the cyan path.
            Continue to <strong>Uncertainty</strong> to place a position-error region, then <strong>Anti-collision</strong> to check the nearby holes. Load the crossing example, use the active hole, and generate a correction. Projected stations stay labelled{" "}
            <strong>PROJECTED</strong>.
          </p>
        </section>

        <section className="workspace-section" id="workspace" aria-label="DelvePath workspace">
          {working && <a className="workspace-back" href="#top">← About DelvePath · leave workspace</a>}
          <Suspense fallback={<p className="workspace-loading">Loading calculation workspace…</p>}>
            <App />
          </Suspense>
        </section>

        <section className="trust" id="trust">
          <h2>What this demonstrates</h2>
          <ul>
            <li>Minimum Curvature survey reconstruction from measured MD / INC / AZI.</li>
            <li>Selectable Flight Deck forecasts linked to surveys, uncertainty and nearby-hole clearance.</li>
            <li>True target footprints, centerline screening, and typed depth datums.</li>
            <li>Layered anti-collision evaluation: explicit uncertainty envelopes, bounded geometric candidates, and reproducible audit export. No operational steering commands.</li>
            <li>One Rust engine family (`delve-core`, `delve-planning`, `delve-assurance`) for desktop and browser. No second TypeScript solver.</li>
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
        <img src={publicUrl("brand/delvepath-icon-transparent.png")} alt="" width={36} height={36} />
        <div>
          <p className="credit">{CREDIT}</p>
          <p>
            <a href={publicUrl("legal/LICENSE.txt")}>Apache-2.0</a>
            {" · "}
            <a href={publicUrl("legal/NOTICE.txt")}>NOTICE</a>
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
