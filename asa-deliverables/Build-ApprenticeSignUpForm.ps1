<#
.SYNOPSIS
    Lays out the staff (model-driven) main form and the main views for the
    Apprentice Sign Up table, so they don't have to be built by hand.

.DESCRIPTION
    Run this AFTER Create-ApprenticeSignUpTable.ps1. It:
      1. finds the table's Main form (normally called "Information")
      2. saves a backup of the current form layout to a file
      3. replaces the form's tabs with 4 tabs / 13 sections containing every column:
           Applicant              - Sign-Up, USI, Your Details, Contact Details,
                                    Home Address, Postal Address
           Background & Schooling - Background, Schooling
           Employment             - Apprenticeship, Workplace, Prior Employment
           Study & Guardian       - Prior Study, Parent / Guardian
         (the form header, footer and any scripts are left untouched)
      4. sets the columns of the "Active Apprentice Sign Ups" view
      5. sets the Quick Find (search box) view to search tracking code, names,
         email, mobile and employer
      6. makes sure the form and views are in your solution, and publishes

    WARNING: step 3 REPLACES any tabs/sections you have already laid out by hand on
    the main form. The backup file lets you restore them (see -RestoreFrom).

    Modes:
      -PlanOnly   No connection. Writes the new form layout to a file and prints a summary.
      -WhatIf     Connects, backs up the current form, writes the proposed layout to a
                  file, but changes nothing.
      (neither)   Applies the changes and publishes.

.EXAMPLE
    .\Build-ApprenticeSignUpForm.ps1 -Prefix bnsw -PlanOnly

.EXAMPLE
    .\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ASATestAIApp -Prefix bnsw -WhatIf

.EXAMPLE
    .\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ASATestAIApp -Prefix bnsw

.EXAMPLE
    # Put back the form exactly as it was before the script changed it
    .\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ASATestAIApp -Prefix bnsw -RestoreFrom .\form-backup-20261008-101500.xml

.NOTES
    Same requirements and sign-in as Create-ApprenticeSignUpTable.ps1.
    Run it in DEV. Production gets the form through the solution export/import.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $EnvironmentUrl,
    [string] $SolutionUniqueName,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{1,7}$')]
    [string] $Prefix,
    [string] $CsvPath = (Join-Path $PSScriptRoot 'dataverse-table-schema.csv'),
    [string] $TenantId,
    [string] $AccessToken,
    [switch] $Relogin,
    [int]    $LanguageCode = 1033,
    [string] $RestoreFrom,
    # Lay out a copy of the table made with Create-ApprenticeSignUpTable.ps1 -TableName
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{2,40}$')]
    [string] $TableName = 'ApprenticeSignUp',
    [switch] $PlanOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Prefix       = $Prefix.ToLowerInvariant()
$TableLogical = "${Prefix}_$($TableName.ToLowerInvariant())"
$Stamp        = Get-Date -Format 'yyyyMMdd-HHmmss'

