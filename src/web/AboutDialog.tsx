import licenseText from "../../LICENSE?raw";
import noticeText from "../../NOTICE?raw";
import thirdPartyText from "../../THIRD_PARTY_NOTICES.md?raw";
import { appVersion, CREDIT, gitSha, mithrilContactUrl, mithrilUrl, SAFETY, sourceUrl } from "./config";

interface Props {
  onClose: () => void;
}

export function AboutDialog({ onClose }: Props) {
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="modal about-modal"
        role="dialog"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="about-title">About / Licenses</h2>
        <p className="credit">{CREDIT}</p>
        <p className="warn-inline">{SAFETY}</p>
        <p>
          Version {appVersion}
          {gitSha !== "unknown" ? ` · ${gitSha.slice(0, 12)}` : ""}
        </p>
        <p>
          Method: Minimum Curvature as documented by ISCWSA. Results are not claimed
          bit-identical to WinSERVE.
        </p>
        <p>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Source
          </a>
          {" · "}
          <a href={mithrilUrl}>Mithril Consulting</a>
          {" · "}
          <a href={mithrilContactUrl}>Contact</a>
        </p>
        <h3>NOTICE</h3>
        <pre className="legal-pre">{noticeText}</pre>
        <h3>Apache License 2.0</h3>
        <pre className="legal-pre">{licenseText}</pre>
        <h3>Third-party notices</h3>
        <pre className="legal-pre">{thirdPartyText}</pre>
        <div className="modal-nav">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
