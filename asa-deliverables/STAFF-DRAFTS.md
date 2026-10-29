# Staff drafts: staff prepare the form, the applicant reviews and approves

**The process:**
1. **Staff create the record.** They start an **Apprentice Sign Up** record and fill in what
   they know, or just the name and email for a blank form.
2. **Staff send it.** They set **Stage = Sent to applicant**. The applicant is emailed their
   personal link.
3. **The applicant reviews and approves.** They open the form, already filled in, and check
   and correct each section. On the **Review your details** page they tick *"I confirm the
   details above are correct"*, then click **Approve and submit**.
4. **The applicant's version replaces the draft.** The staff draft is marked **Replaced**
   and made inactive (kept for audit). The approved record has the same owner, a link back
   to the draft, and a list of everything the applicant changed.

Replace `bnsw_` with your prefix if it differs.

## How it works

```
Staff: new Apprentice Sign Up (Stage = Draft) ──► set Stage = Sent to applicant
        │
        ▼  "send to applicant" flow
Sign Up Invite (code generated, Draft = that record, Prefill Data = copy of the draft)
        │                                   │
        │  existing email flow              │  page reads Prefill Data during the code check
        ▼                                   ▼
Applicant email with link ──────────► form pre-filled ──► review ──► Approve and submit
                                                                       │
                                     new Apprentice Sign Up record ◄───┘
                                     (Stage = Submitted, Pre-filled = Yes, Changes From Pre-fill)
        │  verification flow
        ▼
Invite = Used, Prefill Data cleared; draft = Replaced + inactive;
submission gets the draft's owner and a Staff Draft link
```

**Why the applicant's version is a new record, not an edit of the draft.** The website can
only *create* records. Letting anonymous visitors edit existing ones would let anyone who
learned a record ID change it. So the approved version is a fresh record that replaces the
draft. Staff still see one active record per applicant.

**What is pre-filled:** everything staff entered, sensitive fields included, **except the
Yes/No questions**:
- Do you have a USI?
- Postal same as home?
- Disability
- Still at school?
- Commenced before today?
- Previously worked with this business?
- Completed a qualification?
- Currently studying?
- Under 18?

Dataverse Yes/No columns are never blank, so an unanswered one reads as "No". Pre-filling
them would show "No" answers nobody gave. The applicant answers these themselves, which
takes seconds. Consent boxes are never pre-filled either.

## Setup (about 45 minutes)

**Prerequisites:** the tracking-code check and `Enable-Prefill.ps1` are already done. They
are, if pre-fill is working.

### 1. Run the script
```powershell
.\Enable-StaffDrafts.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw -WhatIf
# then again without -WhatIf
```
It adds:
- **Stage** (Draft / Sent to applicant / Submitted / Replaced; Draft is the default on the staff form);
- a **Staff Draft** link on Apprentice Sign Up;
- a **Draft** link on Sign Up Invite.

It also makes the 21 *Business Required* columns **Optional**, so staff can save a
part-filled draft. The website still requires every answer from the applicant. If any
column can't be changed automatically, it tells you which, so you can set them to Optional
by hand (Tables → Apprentice Sign Up → Columns).

### 2. Put Stage on the staff form
```powershell
.\Build-ApprenticeSignUpForm.ps1 -EnvironmentUrl https://yourorg.crm6.dynamics.com `
    -SolutionUniqueName ASATestAIApp -Prefix bnsw
