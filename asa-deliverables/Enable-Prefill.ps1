<#
.SYNOPSIS
    Adds the columns and site setting the sign-up form needs to PRE-FILL applicants'
    details and record what they changed.

.DESCRIPTION
    Run AFTER Enable-TrackingCodeCheck.ps1, and BEFORE pasting the pre-fill version of the
    web template (the page's code check reads the new invite column).

    Dataverse
      1. On Sign Up Invite: "Prefill Data" (<prefix>_prefilldata, multiple lines of text).
         The "prefill invite" flow writes the applicant's existing details here as JSON.
      2. On Apprentice Sign Up (same as the rows in dataverse-table-schema.csv):
           "Pre-filled" (<prefix>_prefilled, Yes/No)
           "Changes From Pre-fill" (<prefix>_prefillchanges, multiple lines of text)
         Both are set by the page when a pre-filled form is submitted.
    Power Pages
      3. Adds the two new columns to the site setting Webapi/<prefix>_apprenticesignup/fields
         (without this, pre-filled submissions are refused).

    Still manual afterwards (printed at the end, detailed in PREFILL.md):
      - paste the updated web template, Sync
      - build the "prefill invite" flow, and clear Prefill Data in the verification flow
      - for testing: create the copy "source" table (see PREFILL.md step 1)

    Safe to re-run. Modes: -PlanOnly (no connection), -WhatIf (connects, changes nothing).

.EXAMPLE
    .\Enable-Prefill.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ASATestAIApp -Prefix bnsw -WebsiteName "ASA Sign Up" -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $EnvironmentUrl,
    [string] $SolutionUniqueName,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{1,7}$')]
    [string] $Prefix,
    [string] $WebsiteName,
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
$NewAppCols = @("${Prefix}_prefilled", "${Prefix}_prefillchanges")

if ($PlanOnly) {
    Write-Host "PLAN ONLY - nothing will be changed.`n" -ForegroundColor Cyan
    Write-Host "Dataverse:"
    Write-Host "  On ${InvTable}:  ${Prefix}_prefilldata     Multiple lines of text (100,000)  'Prefill Data'"
    Write-Host "  On ${AppTable}:  ${Prefix}_prefilled       Yes/No                           'Pre-filled'"
    Write-Host "  On ${AppTable}:  ${Prefix}_prefillchanges  Multiple lines of text (4,000)   'Changes From Pre-fill'"
    Write-Host "Power Pages:"
    Write-Host "  Site setting Webapi/$AppTable/fields: add $($NewAppCols -join ', ')"
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

# ---------------------------------------------------------------------------
# 0. Solution + prefix, tables
# ---------------------------------------------------------------------------
Write-Host "Checking solution '$SolutionUniqueName'..." -ForegroundColor Cyan
$sol = Invoke-Dv GET ("solutions?`$select=uniquename,ismanaged&`$filter=uniquename eq '$(Q $SolutionUniqueName)'&`$expand=publisherid(`$select=customizationprefix)")
if (-not $sol.value -or $sol.value.Count -eq 0) { throw "Solution '$SolutionUniqueName' not found (use its Name / unique name)." }
if ($sol.value[0].publisherid.customizationprefix -ne $Prefix) { throw "Solution publisher prefix is '$($sol.value[0].publisherid.customizationprefix)', not '$Prefix'." }
foreach ($t in @(@($AppTable, 'Create-ApprenticeSignUpTable.ps1'), @($InvTable, 'Enable-TrackingCodeCheck.ps1'))) {
    if (-not (Invoke-Dv GET "EntityDefinitions(LogicalName='$($t[0])')?`$select=LogicalName" -AllowNotFound)) {
        throw "Table $($t[0]) not found - run $($t[1]) first."
    }
}

function Add-Column([string] $table, [hashtable] $body) {
    $script:attrCache = if ($script:attrCacheTable -eq $table) { $script:attrCache } else { Get-AttrNames $table }
    $script:attrCacheTable = $table
    if ($script:attrCache -contains $body.SchemaName) { Write-Host "  $table.$($body.SchemaName) exists" -ForegroundColor DarkGray; $script:skipped++; return }
    if ($PSCmdlet.ShouldProcess("$table.$($body.SchemaName)", 'Create column')) {
        Invoke-Dv POST "EntityDefinitions(LogicalName='$table')/Attributes" $body | Out-Null
        Write-Host "  created $table.$($body.SchemaName)" -ForegroundColor Green; $script:created++
    }
}
$script:attrCacheTable = ''

# ---------------------------------------------------------------------------
# 1-2. Columns
# ---------------------------------------------------------------------------
Write-Host "Columns..." -ForegroundColor Cyan
Add-Column $InvTable @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; SchemaName = "${Prefix}_prefilldata"; MaxLength = 100000; Format = 'TextArea'
    DisplayName = New-Label 'Prefill Data'; RequiredLevel = New-Req $false
    Description = New-Label "The applicant's existing details as JSON, written by the prefill flow and shown pre-filled on the sign-up form. Cleared once the sign-up is received." }
Add-Column $AppTable @{ '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'; SchemaName = "${Prefix}_prefilled"; DefaultValue = $false
    DisplayName = New-Label 'Pre-filled'; RequiredLevel = New-Req $false
    Description = New-Label "Yes when the form started from the applicant's existing details. Set by the page."
    OptionSet = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'; OptionSetType = 'Boolean'
                   TrueOption = @{ Value = 1; Label = New-Label 'Yes' }; FalseOption = @{ Value = 0; Label = New-Label 'No' } } }
