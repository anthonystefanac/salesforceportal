# Pre-fill: applicants review details you already hold

When staff create a Sign Up Invite, a flow looks for the applicant's existing record **by
email address** and copies their details onto the invite. When the applicant opens their
link, the form is already filled in. They check each section, fix anything that's wrong,
see everything on a **Review your details** page, and submit. The submission records
**what they changed**.

Replace `bnsw_` with your prefix if it differs.

## How it works

```
Source table (test: "Applicant Record (test)")
        │  matched by email address
        ▼
Prefill flow ──► Sign Up Invite . Prefill Data   (JSON copy of the details you choose to share)
                         │
                         ▼  page reads it on the server with the tracking-code check
                 Sign-up form, pre-filled ──► Review page ──► Submit
                         │
                         ▼
Apprentice Sign Up . Pre-filled = Yes
                   . Changes From Pre-fill = "Your Mobile Number: "0412…" → "0498…" …"
Verification flow ──► marks the invite Used and clears its Prefill Data
```

- **No match for the email:** the form opens blank, exactly as before.
- **Staff fix the email on the invite:** the flow runs again and picks up the right record.
- **Website visitors never get access to the source table.** They can only see the copy on
  their own invite, and only through their link.
- **Consent tick boxes are never pre-filled.** The applicant ticks them themselves.

## Choosing what to share

The flow decides which columns are copied (step 4, **Select columns**).

- **Recommended:** start with the **standard list**, which covers every column not marked
  Sensitive.
- **Optional:** add some or all of the **sensitive list**. Anyone holding the link will
  see those values, so decide this with your privacy officer.
- **Changes log:** when a sensitive answer changes, the log only says it changed, never the
  value.

**Standard list (43 columns):**
```
bnsw_hasusi,bnsw_firstname,bnsw_middlename,bnsw_lastname,bnsw_previousname,bnsw_homestreet,bnsw_homesuburb,bnsw_homepostcode,bnsw_homestate,bnsw_postalsame,bnsw_postaladdress,bnsw_postalsuburb,bnsw_postalpostcode,bnsw_mobile,bnsw_email,bnsw_gender,bnsw_countryofbirth,bnsw_languageathome,bnsw_stillatschool,bnsw_schoollevel,bnsw_highestschooling,bnsw_monthcompletedschool,bnsw_yearcompletedschool,bnsw_employer,bnsw_apprenticeshipstartdate,bnsw_jobtitle,bnsw_qualification,bnsw_commencedbefore,bnsw_previouslyworkedwithbusiness,bnsw_priorworkstarted,bnsw_priorworkended,bnsw_priorworkemploymenttype,bnsw_priorworkhoursperweek,bnsw_workplacename,bnsw_workplaceaddress,bnsw_completedqualification,bnsw_qualificationdetails,bnsw_qualificationstudystarted,bnsw_qualificationstudyfinished,bnsw_currentlystudying,bnsw_currentstudyname,bnsw_currentstudystartdate,bnsw_under18
```
**Sensitive list (optional, 14 columns):**
```
bnsw_usinumber,bnsw_dateofbirth,bnsw_citizenship,bnsw_visadetails,bnsw_indigenousstatus,bnsw_disability,bnsw_guardianfirstname,bnsw_guardianlastname,bnsw_guardianaddress,bnsw_guardiansuburb,bnsw_guardianstate,bnsw_guardianpostcode,bnsw_guardianmobile,bnsw_guardianemail
```

## Setup (about 45 minutes)

Do the steps **in this order**. The new page reads a column that step 1 creates. If you
paste the page first, every code shows "couldn't find".

### 1. Add the pre-fill columns (script)
```powershell
.\Enable-Prefill.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw -WebsiteName "ASA Sign Up" -WhatIf
# then again without -WhatIf
```
It adds:
- **Prefill Data** on Sign Up Invite;
- **Pre-filled** and **Changes From Pre-fill** on Apprentice Sign Up;
- the two new columns to the `Webapi/bnsw_apprenticesignup/fields` site setting. Without
  this, pre-filled submissions are refused.

### 2. Create the test source table (script)
This makes **Applicant Record (test)**, an exact copy of Apprentice Sign Up, to stand in for
your existing table until you have its details.
```powershell
.\Create-ApprenticeSignUpTable.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw `
    -TableName ApplicantRecordTest -TableDisplayName "Applicant Record (test)" `
    -TablePluralName "Applicant Records (test)" -NoColumnSecurity

.\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw -TableName ApplicantRecordTest
```
The website never uses this table. To add test records, either:
- **Add a row:** in make.powerapps.com, go to **Tables → Applicant Record (test) → Edit →
  + New row**. Or add the table to the staff app: **Edit → Add page → Dataverse table**.
- **Copy earlier test submissions:**
  1. Go to **Tables → Apprentice Sign Up → Export → Export data**.
  2. Then go to **Tables → Applicant Record (test) → Import → Import data from Excel**.
  The column names match.

### 3. Update the web template
Paste the new `apprentice-signup.webtemplate.bnsw.liquid` into **Power Pages Management →
Web Templates → Apprentice Sign Up → Source**, **Save**, then click **Sync** in Studio.

### 4. Build the prefill flow (about 15 minutes)
In make.powerapps.com, go to **Solutions → ASATestAIApp → New → Automation → Cloud flow →
Automated**. Name it `ASA Sign Up – prefill invite`. Pick the trigger Dataverse **When a
row is added, modified or deleted**, then click **Create**.