```
This adds **Stage** and **Staff Draft** to the *Sign-Up* section, and **Stage** to the
*Active Apprentice Sign Ups* view.

### 3. Turn OFF the email-matching prefill flow
If you built `ASA Sign Up – prefill invite` from `PREFILL.md`, turn it **Off**, or delete
it. Otherwise it overwrites the draft's details on the invite with the old source-table
lookup. You no longer need the *Applicant Record (test)* table either.

### 4. Build the "send to applicant" flow (about 20 minutes)
In make.powerapps.com, go to **Solutions → ASATestAIApp → New → Automation → Cloud flow →
Automated**. Name it `ASA Sign Up – send to applicant`. Pick the trigger Dataverse **When a
row is added, modified or deleted**, then click **Create**.

1. **Trigger:** Change type **Added or Modified**, table **Apprentice Sign Ups**, scope
   **Organization**. Under **… → Settings → Trigger conditions**, add:
   ```
   @and(equals(triggerOutputs()?['body/bnsw_stage'], 2), not(empty(triggerOutputs()?['body/bnsw_email'])))
   ```
   The flow then runs only for records at *Sent to applicant*. Saving a draft that's
   already sent refreshes what the applicant sees.

2. **Dataverse → Get a row by ID.** Rename the step to **Get draft**.
   - Table: **Apprentice Sign Ups**.
   - Row ID: the trigger's **Apprentice Sign Up** (unique identifier).
   - Select columns: paste this list, which is everything except the Yes/No questions
     (updated for the October 2026 form changes):
     ```
     bnsw_quizid,bnsw_quizliteracy,bnsw_quiznumeracy,bnsw_usinumber,bnsw_firstname,bnsw_middlename,bnsw_lastname,bnsw_previousname,bnsw_dateofbirth,bnsw_homestreet,bnsw_homesuburb,bnsw_homepostcode,bnsw_homestate,bnsw_postaladdress,bnsw_postalsuburb,bnsw_postalpostcode,bnsw_mobile,bnsw_email,bnsw_gender,bnsw_citizenship,bnsw_visadetails,bnsw_citizenshipcountry,bnsw_bornaustralia,bnsw_countryofbirth,bnsw_languageathome,bnsw_languageother,bnsw_indigenousstatus,bnsw_schoollevel,bnsw_highestschooling,bnsw_monthcompletedschool,bnsw_yearcompletedschool,bnsw_employer,bnsw_apprenticeshipstartdate,bnsw_jobtitle,bnsw_qualification,bnsw_priorworkstarted,bnsw_priorworkended,bnsw_priorworkemploymenttype,bnsw_priorworkhoursperweek,bnsw_workplacename,bnsw_workplaceaddress,bnsw_qualificationdetails,bnsw_qualificationstudystarted,bnsw_qualificationstudyfinished,bnsw_currentstudyname,bnsw_currentstudystartdate,bnsw_guardianfirstname,bnsw_guardianlastname,bnsw_guardianaddress,bnsw_guardiansuburb,bnsw_guardianstate,bnsw_guardianpostcode,bnsw_guardianmobile,bnsw_guardianemail
     ```

3. **Dataverse → List rows.** Rename the step to **Find invite**.
   - Table: **Sign Up Invites**. Row count: `1`.
   - Filter rows: type the text below, inserting the trigger's **Apprentice Sign Up** id
     where shown:
     ```
     _bnsw_draft_value eq <Apprentice Sign Up id> and bnsw_invitestatus eq 1
     ```

4. **Condition:** expression `length(outputs('Find_invite')?['body/value'])` **is greater
   than** `0`.

   **If yes** (already sent, so refresh it):
   1. **Dataverse → Update a row:**
      - Table: **Sign Up Invites**.
      - Row ID: `first(outputs('Find_invite')?['body/value'])?['bnsw_signupinviteid']`
      - Prefill Data: `string(outputs('Get_draft')?['body'])`
      - Applicant Name: `trim(concat(triggerOutputs()?['body/bnsw_firstname'], ' ', triggerOutputs()?['body/bnsw_lastname']))`
      - **Leave Email Sent To blank here.** Writing it on every save, even with the same
        value, makes the email flow re-send the link each time.
   2. **Condition** (has the email changed?). Left (expression), operator **is equal to**,
      right `false`:
      ```
      equals(toLower(trim(coalesce(first(outputs('Find_invite')?['body/value'])?['bnsw_inviteemail'], ''))), toLower(trim(coalesce(triggerOutputs()?['body/bnsw_email'], ''))))
      ```
      - **If yes:** **Dataverse → Update a row**, table **Sign Up Invites**, the same Row ID,
        **Email Sent To** = the trigger's **Email**. The email flow then sends the link to
        the new address.
      - **If no:** nothing.

   **If no** (first send):
   1. **Dataverse → Add a new row.** Rename the step to **Create invite**.
      - Table: **Sign Up Invites**.
      - Applicant Name: the same expression as above.
      - Email Sent To: the trigger's **Email**.
      - Invite Status: **Issued**.
      - Prefill Data: `string(outputs('Get_draft')?['body'])`
      - **Draft (Apprentice Sign Ups):** expression (in the **fx** editor):
        `concat('bnsw_apprenticesignups(', triggerOutputs()?['body/bnsw_apprenticesignupid'], ')')`
      - *Optional:* Expires On: `addDays(utcNow(), 30, 'yyyy-MM-dd')`
   2. **Dataverse → Update a row:**
      - Table: **Apprentice Sign Ups**.
      - Row ID: the trigger's **Apprentice Sign Up**.
      - Sign Up Tracking Code: `outputs('Create_invite')?['body/bnsw_trackingcode']`

      This shows the code on the draft.

5. **Save.** The existing **email invite link** flow sends the email when the invite is
   created. **Check its trigger's Select columns is exactly `bnsw_inviteemail`.** If it's
   blank, every refresh of the invite re-sends the link. Nothing to change there except, optionally, the wording (step 6).

> The flow runs twice on the first send, because its last step updates the draft. The second
> run just refreshes the invite. That's expected.

### 5. Add the draft steps to the verification flow
> **The complete, current flow is in `VERIFY-FLOW.md`.** Use it to check or rebuild yours.
> **Important:** add the trigger condition
> `@not(empty(triggerOutputs()?['body/bnsw_trackingcode']))`. Without it, the flow also runs
> on new staff drafts and marks them "Invalid code".

Open `ASA Sign Up – verify tracking code`.

**a. Mark the submission as Submitted.** In the last **Update a row** (the one that sets
**Verification Status**), also set **Stage = Submitted**.

**b. Replace the draft.** In **Case 1** → the **No** (valid) branch, after the **Update a
row** that marks the invite **Used**, add:

1. **Condition:** expression `empty(outputs('Invite')?['_bnsw_draft_value'])` **is equal
   to** `false`.
2. **If yes:**
   1. **Dataverse → Get a row by ID.** Rename the step to **Get draft**.
      - Table: **Apprentice Sign Ups**.
      - Row ID: `outputs('Invite')?['_bnsw_draft_value']`
      - Select columns: `_ownerid_value` (a lookup must be listed by its `_…_value` name; `ownerid` returns nothing)
   2. **Dataverse → Update a row** (the draft):
      - Table: **Apprentice Sign Ups**.
      - Row ID: `outputs('Invite')?['_bnsw_draft_value']`
      - **Stage = Replaced**, **Status = Inactive**, **Status Reason = Inactive**.
   3. **Dataverse → Update a row** (the submission):
      - Table: **Apprentice Sign Ups**.
      - Row ID: the trigger's **Apprentice Sign Up**.
      - **Staff Draft:** expression (in the **fx** editor):
        `concat('bnsw_apprenticesignups(', outputs('Invite')?['_bnsw_draft_value'], ')')`
      - **Owner** (*Enter custom value*):
        ```
        concat(outputs('Get_draft')?['body/_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname'], 's(', outputs('Get_draft')?['body/_ownerid_value'], ')')
        ```
3. **Save.**

Only a **verified** submission replaces the draft. If the code was cancelled, already used
or expired, the draft stays as it is and the submission is flagged as before.

### 6. Email wording (optional)
In the email flow, the message can now say the form has been started for them, for example:
> Hi @{triggerOutputs()?['body/bnsw_applicantname']},
>
> We've started your apprenticeship / traineeship sign-up. Please check the details, correct
> anything that's wrong, and approve it:
> [Review and approve my details]
>
> This link is personal to you. For help call 1300 363 831.

### 7. Require an email before sending (business rule, about 5 minutes)
The flow ignores drafts with no email (step 4's trigger condition), but staff wouldn't know
why nothing happened. This rule stops the save and tells them.
1. In make.powerapps.com, go to **Solutions → ASATestAIApp → Tables → Apprentice Sign Up →
   Business rules → + New business rule**.
2. Click the **Condition** box, and in the panel on the right:
   - Rule 1: **Entity** · Field **Stage** · Operator **Equals** · Type **Value** · Value
     **Sent to applicant**.
   - **+ New**, Rule 2: Field **Email** · Operator **Does not contain data**.
   - Logic **AND**, then click **Apply**.
3. From **Components**, drag **Show Error Message** onto the **✓** side. Field **Email**,
   Message `Enter the applicant's email before sending.`, then click **Apply**.
