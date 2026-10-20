<#
.SYNOPSIS
    Sets up STAFF DRAFTS: staff pre-fill (or start) an Apprentice Sign Up record, send it to
    the applicant, and the applicant reviews, edits and approves it on the website.

.DESCRIPTION
    Run AFTER Enable-TrackingCodeCheck.ps1 and Enable-Prefill.ps1.

    Dataverse - Apprentice Sign Up
      1. "Stage" (<prefix>_stage): Draft=1 (default on the staff form), Sent to applicant=2,
         Submitted=3, Replaced=4. Staff set "Sent to applicant"; the flows set the rest.
      2. "Staff Draft" lookup (<prefix>_staffdraft -> Apprentice Sign Up): on a submission,
         the draft it replaced. Set by the verification flow.
      3. Columns marked Business Required become Optional, so staff can save a part-filled
         draft. The website still requires them from the applicant.
    Dataverse - Sign Up Invite
      4. "Draft" lookup (<prefix>_draft -> Apprentice Sign Up): the draft this invite was sent
         for. Set by the "send to applicant" flow.

    No website changes are needed for this script (the page does not write these columns).
    Still manual afterwards (detailed in STAFF-DRAFTS.md): the "send to applicant" flow,
    additions to the verification flow, turning OFF the email-matching prefill flow, and
    re-running Build-ApprenticeSignUpForm.ps1 to put Stage on the staff form.

    Safe to re-run. Modes: -PlanOnly (no connection), -WhatIf (connects, changes nothing).

.EXAMPLE
    .\Enable-StaffDrafts.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ASATestAIApp -Prefix bnsw -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $EnvironmentUrl,
    [string] $SolutionUniqueName,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{1,7}$')]
    [string] $Prefix,
    [string] $TenantId,
    [string] $AccessToken,
    [switch] $Relogin,
    [int]    $LanguageCode = 1033,
    [switch] $PlanOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Prefix   = $Prefix.ToLowerInvariant()
$AppTable = "${Prefix}_apprenticesignup"
$InvTable = "${Prefix}_signupinvite"
$Stages   = @(@('Draft', 1), @('Sent to applicant', 2), @('Submitted', 3), @('Replaced', 4))
$CastFor  = @{ String = 'StringAttributeMetadata'; Memo = 'MemoAttributeMetadata'; DateTime = 'DateTimeAttributeMetadata'
               Picklist = 'PicklistAttributeMetadata'; Integer = 'IntegerAttributeMetadata'; Decimal = 'DecimalAttributeMetadata' }

if ($PlanOnly) {
    Write-Host "PLAN ONLY - nothing will be changed.`n" -ForegroundColor Cyan
    Write-Host "On ${AppTable}:"
    Write-Host "  ${Prefix}_stage       Choice  $(($Stages | ForEach-Object { "$($_[0])=$($_[1])" }) -join ', ') (default Draft)"
    Write-Host "  ${Prefix}_staffdraft  Lookup -> $AppTable  'Staff Draft'"
    Write-Host "  Business Required columns -> Optional (Yes/No columns are left alone - they always have a value)"
    Write-Host "On ${InvTable}:"
    Write-Host "  ${Prefix}_draft       Lookup -> $AppTable  'Draft'"
    return
}

if (-not $EnvironmentUrl -or -not $SolutionUniqueName) { throw "-EnvironmentUrl and -SolutionUniqueName are required (or use -PlanOnly)." }
$EnvironmentUrl = $EnvironmentUrl.TrimEnd('/')
$Api = "$EnvironmentUrl/api/data/v9.2"

# ---------------------------------------------------------------------------
# Authentication (same as the other scripts)
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
    param([string] $Method, [string] $Path, $Body, [switch] $AllowNotFound, [hashtable] $ExtraHeaders)
    $headers = @{
        Authorization      = "Bearer $AccessToken"
        Accept             = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        'MSCRM.SolutionUniqueName' = $SolutionUniqueName
        Prefer             = 'return=representation'
    }
    if ($ExtraHeaders) { foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] } }
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
            if ($status -eq 404 -and $AllowNotFound) { return $null }
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

