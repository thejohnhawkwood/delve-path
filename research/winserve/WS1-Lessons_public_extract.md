# WinSERVE User Guide for Drilling Setup (WS1-Lessons) — public extract

**Source:** https://www.scribd.com/document/164945878/WS1-Lessons  
**Retrieved:** 2026-08-13 (HTML extract); local PDF user-supplied the same day: `research/winserve/164945878-WS1-Lessons.pdf` (SHA-256 `bab4880d0f7a78543db95f5fac5d9a79565c35ad0813cd11bbb51776d37463e4`).  
**WSdoc:** now local — `research/winserve/164952996-WSdoc.pdf`. Notes: `WSDOC_NOTES.md`.  
**Copyright notice on Scribd:** Attribution Non-Commercial (BY-NC). **Internal-reference-only.** Do not redistribute.

The following is a working extract of publicly visible page text, lightly cleaned for line breaks. Use it as evidence for workflow/file-model reverse-specification. Algorithms for individual projection methods are **not** in this document; it defers to WSdoc.

---

Welcome to WinSERVE. The following procedures are intended to help the new user unfamiliar with the WinSERVE Directional Drilling and Survey program get started quickly with the basics, particularly as an accompaniment to the WinSERVE Training class. A more complete description of the program, including captured screenshot graphics, is available in PDF format in the file located in the WinSERVE\DOCS and WinSURV2\DOCUMENTATION directories as part of the initial installation. The HASP key must be attached to run the program.

As you follow the examples, use the TAB key (or mouse) to move between fields. Follow the examples in sequence.

## Starting a new well

When you open the WinSERVE program, if you have previously saved a file during your last work session, WinSERVE will load the last file saved. If the file is not found, you will be prompted to either OPEN or create a NEW file. To create a new file, select FILE>>NEW from the menu bar, and fill in the dialog box. The filename must follow the old DOS conventions; the name cannot have more than 8 characters. The .SVY extension is automatically added to the name you choose. By default, the file is saved to the WinSERVE folder; you may want to set up separate subfolders for individual companies. This one file may contain all survey data for up to 20 curves (such as offset well and gyro survey data, or alternate proposals), since Curves 21 to 29 are reserved placeholders for various types of projections. The numbered buttons in the center of the screen refer to these curves.

Example: Create a new file with the name MYTEST and verify the path C:\Winserve\MYTEST.SVY displayed at the upper left of the screen.

## Parameters / job info / curves

Click on PARMS at the lower right of the screen to choose feet or meters, method of calculation, and input and output preferences. Example: Setup for feet, minimum curvature, and decimal input/output.

Click INFO at the lower left to fill in job number and other information to be printed on survey report and plot headers. Note that declination and grid correction are for information only; surveys should be entered with the appropriate correction applied.

The upper left of the screen displays curve information. By convention, WORK # refers to the so-called work curve in which your as drilled surveys are entered. This is important because projections are made from the designated work curve. PLAN # refers to the currently designated well plan curve, or proposal. CURVE # indicates the currently selected curve for which survey data is displayed below. Click on one of the numbered buttons to select that curve. CURVE # 0 is the designated default work curve. For best practice and consistency it is recommended to follow this convention. The current well plan proposal is commonly stored in CURVE # 1. However, any available curve may be used to store alternate well plans or sidetrack proposals, and offset well data, for instance.

North and East Offsets would be entered for offset well data, or if the current well is referenced to a particular slot. South and West are entered as negative numbers. VS Direction is the direction in which you want to calculate vertical section, most likely that of the current well plan. Enter 60 deg AZ. RKB Elevation is the difference in elevation between the rig kelly bushing and the reference datum (typically MSL). With a positive value entered, SUBSEA DEPTH can be displayed and printed on the report.

## Tie-in and survey entry

Click on TIE-IN button at the lower right to open the form to enter the tie-in data for the currently selected curve, and a comment if you want one. This information may also be entered directly on the spreadsheet in the first line (highlighted black).

