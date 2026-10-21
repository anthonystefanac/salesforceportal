<#
.SYNOPSIS
    Creates the Apprentice Sign Up Dataverse table and all its columns from
    dataverse-table-schema.csv, inside an existing unmanaged solution.

.DESCRIPTION
    Reads dataverse-table-schema.csv and, using the Dataverse Web API:
      1. checks that the solution exists and that its publisher prefix matches -Prefix
      2. creates the table <prefix>_apprenticesignup (primary column = Sign Up Tracking Code)
      3. creates every column with the exact Choice values from the CSV, the required
         level, and column security for columns marked Sensitive
      4. creates the Applicant (Contact) lookup and its relationship
      5. publishes the table
      6. verifies every column exists and every Choice has the expected values, and prints
         the relationship name and the Webapi/<table>/fields site setting value
      7. writes apprentice-signup.webtemplate.<prefix>.liquid: the web template with your
         prefix, ENTITY_SET and CONTACT_NAV already filled in, ready to paste

    Safe to re-run: anything that already exists is skipped (and Choice values checked).

    Modes:
      -PlanOnly   No connection at all. Prints what would be created.
      -WhatIf     Connects and checks what already exists, but creates nothing.
      (neither)   Creates everything.

.PARAMETER EnvironmentUrl
    Dataverse environment URL, e.g. https://yourorg-dev.crm6.dynamics.com
    (Power Platform admin centre > Environments > your environment > Environment URL).

.PARAMETER SolutionUniqueName
    Unique (not display) name of the unmanaged solution to add the table to.
    Create the solution in make.powerapps.com first.

.PARAMETER Prefix
    Your publisher's customisation prefix, without the underscore (e.g. "bnsw").
    Every "asa_" in the CSV is replaced with "<Prefix>_".

.PARAMETER NoColumnSecurity
    Don't enable column security on Sensitive columns (you can enable it later by hand).

.PARAMETER Relogin
    Clear any saved Azure sign-in and sign in again (use if you get token errors).
    The script also does this automatically if the saved sign-in fails.

.PARAMETER AccessToken
    Optional bearer token for the environment. If omitted, the script signs you in
    interactively with the Az.Accounts module.

.EXAMPLE
    # 1. Preview offline
    .\Create-ApprenticeSignUpTable.ps1 -Prefix bnsw -PlanOnly

.EXAMPLE
    # 2. Check against the dev environment without changing anything
    .\Create-ApprenticeSignUpTable.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ApprenticeSignUp -Prefix bnsw -WhatIf

.EXAMPLE
    # 3. Create it
    .\Create-ApprenticeSignUpTable.ps1 -EnvironmentUrl https://yourorg-dev.crm6.dynamics.com `
        -SolutionUniqueName ApprenticeSignUp -Prefix bnsw

.NOTES
    Requires: PowerShell 5.1 or 7+, and (unless -AccessToken is given) the Az.Accounts module:
        Install-Module Az.Accounts -Scope CurrentUser
    The signed-in user needs System Customizer or System Administrator in the environment.
    Run it in DEV. Move to production by exporting the solution, not by re-running this.
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
    [switch] $NoColumnSecurity,
    # Bring existing Choice columns in line with the CSV: add missing options, fix labels,
    # put them in the CSV's order, and REMOVE options the CSV no longer lists.
    # Records that still hold a removed value keep the number but lose its label - only
    # use on a table without real data, or after moving those records to a kept value.
    [switch] $SyncChoices,
    # Build a copy of the table under another name, e.g. a test "source" table for pre-fill:
    #   -TableName ApplicantRecordTest -TableDisplayName "Applicant Record (test)" -NoColumnSecurity
    [ValidatePattern('^[A-Za-z][A-Za-z0-9]{2,40}$')]
    [string] $TableName = 'ApprenticeSignUp',
    [string] $TableDisplayName = 'Apprentice Sign Up',
    [string] $TablePluralName,
    [switch] $PlanOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Prefix      = $Prefix.ToLowerInvariant()