function New-Label([string] $Text) {
    @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
       LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $Text; LanguageCode = $LanguageCode }) }
}
function New-Req([bool] $r) { @{ Value = $(if ($r) { 'ApplicationRequired' } else { 'None' }); CanBeChanged = $true; ManagedPropertyLogicalName = 'canmodifyrequirementlevelsettings' } }
function New-Picklist([string] $schema, [string] $label, [string] $desc, $options, [bool] $required) {
    @{ '@odata.type' = 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'
       SchemaName = $schema; DisplayName = New-Label $label; Description = New-Label $desc; RequiredLevel = New-Req $required
       DefaultFormValue = $options[0][1]
       OptionSet = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.OptionSetMetadata'; IsGlobal = $false; OptionSetType = 'Picklist'
                      Options = @($options | ForEach-Object { @{ Value = $_[1]; Label = New-Label $_[0] } }) } }
}
function Get-AttrNames([string] $table) {
    @((Invoke-Dv GET "EntityDefinitions(LogicalName='$table')/Attributes?`$select=LogicalName").value | ForEach-Object { $_.LogicalName })
}
function Q([string] $s) { $s.Replace("'", "''") }

$created = 0; $skipped = 0; $manual = @()

Write-Host "Checking solution '$SolutionUniqueName'..." -ForegroundColor Cyan
$sol = Invoke-Dv GET ("solutions?`$select=uniquename,ismanaged&`$filter=uniquename eq '$(Q $SolutionUniqueName)'&`$expand=publisherid(`$select=customizationprefix)")
if (-not $sol.value -or $sol.value.Count -eq 0) { throw "Solution '$SolutionUniqueName' not found (use its Name / unique name)." }
if ($sol.value[0].publisherid.customizationprefix -ne $Prefix) { throw "Solution publisher prefix is '$($sol.value[0].publisherid.customizationprefix)', not '$Prefix'." }
foreach ($t in @(@($AppTable, 'Create-ApprenticeSignUpTable.ps1'), @($InvTable, 'Enable-TrackingCodeCheck.ps1'))) {
    if (-not (Invoke-Dv GET "EntityDefinitions(LogicalName='$($t[0])')?`$select=LogicalName" -AllowNotFound)) { throw "Table $($t[0]) not found - run $($t[1]) first." }
}
$appAttrs = Get-AttrNames $AppTable
$invAttrs = Get-AttrNames $InvTable
if ($invAttrs -notcontains "${Prefix}_prefilldata") { throw "Column $InvTable.${Prefix}_prefilldata not found - run Enable-Prefill.ps1 first." }

function New-Lookup([string] $relSchema, [string] $referencing, [string] $lookupSchema, [string] $label, [string] $desc) {
    @{ '@odata.type' = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
       SchemaName = $relSchema; ReferencedEntity = $AppTable; ReferencingEntity = $referencing
       CascadeConfiguration = @{ Assign = 'NoCascade'; Delete = 'RemoveLink'; Merge = 'NoCascade'; Reparent = 'NoCascade'; Share = 'NoCascade'; Unshare = 'NoCascade'; RollupView = 'NoCascade' }
       Lookup = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'; SchemaName = $lookupSchema
                   DisplayName = New-Label $label; Description = New-Label $desc; RequiredLevel = New-Req $false } }
}

# ---------------------------------------------------------------------------
# 1-2, 4. New columns
# ---------------------------------------------------------------------------
Write-Host "Columns..." -ForegroundColor Cyan
if ($appAttrs -contains "${Prefix}_stage") { Write-Host "  $AppTable.${Prefix}_stage exists" -ForegroundColor DarkGray; $skipped++ }
elseif ($PSCmdlet.ShouldProcess("$AppTable.${Prefix}_stage", 'Create column')) {
    Invoke-Dv POST "EntityDefinitions(LogicalName='$AppTable')/Attributes" (New-Picklist "${Prefix}_stage" 'Stage' 'Draft = staff are preparing it; Sent to applicant = the applicant has a link (set by staff); Submitted = received from the website; Replaced = a submission replaced this draft (set by the flow).' $Stages $false) | Out-Null
    Write-Host "  created $AppTable.${Prefix}_stage" -ForegroundColor Green; $created++
}
if ($appAttrs -contains "${Prefix}_staffdraft") { Write-Host "  $AppTable.${Prefix}_staffdraft exists" -ForegroundColor DarkGray; $skipped++ }
elseif ($PSCmdlet.ShouldProcess("$AppTable.${Prefix}_staffdraft", 'Create lookup to Apprentice Sign Up')) {
    Invoke-Dv POST 'RelationshipDefinitions' (New-Lookup "${Prefix}_apprenticesignup_staffdraft" $AppTable "${Prefix}_StaffDraft" 'Staff Draft' 'On a submission: the staff draft it replaced. Set by the verification flow.') | Out-Null
    Write-Host "  created lookup $AppTable.${Prefix}_staffdraft" -ForegroundColor Green; $created++
}
if ($invAttrs -contains "${Prefix}_draft") { Write-Host "  $InvTable.${Prefix}_draft exists" -ForegroundColor DarkGray; $skipped++ }
elseif ($PSCmdlet.ShouldProcess("$InvTable.${Prefix}_draft", 'Create lookup to Apprentice Sign Up')) {
    Invoke-Dv POST 'RelationshipDefinitions' (New-Lookup "${Prefix}_apprenticesignup_signupinvite_draft" $InvTable "${Prefix}_Draft" 'Draft' 'The staff draft this invite was sent for. Set by the send-to-applicant flow.') | Out-Null
    Write-Host "  created lookup $InvTable.${Prefix}_draft" -ForegroundColor Green; $created++
}