4. At the top right, set **Scope = Entity**, so it's checked on the server too.
5. Name it `Require email before sending`, then click **Save** and **Activate**.

To also require names before sending, repeat with **First Name** and **Last Name**.

### 8. Paste the updated web template
**Web Templates → Apprentice Sign Up → Source:** paste the new
`apprentice-signup.webtemplate.bnsw.liquid`, **Save**, then **Sync**. It adds the *"I
confirm"* tick and the **Approve and submit** button.

## Staff guide (share with the team)

| To… | Do this |
|---|---|
| **Prepare a sign-up** | Apprentice Sign Ups → **+ New**. Fill in what you know. You need at least first name, last name and email. **Save** (Stage = Draft). |
| **Send a blank form** | Enter only the name and email, then send it as below. |
| **Send it to the applicant** | Set **Stage = Sent to applicant**, then **Save**. Within a minute the **Sign Up Tracking Code** appears and the applicant gets the email. |
| **Fix something after sending** | Edit the draft and **Save**. The applicant sees the change next time they open the link, as long as they haven't submitted. |
| **Send to a different email** | Change **Email** and **Save**. The link goes to the new address. |
| **Stop a link working** | Open the draft → **Related → Sign Up Invites**. Set the invite to **Cancelled**. To send a fresh link, set Stage back to *Draft*, then to *Sent to applicant*. |
| **See what the applicant changed** | Open the approved record: **Pre-fill → Changes From Pre-fill**. The original draft is under **Staff Draft**. |
| **Find drafts waiting on applicants** | Filter the view on **Stage = Sent to applicant**. |