$TableLogical = "${Prefix}_$($TableName.ToLowerInvariant())"
$TableSchema  = "${Prefix}_$TableName"
$IsMainTable  = $TableLogical -eq "${Prefix}_apprenticesignup"
if (-not $TablePluralName) { $TablePluralName = "${TableDisplayName}s" }

# ---------------------------------------------------------------------------
# Read the CSV (by column position, so the header text/encoding doesn't matter)
# ---------------------------------------------------------------------------
if (-not (Test-Path $CsvPath)) { throw "CSV not found: $CsvPath" }
$raw = Import-Csv -Path $CsvPath -Encoding UTF8
if (-not $raw) { throw "CSV is empty: $CsvPath" }
$headers = @($raw[0].PSObject.Properties.Name)
if ($headers.Count -lt 9) { throw "Unexpected CSV layout: expected 9 columns, found $($headers.Count)." }

$columns = foreach ($r in $raw) {
    $v = @($r.PSObject.Properties.Value)
    $logical = ($v[2].Trim() -replace '^asa_', "${Prefix}_").ToLowerInvariant()
    $type    = $v[3].Trim()
    $choices = @()
    if ($v[4].Trim()) {
        $choices = foreach ($pair in $v[4].Split('|')) {
            $i = $pair.LastIndexOf('=')
            if ($i -lt 1) { throw "Bad choice '$pair' in column $logical" }
            [pscustomobject]@{ Label = $pair.Substring(0, $i).Trim(); Value = [int]$pair.Substring($i + 1).Trim() }
        }
    }
    $desc = "Shown when: $($v[7].Trim())."
    if ($v[8].Trim()) { $desc += " Source: $($v[8].Trim())" }
    if ($desc.Length -gt 2000) { $desc = $desc.Substring(0, 2000) }
    [pscustomobject]@{
        Section     = $v[0].Trim()
        DisplayName = $v[1].Trim()
        Logical     = $logical
        Type        = $type
        Choices     = @($choices)
        Required    = $v[5].Trim() -eq 'Yes'
        Sensitive   = $v[6].Trim() -eq 'Yes'
        Description = $desc
    }
}

$lookupCol  = @($columns | Where-Object { $_.Type -like 'Lookup*' })
if ($lookupCol.Count -ne 1) { throw "Expected exactly one Lookup (Contact) row in the CSV." }
$lookupCol  = $lookupCol[0]
$primaryCol = $columns | Where-Object { $_.Logical -eq "${Prefix}_trackingcode" }
if (-not $primaryCol) { throw "CSV has no ${Prefix}_trackingcode row (used as the table's primary column)." }
$lookupSchema = "${Prefix}_Contact"          # navigation property the web template binds to
$relSchema    = "${Prefix}_contact_$TableLogical"

# ---------------------------------------------------------------------------
# Metadata builders
# ---------------------------------------------------------------------------
function New-Label([string] $Text) {
    @{
        '@odata.type'   = 'Microsoft.Dynamics.CRM.Label'
        LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $Text; LanguageCode = $LanguageCode })
    }
}
function New-RequiredLevel([bool] $Required) {
    @{ Value = $(if ($Required) { 'ApplicationRequired' } else { 'None' }); CanBeChanged = $true; ManagedPropertyLogicalName = 'canmodifyrequirementlevelsettings' }
}