Example tie-in for work curve (#0): MD=1000 ft; INC=1.3; AZM=45.7; TVD=999; N/S=21.8; E/W=-15.9

Click on the ADD SURVEY button. The cursor highlights the MEASURED DEPTH of your last survey. If you are entering only one survey, you can TAB to INC and AZM, then DONE to exit. However, if you need to enter a lengthy list of surveys, using the ENTER key loops you back to MD. With a numeric keypad surveys can be entered very rapidly this way.

Example surveys: 1100; 2.3; 43 / 1200; 4.0; 40.2 / 1300; 5.8; 37.8 / 1400; 7.8; 35 / 1500; 10.0; 33.7

There is a special function for entering multiple rotational check-shot surveys at the same depth (cluster surveys). Details deferred to WSdoc.

Autosave: OPTIONS>>AUTOSAVE, every five minutes. Also SAVE button and FILE>>SAVE.

## Project to bit

LOCATION buttons SENSOR and BHL. If SENSOR is checked, the last survey entered in the work curve is displayed. If BHL is checked, enter BIT TO SENSOR and the projected survey at the bit, based on the trend of the last two surveys, is displayed automatically as each survey is entered, and arrow controls appear to allow adjustment. Other projections may be linked to this projected BHL station. Example: BIT TO SENSOR = 60 ft.

## Targets

Create targets in the spreadsheet at the bottom of the TARGET screen.

Example 1: Circular target, 100 ft diameter, TVD=5000 ft, polar direction 60 deg AZ, polar distance 1500 ft. Diameter is a diameter, not a radius. Geographic location may be entered as rectangular coordinates or by direction and distance; the program calculates the other (in this case 750 N and 1299.04 E).

For square targets enter the length of a side. For rectangular targets, the X length represents the side perpendicular to the wellpath direction. These targets may also be rotated from the axis of wellpath direction.

Example 2: Rectangular; X=100; Y=200; TVD=6000; NORTH=1000; EAST=2300. After the first target, INC and AZ from the first target are displayed in red columns.

SURFACE OFFSETS shift all targets. X and Y offsets shift the defining point off-center.

Target comments live in the comment column of the proposal curve.

## Projections

Projections are made from the designated work curve. Work-curve data is not altered. Curves 21–29 are reserved for storing projection data and are overwritten; copy to an unused 0–20 curve to save.

Graphical PROJECT (binoculars): centered on selected target; from last survey or projected BHL (red cross-hairs). Options include specified DLS, minimum curvature, straight line or specified Build & Walk to target TVD, and straight-line protractor. S-Well Vector Projector: a projection to one target leaves you lined up and pointed directly to the next target. COPY MODE CURVE 23 stores in 23 and 21. A Minimum Curvature projection can always be found in Curve 28. DLS projection (29) auto-updates as surveys are entered.

Example: 2 deg DLS projection to Target #1 → Curve 29. Then add MD=1600, INC=12, AZ=60 and Curve 29 updates.

CURVE 21 PROJECTIONS: form-style. Ouija Board Calculator. TIE-IN POINT is last work-curve survey or projected BHL. ADD commits to Curve 21 and moves the projected point to the new tie-in (sequential projections).

Ouija example (SOLVE MD): 30 ft ADDED MD; DLS=3; TFO=30. After DLS+TAB, TFO=0 preview appears, then updates at TFO=30.

Ouija example (SOLVE DLS): DLS=2, FINAL INC=20, FINAL AZM=45; ADD; then STRAIGHT LINE TO TVD, TOTAL TVD=4000.

Vector project to target: Target #1; DLS1=3, DLS2=2, POST HOLD=100; TARGET INC=0, TARGET AZ=0.

WSdoc is cited for discussion of the individual projection methods.

## Curve editor / reports / plots

EDIT>>CURVE EDITOR / CURVE MANAGER: copy, move, delete, append (sidetrack definitive lists).

REPORTS → SURVEY REPORT OPTIONS. AVAILABLE FIELDS → FIELDS IN REPORT. SAVE TEMPLATE. FROM DEPTH for partial list. ASCII TEXT export (NO = no column headings). No print preview.

PLOT: 8×11; COMPOSITE; PLOT TYPE TVD or HORZ. # TICKS, SPACING, SET ORIGINS (min VS / max TVD), GRID CONTROL, HEADER, LABELS (critical-point comments or survey labels), CURVES. Zoom; string & protractor. TRACKING: interpolated tracking point + crosshairs. LEAST DISTANCES with optional RADIUS gate.

## Least distance

Main-screen quicklook: Workcurve vs one comparison curve; least distance and direction from BHL plus comparison-curve TVD.

REPORTS >> LEAST DISTANCE: default TRUE MINIMUM DISTANCE (manual spelling “TRUE MIMIMUM DISTANCE”) and HIGH SIDE REFERENCE. TRAVELING CYLINDER check. INCREMENT + two rows + C key expands calculation between stations.

## Import / export

.SVY holds all curves. FILE>>EXPORT>>WinSERVE SURVEY → .SAY (single curve). FILE>>IMPORT>>WinSERVE SURVEY. FILE>>IMPORT>>OTHER TEXT (numeric columns only; optional READ TIE-IN FROM FILE).

## Advanced (aligned / interpolate / back-on-track / sidetrack)

S-Well Vector Projector: DLS1=2, DLS2=2, POST HOLD=200, DYNAMIC VECTORING, POINT TO TARGET 2. Graphic target via left-click.

TOOLS>>INTERPOLATE by TVD (example 4100 TVD, comment BIG SAND). Commented rows highlighted.

Tag a survey as a point target: highlight row, press T, pick empty target slot.

Sidetrack example: interpolate 5100 MD → MAKE TIE-IN POINT to Curve 21; Ouija 100 MD / 1 DLS / 80 TFO; DLS TO TARGET, solve DLS, Target #4, FINAL INCLINATION 85. Copy Curve 21 to Curve 2.

Target #4: Square, 100 ft side; 5500 TVD; Polar Direction 50; Polar Distance 3000.

---

**Not in this extract:** well-planning closed-form solvers, GEOMAPPER, mining/directional report switch, projection algorithms, .SVY binary layout.