After the applicant approves, the draft disappears from active views (it's **Replaced** and
inactive). The approved record takes its place with the same owner. Staff can also still
create a **Sign Up Invite** directly, with no draft, and the applicant starts from a blank
form.

## Test checklist
1. **Prepare and send:**
   1. Create a draft with your email, a mobile, an employer and a date of birth.
   2. Set **Sent to applicant**.
   3. Within a minute: the draft shows a tracking code, an invite exists with **Draft** set
      and **Prefill Data** filled, and the email arrives.
2. **Open the link:**
   - The fields are pre-filled, including the date of birth.
   - The Yes/No questions are blank.
   - USI permission isn't ticked.
3. **Change after sending:** edit the draft's employer and save. Reload the link, and the new
   employer shows.
4. **Change the mobile,** then go to the review page:
   1. Click **Approve and submit** without the tick. A "Please confirm" message shows.
   2. Tick the box, then submit.
5. **Within a minute:**
   - The new record shows **Submitted**, **Verified**, **Pre-filled = Yes**, **Changes From
     Pre-fill** listing the mobile, **Staff Draft** set, and the same owner as the draft.
   - The draft is **Replaced** and inactive.
   - The invite is **Used**, with Prefill Data empty.
6. **Open the link again:** "already submitted".
7. **Blank form:** a draft with only name and email. The form opens with just those filled in.
8. **Invite created directly, with no draft:** the form opens blank, and no draft is touched
   on submit.

## Troubleshooting
- **The link is re-sent every time staff save the draft:**
  - the refresh step writes **Email Sent To** (step 4, If yes; it must only be written when
    the email changes); or
  - the email flow's trigger has no **Select columns** (it must be `bnsw_inviteemail`).
- **No invite or email after setting "Sent to applicant":** check the *send to applicant*
  flow's run history. Common causes:
  - the trigger condition has a typo;
  - the draft has no email: the flow skips it. Add the email and save again. The business
    rule (step 7) stops this happening.
- **The form opens blank for a sent draft:** the old email-matching prefill flow is still on
  and overwrote Prefill Data (step 3). Turn it off, then save the draft again to refresh.
- **Staff can't save a draft ("required field"):** a column is still Business Required.
  Re-run `Enable-StaffDrafts.ps1`, or set it to Optional by hand.
- **The draft wasn't replaced:** the submission wasn't **Verified** (see its Verification
  Status), or step 5b isn't in the *valid* branch.