function New-AttributeBody($c) {
    $body = @{
        SchemaName    = $c.Logical
        DisplayName   = New-Label $c.DisplayName
        Description   = New-Label $c.Description
        RequiredLevel = New-RequiredLevel $c.Required
        IsSecured     = [bool]($c.Sensitive -and -not $NoColumnSecurity)
    }
    switch -Regex ($c.Type) {
        '^Single Line of Text \((\d+)\)$' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
            $body.MaxLength  = [int]$Matches[1]
            $body.FormatName = @{ Value = 'Text' }
            break
        }
        '^Phone$' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
            $body.MaxLength  = 50
            $body.FormatName = @{ Value = 'Phone' }
            break
        }
        '^Email$' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
            $body.MaxLength  = 100
            $body.FormatName = @{ Value = 'Email' }
            break
        }
        '^Multiple Lines of Text$' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
            $body.MaxLength = 4000
            $body.Format    = 'TextArea'
            break
        }
        '^Two Options' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
            $body.DefaultValue = $false
            $body.OptionSet = @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
                OptionSetType = 'Boolean'
                TrueOption    = @{ Value = 1; Label = New-Label 'Yes' }
                FalseOption   = @{ Value = 0; Label = New-Label 'No' }
            }
            break
        }
        '^Choice$' {
            if ($c.Choices.Count -eq 0) { throw "Choice column $($c.Logical) has no values in the CSV." }
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'
            $body.OptionSet = @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.OptionSetMetadata'
                IsGlobal      = $false
                OptionSetType = 'Picklist'
                Options       = @($c.Choices | ForEach-Object { @{ Value = $_.Value; Label = New-Label $_.Label } })
            }
            break
        }
        '^Date Only$' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
            $body.Format           = 'DateOnly'
            $body.DateTimeBehavior = @{ Value = 'DateOnly' }
            break
        }
        '^Whole Number$' {
            $body['@odata.type'] = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
            $body.Format   = 'None'
            $body.MinValue = 0
            $body.MaxValue = 2147483647
            break
        }
        default { throw "Unsupported data type '$($c.Type)' for column $($c.Logical)." }
    }
    $body
}

function New-TableBody {
    $primary = New-AttributeBody $primaryCol
    $primary.IsPrimaryName = $true
    $primary.IsSecured     = $false
    @{
        '@odata.type'         = 'Microsoft.Dynamics.CRM.EntityMetadata'
        SchemaName            = $TableSchema
        DisplayName           = New-Label $TableDisplayName
        DisplayCollectionName = New-Label $TablePluralName
        Description           = New-Label $(if ($IsMainTable) { 'Apprentice/trainee sign-up details submitted through the Power Pages sign-up form.' } else { "Same columns as Apprentice Sign Up. Created with -TableName $TableName." })
        OwnershipType         = 'UserOwned'
        IsActivity            = $false
        HasActivities         = $false
        HasNotes              = $false
        Attributes            = @($primary)
    }
}

function New-RelationshipBody {
    @{
        '@odata.type'     = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
        SchemaName        = $relSchema
        ReferencedEntity  = 'contact'
        ReferencingEntity = $TableLogical
        CascadeConfiguration = @{
            Assign = 'NoCascade'; Delete = 'RemoveLink'; Merge = 'Cascade'
            Reparent = 'NoCascade'; Share = 'NoCascade'; Unshare = 'NoCascade'; RollupView = 'NoCascade'
        }
        Lookup = @{
            '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
            SchemaName    = $lookupSchema
            DisplayName   = New-Label $lookupCol.DisplayName
            Description   = New-Label 'The signed-in website user (Contact) who submitted this sign-up.'
            RequiredLevel = New-RequiredLevel $false
        }
    }
}

# ---------------------------------------------------------------------------
# Plan-only mode: no connection
# ---------------------------------------------------------------------------
$fieldsSetting = ($columns | ForEach-Object { $_.Logical }) -join ','

if ($PlanOnly) {
    Write-Host "PLAN ONLY - nothing will be created.`n" -ForegroundColor Cyan
    Write-Host "Table: $TableLogical  (schema $TableSchema, primary column $($primaryCol.Logical))"
    Write-Host "Lookup: $($lookupCol.Logical) -> contact  (navigation property $lookupSchema, relationship $relSchema)`n"
    $columns | Where-Object { $_ -ne $lookupCol } | ForEach-Object {
        $b = New-AttributeBody $_
        [pscustomobject]@{
            Column   = $_.Logical
            Type     = ($b['@odata.type'] -replace 'Microsoft.Dynamics.CRM.', '' -replace 'AttributeMetadata', '')
            Required = $b.RequiredLevel.Value
            Secured  = $b.IsSecured
            Choices  = ($_.Choices | ForEach-Object { "$($_.Label)=$($_.Value)" }) -join '; '
        }
    } | Format-Table -AutoSize -Wrap | Out-String -Width 220 | Write-Host
    Write-Host "Columns in CSV: $($columns.Count)"
    Write-Host "`nWebapi/$TableLogical/fields =`n$fieldsSetting"
    return
}

