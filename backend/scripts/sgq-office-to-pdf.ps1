param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'
$ext = [IO.Path]::GetExtension($In).ToLowerInvariant()

function Convert-Excel {
  $excel = $null
  $wb = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.ScreenUpdating = $false
    $excel.DisplayAlerts = $false
    $excel.AskToUpdateLinks = $false
    $wb = $excel.Workbooks.Open($In, 0, $true)
    $wb.ExportAsFixedFormat(0, $Out)
    $wb.Close($false)
    $wb = $null
  } finally {
    if ($null -ne $wb) { try { $wb.Close($false) } catch {} }
    if ($null -ne $excel) { try { $excel.Quit() } catch {} }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

function Convert-Word {
  $word = $null
  $doc = $null
  try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($In, $false, $true)
    $doc.ExportAsFixedFormat($Out, 17)
    $doc.Close($false)
    $doc = $null
  } finally {
    if ($null -ne $doc) { try { $doc.Close($false) } catch {} }
    if ($null -ne $word) { try { $word.Quit() } catch {} }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

function Convert-PowerPoint {
  $ppt = $null
  $pres = $null
  try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $pres = $ppt.Presentations.Open($In, $true, $false, $false)
    $pres.SaveAs($Out, 32)
    $pres.Close()
    $pres = $null
  } finally {
    if ($null -ne $pres) { try { $pres.Close() } catch {} }
    if ($null -ne $ppt) { try { $ppt.Quit() } catch {} }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

if ($ext -in @('.xlsx', '.xls', '.csv')) {
  Convert-Excel
} elseif ($ext -in @('.docx', '.doc')) {
  Convert-Word
} elseif ($ext -in @('.pptx', '.ppt')) {
  Convert-PowerPoint
} else {
  throw "Formato não suportado: $ext"
}

if (-not (Test-Path -LiteralPath $Out)) {
  throw "Falha ao gerar PDF."
}
