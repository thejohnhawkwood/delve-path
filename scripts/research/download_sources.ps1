# Download public research sources. Never download executables/DLLs/installers.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $Root) { $Root = "C:\Users\Papa\Desktop\delve-path" }

function Get-SafeFile {
    param(
        [string]$Url,
        [string]$OutPath
    )
    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Write-Host "GET $Url"
    Write-Host " -> $OutPath"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $OutPath -UseBasicParsing -TimeoutSec 120
        if (Test-Path $OutPath) {
            $len = (Get-Item $OutPath).Length
            $hash = (Get-FileHash -Algorithm SHA256 -Path $OutPath).Hash
            Write-Host " OK bytes=$len sha256=$hash"
            return [pscustomobject]@{ url=$Url; path=$OutPath; bytes=$len; sha256=$hash; ok=$true; error="" }
        }
        return [pscustomobject]@{ url=$Url; path=$OutPath; bytes=0; sha256=""; ok=$false; error="missing file" }
    } catch {
        Write-Host " FAIL $($_.Exception.Message)"
        return [pscustomobject]@{ url=$Url; path=$OutPath; bytes=0; sha256=""; ok=$false; error=$_.Exception.Message }
    }
}

$jobs = @(
    @{ Url="https://www.oregon.gov/dogami/mlrr/logs/og/IW24C-23-65/boresurvey.pdf"; Out="research\golden\source-pdfs\oregon_IW24C-23-65_boresurvey.pdf" },
    @{ Url="https://ocdimage.emnrd.nm.gov/Imaging/FileStore/Aztec/WF/23372/3003929320_5_WF.pdf"; Out="research\golden\source-pdfs\nm_3003929320_5_WF.pdf" },
    @{ Url="https://ocdimage.emnrd.nm.gov/Imaging/FileStore/Aztec/WF/32063/3004532380_7_WF.pdf"; Out="research\golden\source-pdfs\nm_3004532380_7_WF.pdf" },
    @{ Url="https://ocdimage.emnrd.nm.gov/Imaging/FileStore/Aztec/WF/42528/3003929461_13_WF.pdf"; Out="research\golden\source-pdfs\nm_3003929461_13_WF.pdf" },
    @{ Url="https://ocdimage.emnrd.nm.gov/imaging/filestore/SantaFe/WF/20250812/30015559690000_08_12_2025_04_30_21.pdf"; Out="research\golden\source-pdfs\compass_30015559690000_20250812.pdf" },
    @{ Url="https://ocdimage.emnrd.nm.gov/imaging/filestore/SantaFe/WF/20251003/30039313630000_10_03_2025_08_47_01.pdf"; Out="research\golden\source-pdfs\compass_30039313630000_20251003.pdf" },
    @{ Url="https://ogcc.idaho.gov/wp-content/uploads/1107520032_Fallon1-10_DIR_20180218_PTS.pdf"; Out="research\golden\source-pdfs\hawkeye_idaho_Fallon1-10_DIR_20180218.pdf" },
    @{ Url="https://www.iscwsa.net/media/files/page/f1c1e97e/introduction-to-wellbore-positioning-ebook-v9-10-2017.pdf"; Out="research\standards\iscwsa_introduction-to-wellbore-positioning-ebook-v9-10-2017.pdf" },
    @{ Url="https://www.iscwsa.net/media/files/files/f40a3625/07-iscwsa43-spe-wpts-daklestad-boreholecalculationmethods-4mar16.pdf"; Out="research\standards\iscwsa43_daklestad_boreholecalculationmethods.pdf" },
    @{ Url="https://www.iscwsa.net/media/files/committee/ce60f271/well-intercept-sub-committee-ebook-version-3-2021-.pdf"; Out="research\standards\iscwsa_well-intercept-ebook-v3-2021.pdf" },
    @{ Url="https://www.aer.ca/documents/onestop/directional-survey-file-format.csv"; Out="research\regulatory\alberta-oil-gas\aer_directional-survey-file-format.csv" },
    @{ Url="https://www.aer.ca/documents/onestop/directional-survey-file-format.xlsx"; Out="research\regulatory\alberta-oil-gas\aer_directional-survey-file-format.xlsx" },
    @{ Url="https://www.aer.ca/documents/onestop/directional-survey-template-validation-rules.xlsx"; Out="research\regulatory\alberta-oil-gas\aer_directional-survey-template-validation-rules.xlsx" },
    @{ Url="https://www.aer.ca/documents/onestop/QRG-submitting-directional-survey-data.pdf"; Out="research\regulatory\alberta-oil-gas\aer_QRG-submitting-directional-survey-data.pdf" }
)

$results = @()
foreach ($j in $jobs) {
    $out = Join-Path $Root $j.Out
    $results += Get-SafeFile -Url $j.Url -OutPath $out
}

$manifest = Join-Path $Root "research\architecture\download_results.json"
$results | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $manifest
Write-Host "Wrote $manifest"
