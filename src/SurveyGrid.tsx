import { Fragment, useEffect, useRef, type KeyboardEvent } from "react";
import type { CalculatedStation, MeasuredStation, UnitSystem } from "./domain";
import { dlsLabel, fmt, lengthLabel } from "./domain";
import { Tip } from "./Tip";

export interface SurveyHoleGroup {
  id: string;
  name: string;
  color: string;
  rows: MeasuredStation[];
  calc: CalculatedStation[];
}

interface Props {
  groups: SurveyHoleGroup[];
  activeHoleId: string | null;
  unit: UnitSystem;
  tipsOn: boolean;
  selected: number;
  onSelect: (holeId: string, i: number) => void;
  onChange: (i: number, patch: Partial<MeasuredStation>) => void;
  onEnterLast: (i: number) => void;
  onDelete: (i: number) => void;
}

const EDIT = ["md", "inc_deg", "azi_deg", "comment"] as const;
const COLS = 13;

export function SurveyGrid({
  groups,
  activeHoleId,
  unit,
  tipsOn,
  selected,
  onSelect,
  onChange,
  onEnterLast,
  onDelete,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const len = lengthLabel(unit);
  const activeLen = groups.find((g) => g.id === activeHoleId)?.rows.length ?? 0;

  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLInputElement>(
      `input[data-row="${selected}"][data-col="md"]`
    );
    el?.focus();
    el?.select();
  }, [activeLen]);

  useEffect(() => {
    wrap.current
      ?.querySelector<HTMLElement>(`tr[data-hole="${activeHoleId}"][data-station="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeHoleId, selected]);

  function onKey(e: KeyboardEvent<HTMLInputElement>, i: number, col: (typeof EDIT)[number]) {
    if (e.key === "Enter" && col === "azi_deg") {
      e.preventDefault();
      onEnterLast(i);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const next = EDIT[EDIT.indexOf(col) + 1];
      wrap.current
        ?.querySelector<HTMLInputElement>(`input[data-row="${i}"][data-col="${next}"]`)
        ?.focus();
    }
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      onDelete(i);
    }
  }

  return (
    <div className="grid-wrap" ref={wrap}>
      <table className="survey">
        <thead>
          <tr>
            <th className="bar" />
            <th>#</th>
            <th>
              <Tip id="md" on={tipsOn}>
                MD {len}
              </Tip>
            </th>
            <th>
              <Tip id="inc" on={tipsOn}>
                INC °
              </Tip>
            </th>
            <th>
              <Tip id="azi" on={tipsOn}>
                AZI °
              </Tip>
            </th>
            <th>
              <Tip id="tvd" on={tipsOn}>
                TVD {len}
              </Tip>
            </th>
            <th>
              <Tip id="north" on={tipsOn}>
                +N {len}
              </Tip>
            </th>
            <th>
              <Tip id="east" on={tipsOn}>
                +E {len}
              </Tip>
            </th>
            <th>
              <Tip id="vs" on={tipsOn}>
                VS {len}
              </Tip>
            </th>
            <th>
              <Tip id="closure" on={tipsOn}>
                CL {len}
              </Tip>
            </th>
            <th>
              <Tip id="closureAzi" on={tipsOn}>
                CL Azi
              </Tip>
            </th>
            <th>
              <Tip id="dls" on={tipsOn}>
                DLS {dlsLabel(unit)}
              </Tip>
            </th>
            <th className="c">
              <Tip id="comment" on={tipsOn}>
                Comment
              </Tip>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const active = g.id === activeHoleId;
            return (
              <Fragment key={g.id}>
              <tr className="hole-group">
                <td className="bar" style={{ background: g.color }} />
                <td colSpan={COLS - 1}>
                  <span className="hole-group-swatch" style={{ background: g.color }} />
                  {g.name}
                </td>
              </tr>
              {g.rows.map((r, i) => {
                const c = g.calc[i];
                const proj = r.class === "projected" || c?.class === "projected";
                const sel = active && selected === i;
                return (
                  <tr
                    key={`${g.id}-${i}`}
                    data-hole={g.id}
                    data-station={i}
                    className={`${sel ? "sel" : ""} ${proj ? "proj" : ""} ${active ? "" : "readonly"}`}
                    onClick={() => onSelect(g.id, i)}
                  >
                    <td className="bar" style={{ background: g.color }} />
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={String(i + 1)} />
                    </td>
                    <td>
                      {active ? (
                        <input
                          className="edit"
                          data-row={i}
                          data-col="md"
                          value={numStr(r.md)}
                          onChange={(e) => onChange(i, { md: parseNum(e.target.value) })}
                          onFocus={() => onSelect(g.id, i)}
                          onKeyDown={(e) => onKey(e, i, "md")}
                        />
                      ) : (
                        <input className="calc" readOnly tabIndex={-1} value={numStr(r.md)} />
                      )}
                    </td>
                    <td>
                      {active ? (
                        <input
                          className="edit"
                          data-row={i}
                          data-col="inc_deg"
                          value={numStr(r.inc_deg)}
                          onChange={(e) => onChange(i, { inc_deg: parseNum(e.target.value) })}
                          onFocus={() => onSelect(g.id, i)}
                          onKeyDown={(e) => onKey(e, i, "inc_deg")}
                        />
                      ) : (
                        <input className="calc" readOnly tabIndex={-1} value={numStr(r.inc_deg)} />
                      )}
                    </td>
                    <td>
                      {active ? (
                        <input
                          className="edit"
                          data-row={i}
                          data-col="azi_deg"
                          value={numStr(r.azi_deg)}
                          onChange={(e) => onChange(i, { azi_deg: parseNum(e.target.value) })}
                          onFocus={() => onSelect(g.id, i)}
                          onKeyDown={(e) => onKey(e, i, "azi_deg")}
                        />
                      ) : (
                        <input className="calc" readOnly tabIndex={-1} value={numStr(r.azi_deg)} />
                      )}
                    </td>
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={c ? fmt(c.tvd) : ""} />
                    </td>
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={c ? fmt(c.north) : ""} />
                    </td>
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={c ? fmt(c.east) : ""} />
                    </td>
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={c ? fmt(c.vs) : ""} />
                    </td>
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={c ? fmt(c.closure) : ""} />
                    </td>
                    <td>
                      <input
                        className="calc"
                        readOnly
                        tabIndex={-1}
                        value={c ? fmt(c.closure_azi_deg) : ""}
                      />
                    </td>
                    <td>
                      <input className="calc" readOnly tabIndex={-1} value={c ? fmt(c.dls) : ""} />
                    </td>
                    <td>
                      {active ? (
                        <input
                          className="edit c"
                          data-row={i}
                          data-col="comment"
                          value={r.comment}
                          onChange={(e) => onChange(i, { comment: e.target.value })}
                          onFocus={() => onSelect(g.id, i)}
                          onKeyDown={(e) => onKey(e, i, "comment")}
                        />
                      ) : (
                        <input className="calc c" readOnly tabIndex={-1} value={r.comment} />
                      )}
                    </td>
                  </tr>
                );
              })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function parseNum(s: string): number {
  const t = s.trim();
  if (t === "" || t === "-" || t === ".") return Number.NaN;
  return Number(t);
}

function numStr(n: number): string {
  return Number.isFinite(n) ? String(n) : "";
}
