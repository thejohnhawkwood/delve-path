# Calculation specification

**Method (MVP):** Minimum Curvature for **survey reconstruction** only.  
**Not:** a well-plan constructor (Innova ADJ_MD 180° limitation).  
**Not:** claimed bit-identical to WinSERVE.

## Sources

| ID | Use |
|---|---|
| ISCWSA ebook V09.10.17 Ch. 7 | Authoritative: min curvature is the industry standard; dogleg is the angle between station unit tangents (inverse cosine of the dot product); path is a constant-radius spherical arc (“kite”) between stations. |
| ISCWSA ebook Ch. 5/7 | Inclination measured up from vertical. Tangential ΔN = dM sin I cos A, ΔE = dM sin I sin A, ΔTVD = dM cos I. |
| Aklestad ISCWSA 43 | Historical method list; Mason & Taylor cited for min curvature. |
| Filed goldens | Regression oracles with **printed-precision** tolerance. |

ISCWSA Figure 45 is a graphic. The algebraic ratio-factor form below is the standard implementation of that geometry (same unit-vector dogleg + circular arc). If a golden disagrees beyond print precision, investigate conventions/rounding — do not average products.

## Station unit tangent

In the canonical frame (+N, +E, +TVD down):

```text
v = (sin I · cos A,  sin I · sin A,  cos I)
```

I, A in radians.

## Interval dogleg β

```text
cos β = clamp(v1 · v2, −1, +1)
β     = arccos(cos β)          # radians, 0…π
```

Clamp is only to absorb floating-point drift of the dot product outside `[-1, 1]`. It is tested. It is not a data correction.

## Ratio factor

Limit of the circular-arc chord/arc ratio as β → 0 is 1.

```text
if β < 1e-12:
    RF = 1
else:
    RF = (2 / β) · tan(β / 2)
```

`1e-12` rad ≈ 2e-10°. Documented and tested (`L1_near_zero_dogleg`).

## Position increment (course length CL = MD₂ − MD₁)

```text
ΔN   = (CL / 2) · (v1.N + v2.N) · RF
ΔE   = (CL / 2) · (v1.E + v2.E) · RF
ΔTVD = (CL / 2) · (v1.T + v2.T) · RF
```

Accumulate from the tie-in (first station’s MD, I, A, TVD, N, E are inputs; first DLS = 0).

## Vertical section

Industry-common, wellhead-referenced (matches WinSERVE goldens’ “Referenced to Wellhead”):

```text
VS = N · cos(θ) + E · sin(θ)
```

θ = VSP azimuth in the same north as the surveys. **Not printed as WinSERVE’s formula.** Validated against goldens. N/E/TVD must be independent of θ (`L1_vsp_independence`).

## Closure

```text
closure_dist = hypot(N, E)
closure_azi  = atan2(E, N)   # 0…2π, clockwise from north
```

## Dogleg severity

```text
DLS = β / CL                 # rad/m  (CL > 0)
```

Presentation:

- °/100 ft = DLS · (180/π) · 100 ft_in_metres
- °/30 m  = DLS · (180/π) · 30

These are not interchangeable relabels.

## Tie-in

First station may have non-zero TVD/N/E. Subsequent stations accumulate. First interval DLS uses the first two attitudes.

## Projection (MVP)

**Simple tangent continuation:** hold last I,A to a target MD (or to a TVD if |cos I| is large enough that TVD is reachable). Same min-curvature formulas with I₂=I₁, A₂=A₁ (RF=1). Labelled PROJECTED.

This matches WSdoc p. 54 **Straight Line to MD / Straight Line to TVD** (“extend the curve at the current inclination and azimuth”). It is **not** WinSERVE BHL, which WSdoc only names as a “trend of the last two surveys” with no algebra.

## Errors

NaN/Inf, CL ≤ 0, β outside [0, π] after clamp, unreachable TVD projection → hard errors. No silent sort of decreasing MD.

## Golden tolerances

Compare **unrounded** engine output to printed values.

| Source | Length | Angle / DLS |
|---|---|---|
| WinSERVE printed 2 dp ft / 2 dp °/100 ft | 0.02 ft (2× last place) then investigate if exceeded | 0.02 °/100 ft |
| Oregon last station (MD 2591, 743 ft after plug-back interpolated point) | 0.04 ft on N/VS only; stations 445–1848 stay on 0.02 | 0.02 °/100 ft |
| COMPASS plan 1 dp usft | 0.15 usft on TVD/E; 0.25 usft on N (see below) | n/a if DLS not printed |
| HawkEye excerpt 2 dp ft | 0.05 ft on N/E/TVD (excerpt; VSP not on page) | DLS not gated (method not printed) |

If exceeded: check convention, VSP, units, whether the station is a projection, OCR flags — then tighten understanding, not the formula.

### Investigation (2026-08-13)

Engine formula was **not** changed.

- **Oregon:** 25 stations through the plug-back interpolated point (MD 1848) match printed TVD/N/E/VS/DLS within 0.02 ft / 0.02 °/100 ft. The only overshoot is MD 2591 (ΔN 0.032 ft, ΔVS 0.026 ft) after a 743 ft interval from that interpolated point. Treated as a long post-interpolation comparison, not a min-curvature defect. NM 9461 (79 stations) stays inside 0.02 ft.
- **COMPASS PWPO plan:** hold at I=16.54° A=14.19° has geometric ΔN = 137.999 usft / 500 usft. The printed table adds 138.0 then 276.1 / 1000 usft (2×138.0 would be 276.0). Absolute N at MD 5000 therefore differs by 0.23 usft from unrounded min curvature. That is printed 1 dp increment rounding, not a different method.