# ---------------------------------------------------------------------------
# Layout definition. Column names without prefix ("ownerid" is the system Owner column).
# Two-column sections fill left-to-right, row by row.
# ---------------------------------------------------------------------------
$Layout = @(
    @{ Tab = 'Applicant'; Sections = @(
        @{ Name = 'Sign-Up';         Cols = 2; Fields = @('trackingcode', 'stage', 'staffdraft', 'ownerid') }
        @{ Name = 'Pre-fill';        Cols = 1; Fields = @('prefilled', 'prefillchanges') }
        @{ Name = 'USI';             Cols = 2; Fields = @('hasusi', 'usinumber', 'usipermission') }
        @{ Name = 'Your Details';    Cols = 2; Fields = @('firstname', 'middlename', 'lastname', 'previousname', 'dateofbirth') }
        @{ Name = 'Contact Details'; Cols = 2; Fields = @('mobile', 'email') }
        @{ Name = 'Home Address';    Cols = 2; Fields = @('homestreet', 'homesuburb', 'homepostcode', 'homestate') }
        @{ Name = 'Postal Address';  Cols = 2; Fields = @('postalsame', 'postaladdress', 'postalsuburb', 'postalpostcode') }
    )}
    @{ Tab = 'Background & Schooling'; Sections = @(
        @{ Name = 'Background'; Cols = 2; Fields = @('gender', 'citizenship', 'visadetails', 'countryofbirth', 'languageathome', 'indigenousstatus', 'disability') }
        @{ Name = 'Schooling';  Cols = 2; Fields = @('stillatschool', 'schoollevel', 'highestschooling', 'monthcompletedschool', 'yearcompletedschool') }
    )}
    @{ Tab = 'Employment'; Sections = @(
        @{ Name = 'Apprenticeship';   Cols = 2; Fields = @('employer', 'apprenticeshipstartdate', 'jobtitle', 'qualification', 'commencedbefore') }
        @{ Name = 'Workplace';        Cols = 2; Fields = @('workplacename', 'workplaceaddress') }
        @{ Name = 'Prior Employment'; Cols = 2; Fields = @('previouslyworkedwithbusiness', 'priorworkstarted', 'priorworkended', 'priorworkemploymenttype', 'priorworkhoursperweek') }
    )}
    @{ Tab = 'Study & Guardian'; Sections = @(
        @{ Name = 'Prior Study';       Cols = 2; Fields = @('completedqualification', 'qualificationdetails', 'qualificationstudystarted', 'qualificationstudyfinished', 'currentlystudying', 'currentstudyname', 'currentstudystartdate') }
        @{ Name = 'Parent / Guardian'; Cols = 2; Fields = @('under18', 'guardianfirstname', 'guardianlastname', 'guardianaddress', 'guardiansuburb', 'guardianstate', 'guardianpostcode', 'guardianmobile', 'guardianemail') }
    )}
)

# Main "Active" view columns (name, width) and Quick Find search columns
$ViewColumns     = @(@('trackingcode', 130), @('firstname', 120), @('lastname', 120), @('employer', 180),
                     @('apprenticeshipstartdate', 120), @('email', 180), @('createdon', 130))
$QuickFindFields = @('trackingcode', 'firstname', 'lastname', 'email', 'mobile', 'employer')

# ---------------------------------------------------------------------------
# Read CSV for display names and types (by position, like the table script)
# ---------------------------------------------------------------------------
if (-not (Test-Path $CsvPath)) { throw "CSV not found: $CsvPath" }
$csv = @{}
foreach ($r in (Import-Csv -Path $CsvPath -Encoding UTF8)) {
    $v = @($r.PSObject.Properties.Value)
    $short = ($v[2].Trim() -replace '^asa_', '').ToLowerInvariant()
    $csv[$short] = [pscustomobject]@{ DisplayName = $v[1].Trim(); Type = $v[3].Trim() }
}
$csv['ownerid'] = [pscustomobject]@{ DisplayName = 'Owner'; Type = 'Owner' }
# Added by Enable-StaffDrafts.ps1 (not in the CSV). Left off the form if they don't exist yet.
$OptionalFields = @{ stage = @('Choice', 'Stage'); staffdraft = @('Lookup', 'Staff Draft') }
foreach ($k in $OptionalFields.Keys) { $csv[$k] = [pscustomobject]@{ DisplayName = $OptionalFields[$k][1]; Type = $OptionalFields[$k][0] } }