1. **Trigger:**
   | Setting | Value |
   |---|---|
   | Change type | **Added or Modified** |
   | Table name | **Sign Up Invites** |
   | Scope | **Organization** |
   | Select columns *(Show advanced options)* | `bnsw_inviteemail` |

   Add a trigger condition: **… → Settings → Trigger conditions → + Add**:
   ```
   @and(not(empty(triggerOutputs()?['body/bnsw_inviteemail'])), equals(triggerOutputs()?['body/bnsw_invitestatus'], 1))
   ```
   The flow then runs only for Issued invites with an email, and again whenever the email
   is changed.

2. **+ New step → Dataverse → List rows:**
   | Setting | Value |
   |---|---|
   | Table name | **Applicant Records (test)** |
   | Select columns | the **standard list** above (paste it in as is) |
   | Filter rows | type `bnsw_email eq '`, insert the **expression** below, then type `'` |
   | Sort by | `modifiedon desc` |
   | Row count | `1` |

   Expression for the filter (matching ignores capital letters; the newest matching record wins):
   ```
   replace(trim(triggerOutputs()?['body/bnsw_inviteemail']), '''', '''''')
   ```

3. **+ New step → Condition:** expression `length(outputs('List_rows')?['body/value'])`
   **is greater than** `0`.

4. **If yes → Dataverse → Update a row:**
   - Table name: **Sign Up Invites**.
   - Row ID: the trigger's **Sign Up Invite** (unique identifier) from Dynamic content.
   - **Prefill Data:** expression:
     ```
     string(first(outputs('List_rows')?['body/value']))
     ```

5. **If no → Dataverse → Update a row:**
   - Same table and Row ID as step 4.
   - **Prefill Data:** expression `null`.

   This clears old data if the email was changed to one with no record.

6. **Save.** The flow turns on automatically.

**Timing:** the prefill flow and the email flow both start when the invite is created and
each takes a few seconds. An applicant would have to open the link within that time to see
a blank form.

### 5. Clear the data after use (verification flow)
Open `ASA Sign Up – verify tracking code`. In the **Case 1** → **No** (valid) branch, find
the **Update a row** that sets the invite to **Used**. Click **Show advanced options**, and
set **Prefill Data** to the expression `null`. **Save.**

Once a sign-up is received, the copy of the applicant's details no longer sits on the invite.

### 6. Staff view (optional)
**Pre-filled** and **Changes From Pre-fill** are on the Apprentice Sign Up form in a
**Pre-fill** section. Re-run `Build-ApprenticeSignUpForm.ps1` (without `-TableName`) to add
them. To see them in a list, add them to the *Active Apprentice Sign Ups* view.

## Test checklist (fresh private window)
1. **Matching record:**
   1. In **Applicant Record (test)**, add a record with your email address, a mobile and an employer.
   2. Add a **Sign Up Invite** with **Email Sent To** = the same address.
   3. Within a minute, the invite's **Prefill Data** fills with text starting `{"@odata.etag"…`.
2. **Open the link.** The yellow "We've filled in the details we already have" note shows,
   and the fields are filled in. The USI permission box is **not** ticked.
3. **Change the mobile, then step to the end.** The **Review your details** page shows every
   answer, with an **Updated** tag on the mobile.
4. **Click Edit** on a section and change something. **Save and review** brings you back.
5. **Submit**, then check the new Apprentice Sign Up record:
   - **Pre-filled = Yes**.
   - **Changes From Pre-fill** shows `Your Mobile Number: "old" → "new"`.
   - Within a minute, the invite is **Used** and its **Prefill Data** is empty.
6. **Invite with no matching email:** the form opens blank with no note, as before.
7. **Fix an invite's email** to one that has a record. **Prefill Data** fills within a minute.

## Troubleshooting
- **`Enable-Prefill.ps1` stops with 0x80040224 "The given key was not present in the
  dictionary":** fixed in this version. If the script still can't update the setting, it
  prints the exact value to set by hand:
  1. In **Power Pages Management → Site Settings**, open
     `Webapi/bnsw_apprenticesignup/fields`.
  2. Add `,bnsw_prefilled,bnsw_prefillchanges` to the end of **Value**.
  3. Click **Save**, then **Sync** in Studio.
- **Every code says "couldn't find":** the template was pasted before step 1 ran, so the
  Prefill Data column doesn't exist yet. Run the script, then **Sync**.
- **The form opens blank although Prefill Data is filled:**
  - The flow may have used the wrong table, so its column names don't match the form's.
  - Or the page was opened before the flow finished; reload it.
  - The browser console shows "Pre-fill data couldn't be read" if the data is damaged.
- **Submit fails with 403 / "not enabled for Web API fields":** the two new columns aren't
  in `Webapi/bnsw_apprenticesignup/fields`. Re-run `Enable-Prefill.ps1`, then **Sync**.
- **A choice shows as blank:** the source record holds a choice value the form doesn't
  have. The applicant just picks one.

## Switching to your real table later
Only the prefill flow changes. The page and scripts stay the same.

- **If the real table's columns have different names or choice values:**
  1. Add a **Compose** step after **List rows** that builds the record with this form's
     names, for example:
     ```
     {
       "bnsw_firstname": "@{first(outputs('List_rows')?['body/value'])?['cr5a1_givenname']}",
       "bnsw_mobile":    "@{first(outputs('List_rows')?['body/value'])?['cr5a1_mobilephone']}",
       "bnsw_homestate": @{first(outputs('List_rows')?['body/value'])?['cr5a1_state']}
     }
     ```
  2. Set Prefill Data to `string(outputs('Compose'))`.
- **Choice columns** must use this form's values. See `dataverse-table-schema.csv`, e.g.
  NSW = 1.
- **Dates** must be date-only (`2006-07-21`), and **Yes/No** columns `true`/`false`.

Send the real table's column list (or run its export) and the mapping can be written for you.
