# Applying the October 2026 form changes

These steps bring the solution in line with the latest MS Forms form. What changed and why
is in `FORM-CROSSCHECK.md`.

Do this in **dev**, in this order (about 30 minutes). The page sends the new columns, so the
Dataverse and site-setting steps must come **before** you paste the template. Otherwise
submissions fail.

## 1. Table: new columns and updated choice lists
```powershell
.\Create-ApprenticeSignUpTable.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw -SyncChoices -WhatIf
# check the "What if" lines, then run again without -WhatIf
```
**Adds 6 columns:**
- Support Indicator Quiz ID;
- Quiz Literacy result;
- Quiz Numeracy result;
- Country of Legal Residence;
- Born in Australia? (Australia / Other);
- Language Spoken at Home (Other).

**Updates 6 choice lists** (`-SyncChoices`):

| Column | What changes |
|---|---|
| Gender | Female, Male, Prefer not to say (removes Non-binary and Other) |
| Citizenship | Relabels to the form's 3 options and removes Permanent Resident |
| Language at home | "Language other than English" becomes "Other" |
| Aboriginal / TSI | Removes "Prefer not to say" |
| School level | Starts at "Yr 8 or below" |
| Highest schooling | Replaced with the form's list: Did not go to school, then Yr 8 or below up to Yr 12 or equivalent |

The script ends with "Verification passed".

> **About removed options:** a test record that held a removed value (e.g. Gender = Non-binary)
> keeps the number but shows no label. That's fine for test data. Don't use `-SyncChoices`
> this way once there's real data.

It also writes a fresh `apprentice-signup.webtemplate.bnsw.liquid` into the script folder.
That's the same file as in the package.

## 2. Website: allow the new columns
```powershell
.\Configure-ApprenticeSignUpSecurity.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw -WebsiteName "ASA Sign Up - site-9diru"
```
This updates `Webapi/bnsw_apprenticesignup/fields` with the 6 new columns. Everything else
it checks is already in place and is skipped.

If it can't update the setting, do it by hand:
1. In **Power Pages Management → Site Settings**, open `Webapi/bnsw_apprenticesignup/fields`.
2. Add this to the end of **Value**:
   ```
   ,bnsw_quizid,bnsw_quizliteracy,bnsw_quiznumeracy,bnsw_citizenshipcountry,bnsw_bornaustralia,bnsw_languageother
   ```
3. Click **Save**.

## 3. Staff form
```powershell
.\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw
```
This adds a **Government Requirements** section to the Applicant tab. It also puts the
three new Background fields next to Citizenship, Country of Birth and Language.

## 4. Send-to-applicant flow
In the **Get draft** step, replace **Select columns** with the updated list in
`STAFF-DRAFTS.md` (step 4.2). It now includes the new columns, so staff-entered values are
pre-filled too.

## 5. Web template
In **Web Templates → Apprentice Sign Up → Source**, paste the new
`apprentice-signup.webtemplate.bnsw.liquid`, click **Save**, then **Sync** in Studio.

## What applicants will notice
- **A new first section, "Government Requirements":** the Support Indicator quiz link, then
  the Quiz ID and two results (0–5).
- **USI:** "Do you know your USI?", with a link to usi.gov.au. Permission is now **Yes / No**,
  and No is allowed.
- **Follow-up questions:** "Other" citizenship asks for the country of residence and visa
  details; country of birth is **Australia / Other**; "Other" language asks which one.
- **Choice lists match the MS Form.**
- **Apprenticeship details:** employer, start date, job title and workplace name are
  optional. If staff pre-filled them, employer, start date, job title and qualification are
  **locked**, with "call us if it's wrong".
- **Dates:**
  - "Have you commenced this qualification before…" is reworded.
  - Previous-work end date can be in the future (the day before a future start date).
  - Completed-study dates are **month and year**.
- **More help text** from the MS Form.

## Test checklist
1. **A full submission with every branch on:**
   - under 18;
   - studied before;
   - worked for the business before (part time);
   - citizenship Other;
   - born overseas;
   - another language at home.

   Check the new columns hold values on the record: quiz results as numbers, completed-study
   months as the 1st of the month.
2. **Quiz validation:** a literacy result of 7 is refused, and 0–5 is accepted.
3. **USI:** answer No to both USI questions. The form submits, and the record shows USI
   permission = No.
4. **Staff draft:** fill employer and qualification and send it. On the link, both are
   read-only. Job title, if blank, is editable.
5. **Previous work:** an end date after today is accepted.
