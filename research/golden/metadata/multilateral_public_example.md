# Public multilateral / multi-bore examples

Status language: **WORKING** search notes. Station tables below are either **NOT YET VALIDATED** (short public excerpt) or **not transcribed** (named well, no invented numbers).

Industry context (not DelvePath math): TAML junction levels describe hardware at the window, not survey reconstruction. Permian and Bakken development often uses stacked or opposing laterals; many of those are separate wellheads on a pad rather than one TAML junction. Regulators commonly file **each leg as a separate survey from the tie-in / kick-off** — the same split API RP 78 DSR uses for a sidetrack from a **parent wellbore**.

This increment does **not** implement TAML hardware, anti-collision, or a well-plan solver.

---

## Best named dual-lateral (no station table invented)

**Slawson Gobbler Federal 4-26-35MLH**, North Dakota, NDIC File No. **32276**, Big Bend field.

- Operator: Slawson Exploration (public well-file commentary).
- Geometry described from the well file in a public write-up: two laterals from one well (first-bench and second-bench Three Forks). Lateral 2 reported as beginning at **10,659 ft MD**. Lateral 1 TD ~20,708 ft MD / 10,196.20 ft TVD; lateral 2 TD ~20,900 ft MD / 10,241.89 ft TVD.
- Source (secondary): [The Million Dollar Way — Slawson's Dual Laterals](https://themilliondollarway.blogspot.com/2019/10/slawsons-dual-laterals.html) citing the NDIC well file.
- Official file: ND DMR Oil & Gas well file **32276** (scout ticket / well file; interactive pages returned 401 without a DMR session). Search: [https://www.dmr.nd.gov/oilgas/](https://www.dmr.nd.gov/oilgas/).
- **No as-drilled station table is transcribed here.** Do not invent MD/INC/AZI for this well.

Related named dual-laterals (same caveat — names only):

| Well | NDIC file | Notes |
|---|---|---|
| Slawson Howo 2-4-33MLH | 30074 | Dual-lateral, Big Bend |
| White Butte / Slawson Panzer 2-20MLH | 21385 area | Stacked Three Forks + middle Bakken; second curve after milling a window in the vertical |
| CLR Jensen 1-5H | 16316 | Dual lateral, Chimney Butte |
| CLR Candee 11-9H | 16509 | Dual lateral, Chimney Butte |

ND DMR filing rule (matches DSR / this app’s hole split):

> All original laterals and any sidetracks be kept separately, labeled as to what they depict (e.g.: leg 1, or leg-sidetrack 1, etc.), and filed in their entirety from the tie-in point … When additional laterals and/or sidetracks are surveyed, the tie-in point should be listed as the first survey. Do not include any surveys prior to the tie-in … The survey point used for the tie-in should be the last survey run immediately above the sidetrack depth.

Source: [ND DMR directional-survey FAQ](https://www.dmr.nd.gov/oilgas/webhelpfaq.asp).

---

## Public sidetrack survey excerpt (pilot + Wellbore #2 — not a dual-lateral)

**Mack Energy Klondike State Com #1H**, API **30-005-64295**, Chaves County, NM.

- COMPASS 5000.1 Minimum Curvature report, Integrity Directional Services, 23 Sep 2017.
- PDF: [https://ocdimage.emnrd.nm.gov/imaging/filestore/Artesia/WF/311794/30005642950000_11_WF.pdf](https://ocdimage.emnrd.nm.gov/imaging/filestore/Artesia/WF/311794/30005642950000_11_WF.pdf)
- Survey program: Pilot Hole 181–2,146 ft; Wellbore #2 from 2,239 ft (tie-on at 2,146 ft) to PTB 8,940 ft.
- Short excerpt: `research/golden/fixtures/nm_3000564295_klondike_1h_sidetrack_excerpt.csv`
- Status: **NOT YET VALIDATED** vs delve-core. This is a **sidetrack from a pilot**, not two laterals from one vertical junction.

---

## Repo wells already on disk (single bore)

COMPASS Water Buffalo 131H (30-015-55969), NM WinSERVE laterals, Oregon 24c-23-65, HawkEye Fallon 1-10 — each is one wellbore. None is a dual-lateral golden.