Add-Column $AppTable @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; SchemaName = "${Prefix}_prefillchanges"; MaxLength = 4000; Format = 'TextArea'
    DisplayName = New-Label 'Changes From Pre-fill'; RequiredLevel = New-Req $false
    Description = New-Label 'What the applicant changed from the pre-filled details. Values of sensitive fields are not written out. Set by the page.' }

if (-not $WhatIfPreference -and $created -gt 0) {
    Write-Host "Publishing..." -ForegroundColor Cyan
    Invoke-Dv POST 'PublishXml' @{ ParameterXml = "<importexportxml><entities><entity>$InvTable</entity><entity>$AppTable</entity></entities></importexportxml>" } | Out-Null
}

# ---------------------------------------------------------------------------
# 3. Site setting: let the page write the two new columns
# ---------------------------------------------------------------------------
function Get-TableMeta([string] $logical) {
    $e = Invoke-Dv GET "EntityDefinitions(LogicalName='$logical')?`$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute" -AllowNotFound
    if (-not $e) { return $null }
    $a   = Invoke-Dv GET "EntityDefinitions(LogicalName='$logical')/Attributes?`$select=LogicalName"
    $m2o = Invoke-Dv GET "EntityDefinitions(LogicalName='$logical')/ManyToOneRelationships?`$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName"
    [pscustomobject]@{ Logical = $logical; Set = $e.EntitySetName; Id = $e.PrimaryIdAttribute; Name = $e.PrimaryNameAttribute
                       Attrs = @($a.value | ForEach-Object { $_.LogicalName }); M2O = @($m2o.value) }
}
function Get-All($meta, [string] $select) { @((Invoke-Dv GET "$($meta.Set)?`$select=$select").value) }
function Get-Prop($obj, [string] $name) { $p = $obj.PSObject.Properties[$name]; if ($p) { $p.Value } else { $null } }

Write-Host "Finding the Power Pages site..." -ForegroundColor Cyan
$P = $null; $siteMeta = $null; $site = $null
foreach ($candidate in @('mspp', 'adx')) {
    $m = Get-TableMeta "${candidate}_website"
    if (-not $m) { continue }
    $sites = Get-All $m "$($m.Id),$($m.Name)"
    if ($WebsiteName) { $sites = @($sites | Where-Object { $_.($m.Name) -eq $WebsiteName }) }
    if ($sites.Count -eq 1) { $P = $candidate; $siteMeta = $m; $site = $sites[0]; break }
    if ($sites.Count -gt 1) { throw "More than one site found ($(($sites | ForEach-Object { "'" + $_.($m.Name) + "'" }) -join ', ')). Use -WebsiteName." }
}
if (-not $site) { throw "No Power Pages site$(if ($WebsiteName) { " named '$WebsiteName'" }) found." }
$siteId = $site.($siteMeta.Id); $siteKey = "_${P}_websiteid_value"
Write-Host "  OK - '$($site.($siteMeta.Name))'"


$settingMeta = Get-TableMeta "${P}_sitesetting"
if (-not $settingMeta) { throw "Table ${P}_sitesetting not found - unexpected Power Pages setup." }
$settingName = "Webapi/$AppTable/fields"
$setting = @(Get-All $settingMeta "$($settingMeta.Id),$($settingMeta.Name),${P}_value,$siteKey" |
             Where-Object { (Get-Prop $_ $siteKey) -eq $siteId -and (Get-Prop $_ $settingMeta.Name) -eq $settingName }) | Select-Object -First 1
if (-not $setting) {
    Write-Warning "Site setting $settingName not found."
    $manual += "Run Configure-ApprenticeSignUpSecurity.ps1 (it creates $settingName, now including the pre-fill columns)"
} else {
    $value = "$(Get-Prop $setting "${P}_value")".Trim()
    $list = @($value -split '\s*,\s*' | Where-Object { $_ })
    $missingCols = @($NewAppCols | Where-Object { $list -notcontains $_ })
    if ($value -eq '*') {
        Write-Host "  $settingName is '*' (all columns) - nothing to add" -ForegroundColor DarkGray; $skipped++
    } elseif (-not $missingCols) {
        Write-Host "  $settingName already includes the pre-fill columns" -ForegroundColor DarkGray; $skipped++
    } elseif ($PSCmdlet.ShouldProcess($settingName, "Add $($missingCols -join ', ')")) {
        $newValue = (@($list) + $missingCols) -join ','
        Invoke-Dv PATCH "$($settingMeta.Set)($($setting.($settingMeta.Id)))" @{ "${P}_value" = $newValue } | Out-Null
        Write-Host "  $settingName - added $($missingCols -join ', ')" -ForegroundColor Green; $created++
    }
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
Write-Host "Next (see PREFILL.md):" -ForegroundColor Cyan
Write-Host "  1. In Studio, click Sync (picks up the site setting change)."
Write-Host "  2. Paste the updated web template, Save, Sync."
Write-Host "  3. Build the 'prefill invite' flow, and add 'clear Prefill Data' to the verification flow."
Write-Host "  4. For testing: create the copy source table and add a test record (PREFILL.md step 1)."