# Every CSV column must be placed exactly once
$placed = @($Layout | ForEach-Object { $_.Sections } | ForEach-Object { $_.Fields })
$dupes  = @($placed | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
# Columns deliberately left off the form:
#   contact - Applicant (Contact) lookup, only used by the old sign-in design (LINK_CONTACT = false).
#             The applicant's details are in Your Details / Contact Details instead.
$NotOnForm = @('contact')
# Set by the website or the flows - shown read-only so staff don't change them by accident
$ReadOnlyFields = @('staffdraft', 'prefilled', 'prefillchanges')
$missing = @($csv.Keys | Where-Object { $placed -notcontains $_ -and $NotOnForm -notcontains $_ })
$unknown = @($placed | Where-Object { -not $csv.ContainsKey($_) })
if ($dupes -or $missing -or $unknown) {
    throw "Layout/CSV mismatch. Duplicates: $($dupes -join ', ')  Not placed: $($missing -join ', ')  Not in CSV: $($unknown -join ', ')"
}

function Get-Logical([string] $short) { if ($short -eq 'ownerid') { 'ownerid' } else { "${Prefix}_$short" } }

function Get-ClassId([string] $type) {
    switch -Regex ($type) {
        '^Single Line of Text' { '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}'; break }
        '^Email$'              { '{ADA2203E-B4CD-49be-9DDF-234642B43B52}'; break }
        '^Phone$'              { '{8C10015A-B339-4982-9474-A95FE05631A5}'; break }
        '^Multiple Lines'      { '{E0DECE4B-6FC8-4a8f-A065-082708572369}'; break }
        '^Two Options'         { '{67FAC785-CD58-4f9f-ABB3-4B7DDC6ED5ED}'; break }
        '^Choice$'             { '{3EF39988-22BB-4f0b-BBBE-64B5A3748AEE}'; break }
        '^Date Only$'          { '{5B773807-9FB2-42db-97C3-7A91EFF8ADFF}'; break }
        '^Whole Number$'       { '{C6D124CA-7EDA-4a60-AEA9-7FB8D318B68F}'; break }
        '^(Lookup|Owner)'      { '{270BD3DB-D9AF-4782-9025-509E298DEC0A}'; break }
        default { throw "No form control type for '$type'" }
    }
}

function New-Id { '{' + [guid]::NewGuid().ToString() + '}' }
function Esc([string] $s) { [System.Security.SecurityElement]::Escape($s) }
function Label([string] $text) { "<labels><label description=`"$(Esc $text)`" languagecode=`"$LanguageCode`" /></labels>" }

function New-TabsXml {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<tabs>')
    $t = 0; $s = 0
    foreach ($tab in $Layout) {
        $t++
        [void]$sb.Append("<tab name=`"tab_$t`" id=`"$(New-Id)`" IsUserDefined=`"0`" locklevel=`"0`" showlabel=`"true`" expanded=`"true`" verticallayout=`"true`">")
        [void]$sb.Append((Label $tab.Tab))
        [void]$sb.Append('<columns><column width="100%"><sections>')
        foreach ($sec in $tab.Sections) {
            $s++
            $colsAttr = '1' * $sec.Cols
            [void]$sb.Append("<section name=`"section_$s`" id=`"$(New-Id)`" IsUserDefined=`"0`" locklevel=`"0`" showlabel=`"true`" showbar=`"false`" columns=`"$colsAttr`" labelwidth=`"115`" celllabelalignment=`"Left`" celllabelposition=`"Left`">")
            [void]$sb.Append((Label $sec.Name))
            [void]$sb.Append('<rows>')
            for ($i = 0; $i -lt $sec.Fields.Count; $i += $sec.Cols) {
                [void]$sb.Append('<row>')
                for ($c = 0; $c -lt $sec.Cols; $c++) {
                    $idx = $i + $c
                    if ($idx -lt $sec.Fields.Count) {
                        $short = $sec.Fields[$idx]
                        $logical = Get-Logical $short
                        $info = $csv[$short]
                        [void]$sb.Append("<cell id=`"$(New-Id)`" showlabel=`"true`" locklevel=`"0`">")
                        [void]$sb.Append((Label $info.DisplayName))
                        $disabled = if ($ReadOnlyFields -contains $short) { 'true' } else { 'false' }
                        [void]$sb.Append("<control id=`"$logical`" classid=`"$(Get-ClassId $info.Type)`" datafieldname=`"$logical`" disabled=`"$disabled`" />")
                        [void]$sb.Append('</cell>')
                    } else {
                        [void]$sb.Append("<cell id=`"$(New-Id)`" showlabel=`"false`" locklevel=`"0`">$(Label '')</cell>")
                    }
                }
                [void]$sb.Append('</row>')
            }
            [void]$sb.Append('</rows></section>')
        }
        [void]$sb.Append('</sections></column></columns></tab>')
    }
    [void]$sb.Append('</tabs>')
    $sb.ToString()
}

function Merge-FormXml([string] $existingXml, [string] $tabsXml) {
    [xml]$doc = $existingXml
    if (-not $doc.DocumentElement -or $doc.DocumentElement.LocalName -ne 'form') { throw "Existing form XML has no <form> root." }
    [xml]$newTabs = $tabsXml
    $imported = $doc.ImportNode($newTabs.DocumentElement, $true)
    $old = $doc.DocumentElement.SelectSingleNode('tabs')
    if ($old) { [void]$doc.DocumentElement.ReplaceChild($imported, $old) }
    else      { [void]$doc.DocumentElement.PrependChild($imported) }
    $doc.OuterXml
}

function Save-Text([string] $path, [string] $text) {
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

$tabsXml = New-TabsXml

# ---------------------------------------------------------------------------
# Plan-only
# ---------------------------------------------------------------------------
if ($PlanOnly) {
    Write-Host "PLAN ONLY - nothing will be changed.`n" -ForegroundColor Cyan
    foreach ($tab in $Layout) {
        Write-Host "Tab: $($tab.Tab)" -ForegroundColor Cyan
        foreach ($sec in $tab.Sections) {
            $names = $sec.Fields | ForEach-Object { $csv[$_].DisplayName }
            Write-Host ("  {0} ({1}-col): {2}" -f $sec.Name, $sec.Cols, ($names -join ', '))
        }
    }
    $out = Join-Path $PSScriptRoot "form-layout-plan-$Stamp.xml"
    Save-Text $out (Merge-FormXml '<form />' $tabsXml)
    Write-Host "`n$($placed.Count) fields placed (all CSV columns + Owner). Layout XML written to $out"
    Write-Host "Active view columns: $(($ViewColumns | ForEach-Object { $_[0] }) -join ', ')"
    Write-Host "Quick Find searches: $($QuickFindFields -join ', ')"
    return
}

if (-not $EnvironmentUrl -or -not $SolutionUniqueName) {
    throw "-EnvironmentUrl and -SolutionUniqueName are required (or use -PlanOnly)."
}
$EnvironmentUrl = $EnvironmentUrl.TrimEnd('/')
$Api = "$EnvironmentUrl/api/data/v9.2"

# ---------------------------------------------------------------------------
# Authentication (same as the table script)
# ---------------------------------------------------------------------------
if (-not $AccessToken) {
    if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
        throw "Az.Accounts module not found. Run:  Install-Module Az.Accounts -Scope CurrentUser   (or pass -AccessToken)."
    }
    Import-Module Az.Accounts -ErrorAction Stop

    # Sign-in commands must really run even when the script runs with -WhatIf,
    # so pass -WhatIf:$false to every command that supports it.
    function Get-NoWhatIf([string] $name, [hashtable] $a) {
        if ((Get-Command $name).Parameters.ContainsKey('WhatIf')) { $a.WhatIf = $false }
        $a
    }
    function Connect-AzLogin {
        Write-Host "Signing in$(if ($TenantId) { " to $TenantId" })..." -ForegroundColor Cyan
        $connectArgs = Get-NoWhatIf 'Connect-AzAccount' @{ ErrorAction = 'Stop' }
        if ($TenantId) { $connectArgs.TenantId = $TenantId }
        Connect-AzAccount @connectArgs | Out-Null
    }
    function Clear-AzLogin {
        $d = Get-NoWhatIf 'Disconnect-AzAccount' @{ ErrorAction = 'SilentlyContinue' }
        Disconnect-AzAccount @d | Out-Null
        $c = Get-NoWhatIf 'Clear-AzContext' @{ Force = $true; ErrorAction = 'SilentlyContinue' }
        Clear-AzContext @c | Out-Null
    }

    if ($Relogin) {
        Write-Host "Clearing the previous sign-in (-Relogin)..." -ForegroundColor Cyan
        Clear-AzLogin
    }
    if (-not (Get-AzContext -ErrorAction SilentlyContinue)) { Connect-AzLogin }

    $tok = $null
    try {
        $tok = Get-AzAccessToken -ResourceUrl $EnvironmentUrl -ErrorAction Stop
    } catch {
        Write-Warning "The saved sign-in didn't work ($($_.Exception.Message)). Signing in again..."
        Clear-AzLogin
        Connect-AzLogin
        try {
            $tok = Get-AzAccessToken -ResourceUrl $EnvironmentUrl -ErrorAction Stop
        } catch {
            throw "Could not get a token for $EnvironmentUrl after signing in again: $($_.Exception.Message)`nCheck you signed in with your work account, try adding -TenantId businessnsw.com, and check your account has a security role in this environment. Or pass -AccessToken."
        }
    }
    if ($tok.Token -is [System.Security.SecureString]) {
        $AccessToken = [System.Net.NetworkCredential]::new('', $tok.Token).Password
    } else {
        $AccessToken = $tok.Token
    }
}

function Invoke-Dv {
    param([string] $Method, [string] $Path, $Body)
    $headers = @{
        Authorization      = "Bearer $AccessToken"
        Accept             = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        'MSCRM.SolutionUniqueName' = $SolutionUniqueName
    }
    $req = @{ Method = $Method; Uri = "$Api/$Path"; Headers = $headers }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 30 -Compress
        $req.Body        = [System.Text.Encoding]::UTF8.GetBytes($json)
        $req.ContentType = 'application/json; charset=utf-8'
    }
    for ($attempt = 1; ; $attempt++) {
        try {
            return Invoke-RestMethod @req
        } catch {
            $status = 0
            $respProp = $_.Exception.PSObject.Properties['Response']
            if ($respProp -and $respProp.Value) { $status = [int]$respProp.Value.StatusCode }
            $detail = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { $null }
            if (-not $detail) { $detail = $_.Exception.Message }
            $retryable = $status -eq 429 -or $status -ge 500 -or $detail -match 'another.*(customization|publish).*running|0x80071151'
            if ($retryable -and $attempt -lt 6) {
                $wait = [math]::Min(60, [math]::Pow(2, $attempt) * 2)
                Write-Warning "  $Method $Path returned $status - retrying in $wait s ($attempt/5)"
                Start-Sleep -Seconds $wait
                continue
            }
            throw "Dataverse $Method $Path failed ($status): $detail"
        }
    }
}

# ---------------------------------------------------------------------------
# 1. Check the table and that every column exists
# ---------------------------------------------------------------------------
Write-Host "Checking table $TableLogical..." -ForegroundColor Cyan
$entityPath = "EntityDefinitions(LogicalName='$TableLogical')"
try {
    $entity = Invoke-Dv GET "$entityPath`?`$select=LogicalName,ObjectTypeCode,PrimaryIdAttribute"
} catch {
    throw "Table $TableLogical not found - run Create-ApprenticeSignUpTable.ps1 first, and check -Prefix. ($($_.Exception.Message))"
}
$attrs = Invoke-Dv GET "$entityPath/Attributes?`$select=LogicalName"
$have = @{}; foreach ($a in $attrs.value) { $have[$a.LogicalName] = $true }
$skipOpt = @($OptionalFields.Keys | Where-Object { -not $have.ContainsKey((Get-Logical $_)) })
if ($skipOpt) {
    foreach ($tab in $Layout) { foreach ($sec in $tab.Sections) { $sec.Fields = @($sec.Fields | Where-Object { $skipOpt -notcontains $_ }) } }
    $placed = @($placed | Where-Object { $skipOpt -notcontains $_ })
    Write-Host "  (not on the table yet, left off the form: $($skipOpt -join ', ') - run Enable-StaffDrafts.ps1 to add them)" -ForegroundColor DarkGray
}
if ($have.ContainsKey((Get-Logical 'stage'))) {
    # Put Stage second in the Active view. Build the list explicitly: @($ViewColumns[0]) would
    # flatten the ('trackingcode', 130) pair into two items.
    $vc = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $ViewColumns.Count; $i++) {
        [void]$vc.Add($ViewColumns[$i])
        if ($i -eq 0) { [void]$vc.Add(@('stage', 110)) }
    }
    $ViewColumns = $vc.ToArray()
}
$absent = @($placed | ForEach-Object { Get-Logical $_ } | Where-Object { -not $have.ContainsKey($_) })
if ($absent) { throw "These columns don't exist on the table yet: $($absent -join ', '). Re-run Create-ApprenticeSignUpTable.ps1." }
Write-Host "  OK - all $($placed.Count) columns exist"

# ---------------------------------------------------------------------------
# 2. Main form: back up, build, apply
# ---------------------------------------------------------------------------
$forms = Invoke-Dv GET "systemforms?`$select=formid,name,formxml,isdefault&`$filter=objecttypecode eq '$TableLogical' and type eq 2"
if (-not $forms.value -or $forms.value.Count -eq 0) { throw "No Main form found for $TableLogical." }
$form = @($forms.value | Where-Object { $_.isdefault }) + @($forms.value | Where-Object { $_.name -eq 'Information' }) + @($forms.value) | Select-Object -First 1
Write-Host "Main form: '$($form.name)' ($($form.formid))"

$backup = Join-Path $PSScriptRoot "form-backup-$Stamp.xml"
Save-Text $backup $form.formxml
Write-Host "  Backed up current layout to $backup"

if ($RestoreFrom) {
    if (-not (Test-Path $RestoreFrom)) { throw "Restore file not found: $RestoreFrom" }
    $newXml = [System.IO.File]::ReadAllText((Resolve-Path $RestoreFrom), [System.Text.Encoding]::UTF8)
    [xml]$null = $newXml   # validate
    $action = "Restore layout from $RestoreFrom"
} else {
    $newXml = Merge-FormXml $form.formxml $tabsXml
    $action = 'Replace tabs with the 4-tab / 13-section layout'
}
$proposed = Join-Path $PSScriptRoot "form-proposed-$Stamp.xml"
Save-Text $proposed $newXml

$changed = $false
if ($PSCmdlet.ShouldProcess("form '$($form.name)'", $action)) {
    Invoke-Dv PATCH "systemforms($($form.formid))" @{ formxml = $newXml } | Out-Null
    Write-Host "  Form updated" -ForegroundColor Green
    $changed = $true
} else {
    Write-Host "  Proposed layout written to $proposed" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 3. Views (skipped when restoring)
# ---------------------------------------------------------------------------
$viewIds = @()
$viewProblems = @()

# Adds columns (and Quick Find search conditions) to a view's EXISTING definition,
# keeping everything Dataverse put there (filters, sort order, attributes).
function Update-View($view, [string[]] $columns, [hashtable] $widths, [string[]] $searchCols) {
    $full = Invoke-Dv GET "savedqueries($($view.savedqueryid))?`$select=fetchxml,layoutxml"
    [xml]$fx = $full.fetchxml
    [xml]$lx = $full.layoutxml
    $ent = $fx.SelectSingleNode('/fetch/entity')
    $row = $lx.SelectSingleNode('/grid/row')
    if (-not $ent -or -not $row) { throw "unexpected view definition" }

    # cells: wanted columns first (in order), then any other existing cells
    $existingCells = @($row.SelectNodes('cell'))
    foreach ($c in $existingCells) { [void]$row.RemoveChild($c) }
    foreach ($col in $columns) {
        $cell = @($existingCells | Where-Object { $_.GetAttribute('name') -eq $col }) | Select-Object -First 1
        if (-not $cell) {
            $cell = $lx.CreateElement('cell')
            $cell.SetAttribute('name', $col)
            $cell.SetAttribute('width', [string]$widths[$col])
        }
        [void]$row.AppendChild($cell)
    }
    foreach ($c in $existingCells) { if ($columns -notcontains $c.GetAttribute('name')) { [void]$row.AppendChild($c) } }

    # fetch attributes for every cell
    $haveAttrs = @($ent.SelectNodes('attribute') | ForEach-Object { $_.GetAttribute('name') })
    $firstNonAttr = @($ent.ChildNodes | Where-Object { $_.LocalName -ne 'attribute' }) | Select-Object -First 1
    foreach ($col in $columns) {
        if ($haveAttrs -notcontains $col) {
            $a = $fx.CreateElement('attribute'); $a.SetAttribute('name', $col)
            if ($firstNonAttr) { [void]$ent.InsertBefore($a, $firstNonAttr) } else { [void]$ent.AppendChild($a) }
        }
    }

    # Quick Find: add search conditions to the existing quick-find filter
    if ($searchCols) {
        $qff = $ent.SelectSingleNode("filter[@isquickfindfields='1']")
        if (-not $qff) {
            $qff = $fx.CreateElement('filter'); $qff.SetAttribute('type', 'or'); $qff.SetAttribute('isquickfindfields', '1')
            [void]$ent.AppendChild($qff)
        }
        $haveConds = @($qff.SelectNodes('condition') | ForEach-Object { $_.GetAttribute('attribute') })
        foreach ($col in $searchCols) {
            if ($haveConds -notcontains $col) {
                $cond = $fx.CreateElement('condition')
                $cond.SetAttribute('attribute', $col); $cond.SetAttribute('operator', 'like'); $cond.SetAttribute('value', '{0}')
                [void]$qff.AppendChild($cond)
            }
        }
    }

    Invoke-Dv PATCH "savedqueries($($view.savedqueryid))" @{ layoutxml = $lx.OuterXml; fetchxml = $fx.OuterXml } | Out-Null
}

if (-not $RestoreFrom) {
    $views = Invoke-Dv GET "savedqueries?`$select=savedqueryid,name,querytype,isdefault&`$filter=returnedtypecode eq '$TableLogical' and (querytype eq 0 or querytype eq 4)"
    $colName = { param($short) if ($short -eq 'createdon') { 'createdon' } else { Get-Logical $short } }
    $widths = @{}; foreach ($vc in $ViewColumns) { $widths[(& $colName $vc[0])] = $vc[1] }

    $active = @($views.value | Where-Object { $_.querytype -eq 0 -and $_.name -like 'Active*' }) + @($views.value | Where-Object { $_.querytype -eq 0 -and $_.isdefault }) | Select-Object -First 1
    if ($active) {
        $cols = @($ViewColumns | ForEach-Object { & $colName $_[0] })
        if ($PSCmdlet.ShouldProcess("view '$($active.name)'", 'Add columns')) {
            try {
                Update-View $active $cols $widths $null
                Write-Host "  View '$($active.name)' updated" -ForegroundColor Green
                $changed = $true
            } catch {
                Write-Warning "View '$($active.name)' could not be updated - the form is unaffected. $($_.Exception.Message)"
                $viewProblems += "'$($active.name)': add columns $(($ViewColumns | ForEach-Object { if ($csv.ContainsKey($_[0])) { $csv[$_[0]].DisplayName } else { 'Created On' } }) -join ', ')"
            }
        }
        $viewIds += $active.savedqueryid
    } else { Write-Warning "No 'Active' public view found - skipped." }

    $qf = @($views.value | Where-Object { $_.querytype -eq 4 }) | Select-Object -First 1
    if ($qf) {
        $cols = @($ViewColumns | Select-Object -First 4 | ForEach-Object { & $colName $_[0] })
        $search = @($QuickFindFields | ForEach-Object { Get-Logical $_ })
        if ($PSCmdlet.ShouldProcess("view '$($qf.name)'", 'Add Quick Find search columns')) {
            try {
                Update-View $qf $cols $widths $search
                Write-Host "  Quick Find view updated (search box now finds: $($QuickFindFields -join ', '))" -ForegroundColor Green
                $changed = $true
            } catch {
                Write-Warning "Quick Find view could not be updated - the form is unaffected. $($_.Exception.Message)"
                $viewProblems += "'$($qf.name)': under 'Find by', add $(($QuickFindFields | ForEach-Object { $csv[$_].DisplayName }) -join ', ')"
            }
        }
        $viewIds += $qf.savedqueryid
    } else { Write-Warning "No Quick Find view found - skipped." }
}

if (-not $changed) {
    Write-Host "`nNo changes made (-WhatIf). Backup: $backup  Proposed form: $proposed"
    return
}

# ---------------------------------------------------------------------------
# 4. Make sure they're in the solution, then publish
# ---------------------------------------------------------------------------
$components = @(@{ Id = $form.formid; Type = 60 }) + @($viewIds | ForEach-Object { @{ Id = $_; Type = 26 } })
foreach ($c in $components) {
    try {
        Invoke-Dv POST 'AddSolutionComponent' @{
            ComponentId = $c.Id; ComponentType = $c.Type; SolutionUniqueName = $SolutionUniqueName
            AddRequiredComponents = $false; DoNotIncludeSubcomponents = $false
        } | Out-Null
    } catch {
        Write-Warning "Could not add component $($c.Id) to the solution (it may already be included): $($_.Exception.Message)"
    }
}

Write-Host "Publishing $TableLogical..." -ForegroundColor Cyan
Invoke-Dv POST 'PublishXml' @{ ParameterXml = "<importexportxml><entities><entity>$TableLogical</entity></entities></importexportxml>" } | Out-Null

Write-Host ""
Write-Host "Done." -ForegroundColor Green
if ($viewProblems) {
    Write-Host ""
    Write-Host "The form is published, but these views need finishing by hand (Data experiences > Views):" -ForegroundColor Yellow
    $viewProblems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}
Write-Host "  Open an Apprentice Sign Up record (or the form designer) and refresh the browser to see the new layout."
Write-Host "  Backup of the previous form: $backup"
Write-Host "  To undo:  .\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl $EnvironmentUrl -SolutionUniqueName $SolutionUniqueName -Prefix $Prefix -RestoreFrom `"$backup`""