# ---------------------------------------------------------------------------
# 3. Business Required -> Optional (so part-filled drafts can be saved)
# ---------------------------------------------------------------------------
Write-Host "Required columns..." -ForegroundColor Cyan
$all = @((Invoke-Dv GET "EntityDefinitions(LogicalName='$AppTable')/Attributes?`$select=LogicalName,AttributeType,RequiredLevel,IsCustomAttribute").value)
$req = @($all | Where-Object { $_.LogicalName -like "${Prefix}_*" -and $_.RequiredLevel -and $_.RequiredLevel.Value -eq 'ApplicationRequired' -and $_.AttributeType -ne 'Boolean' })
if (-not $req) { Write-Host "  none left - staff can save part-filled drafts" -ForegroundColor DarkGray; $skipped++ }
$relaxed = 0; $failed = @()
foreach ($a in $req) {
    $cast = $CastFor["$($a.AttributeType)"]
    if (-not $cast) { $failed += $a.LogicalName; continue }
    if (-not $PSCmdlet.ShouldProcess("$AppTable.$($a.LogicalName)", 'Make optional')) { continue }
    $path = "EntityDefinitions(LogicalName='$AppTable')/Attributes(LogicalName='$($a.LogicalName)')/Microsoft.Dynamics.CRM.$cast"
    try {
        $cur = Invoke-Dv GET $path
        $upd = [ordered]@{ '@odata.type' = "Microsoft.Dynamics.CRM.$cast" }
        foreach ($prop in $cur.PSObject.Properties) { if ($prop.Name -notlike '*@odata.*' -and $prop.Name -notlike '@*') { $upd[$prop.Name] = $prop.Value } }
        $upd['RequiredLevel'] = New-Req $false
        Invoke-Dv PUT $path $upd -ExtraHeaders @{ 'MSCRM.MergeLabels' = 'true' } | Out-Null
        $relaxed++
    } catch {
        Write-Warning "  couldn't change $($a.LogicalName): $($_.Exception.Message)"
        $failed += $a.LogicalName
    }
}
if ($relaxed) { Write-Host "  made $relaxed column(s) optional" -ForegroundColor Green; $created += $relaxed }
if ($failed) { $manual += "In make.powerapps.com > Tables > Apprentice Sign Up > Columns, set Required to 'Optional' for: $($failed -join ', ')" }

if (-not $WhatIfPreference -and $created -gt 0) {
    Write-Host "Publishing..." -ForegroundColor Cyan
    Invoke-Dv POST 'PublishXml' @{ ParameterXml = "<importexportxml><entities><entity>$AppTable</entity><entity>$InvTable</entity></entities></importexportxml>" } | Out-Null
}

# ---------------------------------------------------------------------------
Write-Host ""
if ($WhatIfPreference) { Write-Host "No changes made (-WhatIf). Checks passed." -ForegroundColor Green }
else { Write-Host "Done. Created/updated $created, already in place $skipped." -ForegroundColor Green }
Write-Host ""
if ($manual) {
    Write-Host "ACTION NEEDED:" -ForegroundColor Red
    $manual | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host ""
}
Write-Host "Next (see STAFF-DRAFTS.md):" -ForegroundColor Cyan
Write-Host "  1. Turn OFF the 'ASA Sign Up - prefill invite' flow (email matching) if you built it."
Write-Host "  2. Re-run Build-ApprenticeSignUpForm.ps1 to put Stage and Staff Draft on the staff form."
Write-Host "  3. Build the 'send to applicant' flow and add the draft steps to the verification flow."
Write-Host "  4. Paste the updated web template (adds the 'I confirm' tick on the review page), Sync."