if (-not $EnvironmentUrl -or -not $SolutionUniqueName) {
    throw "-EnvironmentUrl and -SolutionUniqueName are required (or use -PlanOnly)."
}
$EnvironmentUrl = $EnvironmentUrl.TrimEnd('/')
$Api = "$EnvironmentUrl/api/data/v9.2"

# ---------------------------------------------------------------------------
# Authentication
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

# ---------------------------------------------------------------------------
# Web API helper (retries throttling / transient errors)
# ---------------------------------------------------------------------------
function Invoke-Dv {
    param([string] $Method, [string] $Path, $Body, [switch] $AllowNotFound)
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

# ---------------------------------------------------------------------------
# 1. Solution + publisher prefix
# ---------------------------------------------------------------------------
Write-Host "Checking solution '$SolutionUniqueName'..." -ForegroundColor Cyan
$sol = Invoke-Dv GET ("solutions?`$select=uniquename,ismanaged&`$filter=uniquename eq '$SolutionUniqueName'" +
                      "&`$expand=publisherid(`$select=customizationprefix,friendlyname)")
if (-not $sol.value -or $sol.value.Count -eq 0) {
    throw "Solution '$SolutionUniqueName' not found. Create it in make.powerapps.com (Solutions > New solution) and use its *Name* (unique name)."
}
$sol = $sol.value[0]
if ($sol.ismanaged) { throw "Solution '$SolutionUniqueName' is managed. Use an unmanaged solution in your dev environment." }
$pubPrefix = $sol.publisherid.customizationprefix
if ($pubPrefix -ne $Prefix) {
    throw "Solution publisher '$($sol.publisherid.friendlyname)' uses prefix '$pubPrefix', but -Prefix is '$Prefix'. Use -Prefix $pubPrefix (and update the web template to match)."
}
Write-Host "  OK - publisher '$($sol.publisherid.friendlyname)', prefix '$pubPrefix'"

# ---------------------------------------------------------------------------
# 2. Table
# ---------------------------------------------------------------------------
$created = 0; $skipped = 0
$entityPath = "EntityDefinitions(LogicalName='$TableLogical')"
$table = Invoke-Dv GET "$entityPath`?`$select=LogicalName,EntitySetName,PrimaryNameAttribute" -AllowNotFound
$tableIsNew = $false
if ($table) {
    Write-Host "Table $TableLogical already exists (primary column $($table.PrimaryNameAttribute)) - skipping." -ForegroundColor Yellow
    $skipped++
} elseif ($PSCmdlet.ShouldProcess($TableLogical, 'Create table')) {
    Write-Host "Creating table $TableLogical (this can take a minute)..." -ForegroundColor Cyan
    Invoke-Dv POST 'EntityDefinitions' (New-TableBody) | Out-Null
    $created++; $tableIsNew = $true
} else {
    Write-Host "Would create table $TableLogical with $($columns.Count) columns. (Column checks skipped: table doesn't exist yet.)" -ForegroundColor Yellow
    Write-Host "`nNo changes made (-WhatIf)."
    return
}

# existing columns
$existing = @{}
if ($table -or $tableIsNew) {
    $attrs = Invoke-Dv GET "$entityPath/Attributes?`$select=LogicalName,AttributeType"
    foreach ($a in $attrs.value) { $existing[$a.LogicalName] = $a.AttributeType }
}

# ---------------------------------------------------------------------------
# 3. Columns
# ---------------------------------------------------------------------------
$i = 0
$toCreate = @($columns | Where-Object { $_ -ne $lookupCol })
foreach ($c in $toCreate) {
    $i++
    if ($tableIsNew -and $c -eq $primaryCol) {
        Write-Host ("  [{0,2}/{1}] {2} created with the table (primary column)" -f $i, $toCreate.Count, $c.Logical) -ForegroundColor DarkGray
        continue
    }
    if ($existing.ContainsKey($c.Logical)) {
        Write-Host ("  [{0,2}/{1}] {2} exists - skipping" -f $i, $toCreate.Count, $c.Logical) -ForegroundColor DarkGray
        $skipped++
        continue
    }
    if ($PSCmdlet.ShouldProcess("$TableLogical.$($c.Logical)", "Create column ($($c.Type))")) {
        Write-Host ("  [{0,2}/{1}] creating {2} ({3})" -f $i, $toCreate.Count, $c.Logical, $c.Type)
        Invoke-Dv POST "$entityPath/Attributes" (New-AttributeBody $c) | Out-Null
        $created++
    }
}

# ---------------------------------------------------------------------------
# 4. Contact lookup
# ---------------------------------------------------------------------------
if ($existing.ContainsKey($lookupCol.Logical)) {
    Write-Host "  Lookup $($lookupCol.Logical) exists - skipping" -ForegroundColor DarkGray
    $skipped++
} elseif ($PSCmdlet.ShouldProcess("$TableLogical.$($lookupCol.Logical)", 'Create lookup to Contact')) {
    Write-Host "  creating lookup $($lookupCol.Logical) -> contact"
    Invoke-Dv POST 'RelationshipDefinitions' (New-RelationshipBody) | Out-Null
    $created++
}

# ---------------------------------------------------------------------------
# 4b. Choice columns that already existed: compare options with the CSV
# ---------------------------------------------------------------------------
$choiceDiffs = 0
$existingChoices = @($columns | Where-Object { $_.Type -eq 'Choice' -and $existing.ContainsKey($_.Logical) })
if ($existingChoices) {
    $pl = Invoke-Dv GET "$entityPath/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet(`$select=Options)"
    $plMap = @{}; foreach ($p in $pl.value) { $plMap[$p.LogicalName] = $p }
    foreach ($c in $existingChoices) {
        $p = $plMap[$c.Logical]; if (-not $p) { continue }
        # Plain hashtable keyed by option value (an [ordered] dictionary would treat an int key
        # as a position), plus the current order separately
        $have = @{}; $haveOrder = @()
        foreach ($o in $p.OptionSet.Options) {
            $lbl = ($o.Label.LocalizedLabels | Where-Object { $_.LanguageCode -eq $LanguageCode } | Select-Object -First 1).Label
            if (-not $lbl -and $o.Label.UserLocalizedLabel) { $lbl = $o.Label.UserLocalizedLabel.Label }
            $have[[int]$o.Value] = $lbl; $haveOrder += [int]$o.Value
        }
        $want = @($c.Choices | ForEach-Object { [int]$_.Value })
        $add    = @($c.Choices | Where-Object { -not $have.ContainsKey([int]$_.Value) })
        $rename = @($c.Choices | Where-Object { $have.ContainsKey([int]$_.Value) -and $have[[int]$_.Value] -ne $_.Label })
        $remove = @($haveOrder | Where-Object { $want -notcontains $_ })
        $afterOrder = @(@($haveOrder | Where-Object { $want -contains $_ }) + @($add | ForEach-Object { [int]$_.Value }))
        $reorder = ($afterOrder -join ',') -ne ($want -join ',')
        if (-not ($add -or $rename -or $remove -or $reorder)) { continue }
        $choiceDiffs++
        $desc = @()
        if ($add)    { $desc += "add " + (($add | ForEach-Object { "$($_.Label)=$($_.Value)" }) -join ', ') }
        if ($rename) { $desc += "relabel " + (($rename | ForEach-Object { "$($_.Value): '$($have[[int]$_.Value])' -> '$($_.Label)'" }) -join ', ') }
        if ($remove) { $desc += "remove " + (($remove | ForEach-Object { "'$($have[$_])'=$_" }) -join ', ') }
        if ($reorder) { $desc += "reorder" }
        if (-not $SyncChoices) {
            Write-Host "  $($c.Logical) differs from the CSV: $($desc -join '; ')" -ForegroundColor Yellow
            continue
        }
        if (-not $PSCmdlet.ShouldProcess("$TableLogical.$($c.Logical)", ($desc -join '; '))) { continue }
        Write-Host "  syncing $($c.Logical): $($desc -join '; ')"
        $base = @{ EntityLogicalName = $TableLogical; AttributeLogicalName = $c.Logical }
        foreach ($o in $add) {
            Invoke-Dv POST 'InsertOptionValue' ($base + @{ Value = [int]$o.Value; Label = New-Label $o.Label; SolutionUniqueName = $SolutionUniqueName }) | Out-Null
        }
        foreach ($o in $rename) {
            Invoke-Dv POST 'UpdateOptionValue' ($base + @{ Value = [int]$o.Value; Label = New-Label $o.Label; MergeLabels = $true; SolutionUniqueName = $SolutionUniqueName }) | Out-Null
        }
        foreach ($v in $remove) {
            Invoke-Dv POST 'DeleteOptionValue' ($base + @{ Value = [int]$v; SolutionUniqueName = $SolutionUniqueName }) | Out-Null
        }
        Invoke-Dv POST 'OrderOption' ($base + @{ Values = [int[]]$want; SolutionUniqueName = $SolutionUniqueName }) | Out-Null
        $created++
    }
    if ($choiceDiffs -and -not $SyncChoices) {
        Write-Host "  $choiceDiffs Choice column(s) differ from the CSV. Re-run with -SyncChoices to update them." -ForegroundColor Yellow
    }
}

if ($WhatIfPreference) {
    Write-Host "`nNo changes made (-WhatIf). $skipped item(s) already exist."
    return
}

# ---------------------------------------------------------------------------
# 5. Publish
# ---------------------------------------------------------------------------
if ($created -gt 0) {
    Write-Host "Publishing $TableLogical..." -ForegroundColor Cyan
    Invoke-Dv POST 'PublishXml' @{ ParameterXml = "<importexportxml><entities><entity>$TableLogical</entity></entities></importexportxml>" } | Out-Null
}

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
Write-Host "Verifying..." -ForegroundColor Cyan
$problems = @()
$table = Invoke-Dv GET "$entityPath`?`$select=LogicalName,EntitySetName,PrimaryNameAttribute"
$attrs = Invoke-Dv GET "$entityPath/Attributes?`$select=LogicalName"
$have  = @{}; foreach ($a in $attrs.value) { $have[$a.LogicalName] = $true }
foreach ($c in $columns) { if (-not $have.ContainsKey($c.Logical)) { $problems += "Missing column $($c.Logical)" } }

$picklists = Invoke-Dv GET "$entityPath/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet(`$select=Options)"
$plByName = @{}; foreach ($p in $picklists.value) { $plByName[$p.LogicalName] = $p }
foreach ($c in ($columns | Where-Object { $_.Type -eq 'Choice' })) {
    $p = $plByName[$c.Logical]
    if (-not $p) { continue }   # already reported as missing
    $actual = @{}
    foreach ($o in $p.OptionSet.Options) {
        $lbl = ($o.Label.LocalizedLabels | Where-Object { $_.LanguageCode -eq $LanguageCode } | Select-Object -First 1).Label
        if (-not $lbl) { $lbl = $o.Label.UserLocalizedLabel.Label }
        $actual[[int]$o.Value] = $lbl
    }
    $extra = @($actual.Keys | Where-Object { @($c.Choices | ForEach-Object { [int]$_.Value }) -notcontains $_ })
    if ($extra) { $problems += "$($c.Logical): has options the CSV no longer lists ($(($extra | ForEach-Object { "'$($actual[$_])'=$_" }) -join ', ')) - re-run with -SyncChoices" }
    foreach ($ch in $c.Choices) {
        if (-not $actual.ContainsKey($ch.Value)) {
            $problems += "$($c.Logical): no option with value $($ch.Value) ('$($ch.Label)') - the web template will send $($ch.Value)"
        } elseif ($actual[$ch.Value] -ne $ch.Label) {
            $problems += "$($c.Logical): value $($ch.Value) is labelled '$($actual[$ch.Value])', expected '$($ch.Label)'"
        }
    }
}

$rel = Invoke-Dv GET "$entityPath/ManyToOneRelationships?`$select=SchemaName,ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity"
$contactRel = @($rel.value | Where-Object { $_.ReferencingAttribute -eq $lookupCol.Logical -and $_.ReferencedEntity -eq 'contact' }) | Select-Object -First 1
$navName = if ($contactRel) { $contactRel.ReferencingEntityNavigationPropertyName } else { '(not found)' }
if (-not $contactRel) { $problems += "Contact relationship for $($lookupCol.Logical) not found" }

Write-Host ""
Write-Host "Done. Created $created item(s), skipped $skipped existing." -ForegroundColor Green
Write-Host ""
if ($IsMainTable) {
    Write-Host "Put these values in apprentice-signup.webtemplate.liquid:" -ForegroundColor Cyan
    Write-Host "  ENTITY_SET  = `"$($table.EntitySetName)`""
    Write-Host "  CONTACT_NAV = `"$navName`""
    Write-Host "  (and replace every 'asa_' with '${Prefix}_')"
    Write-Host ""
    Write-Host "Relationship for the Contact-scoped Table Permission: $(if ($contactRel) { $contactRel.SchemaName } else { '(not found)' })" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Site setting  Webapi/$TableLogical/fields  =" -ForegroundColor Cyan
    Write-Host $fieldsSetting
    Write-Host ""
} else {
    Write-Host "Copy table '$TableDisplayName' ($TableLogical) is ready. It is not used by the website." -ForegroundColor Cyan
    Write-Host "  Lay out its form:  .\Build-ApprenticeSignUpForm.ps1 ... -TableName $TableName"
    Write-Host "  Then add it to the staff app so you can enter test records (PREFILL.md step 1)."
    Write-Host ""
}
if ($problems.Count -gt 0) {
    Write-Host "PROBLEMS FOUND ($($problems.Count)):" -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host "Verification passed: all $($columns.Count) columns present, all Choice values match." -ForegroundColor Green

    # Write a ready-to-paste copy of the web template with this environment's names
    $tplIn = Join-Path $PSScriptRoot 'apprentice-signup.webtemplate.liquid'
    if ($IsMainTable -and (Test-Path $tplIn)) {
        $tpl = [System.IO.File]::ReadAllText($tplIn, [System.Text.Encoding]::UTF8)
        $tpl = $tpl.Replace('asa_', "${Prefix}_")
        $tpl = [regex]::Replace($tpl, 'var ENTITY_SET = "[^"]*"', "var ENTITY_SET = `"$($table.EntitySetName)`"")
        $tpl = [regex]::Replace($tpl, 'var CONTACT_NAV = "[^"]*"', "var CONTACT_NAV = `"$navName`"")
        $tplOut = Join-Path $PSScriptRoot "apprentice-signup.webtemplate.$Prefix.liquid"
        [System.IO.File]::WriteAllText($tplOut, $tpl, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Wrote $tplOut - prefix, ENTITY_SET and CONTACT_NAV already filled in. Paste this one into Power Pages." -ForegroundColor Green
    }
    if (-not $NoColumnSecurity) {
        Write-Host "Column security is ON for Sensitive columns - set up the column security profile and Power Pages column permissions next (security-and-permissions.md section 4)." -ForegroundColor Yellow
    }
}
