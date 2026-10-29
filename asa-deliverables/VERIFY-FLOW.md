# ASA Sign Up – verify tracking code (complete flow)

This is the full, current version of the verification flow. It combines:
- the tracking-code check;
- clearing pre-fill data;
- replacing staff drafts.

It runs once for every new Apprentice Sign Up record that **came from the website**.

Replace `bnsw_` with your prefix if it differs. **Name the steps exactly as shown**: the
expressions refer to them by name, with spaces becoming `_` (e.g. `List rows` → `List_rows`).

## What it does

| The submitted code… | Verification Status | Invite | Staff draft |
|---|---|---|---|
| Issued and not expired | **Verified** (2) | **Used**, Used On set, Prefill Data cleared | **Replaced** + inactive. The submission gets its owner and a Staff Draft link. |
| Issued but past Expires On | **Code expired** (5) | unchanged | unchanged |
| Already Used | **Code already used** (4) | unchanged | unchanged |
| Cancelled, or not found | **Invalid code** (3) | unchanged | unchanged |

Every submission also gets **Stage = Submitted** and, if its invite was found, the **Sign Up
Invite** link.

## Overview

```
Trigger: Apprentice Sign Up added  (only rows that have a tracking code)
1  Initialize variable  Result = 3
2  List rows            Sign Up Invites where code = submitted code   (Row count 1)
3  Condition: an invite was found?
   ├─ Yes
   │   3a  Compose "Invite" = first invite
   │   3b  Switch on Invite Status
   │       ├─ Case 1 (Issued)
   │       │    Condition: expired?
   │       │    ├─ Yes → Set Result = 5
   │       │    └─ No  → Set Result = 2
   │       │            Update invite: Used, Used On, Prefill Data = null
   │       │            Condition: invite has a draft?
   │       │            └─ Yes → Get draft (owner)
   │       │                     Update draft: Stage Replaced, Inactive
   │       │                     Update submission: Staff Draft, Owner
   │       ├─ Case 2 (Used) → Set Result = 4
   │       └─ Default (Cancelled) → nothing (Result stays 3)
   │   3c  Update submission: Sign Up Invite link
   └─ No → nothing
4  Update submission: Verification Status = Result, Stage = Submitted
```

## Step by step

### Trigger
Dataverse **When a row is added, modified or deleted**:

| Setting | Value |
|---|---|
| Change type | **Added** |
| Table name | **Apprentice Sign Ups** |
| Scope | **Organization** |

**Trigger condition** (**…** on the trigger → **Settings** → **Trigger conditions** → **+ Add**):
```
@not(empty(triggerOutputs()?['body/bnsw_trackingcode']))
```
**This matters now that staff create drafts in the same table.** A staff draft has no
tracking code when it's created; the send-to-applicant flow adds it later. Without this
condition the flow would mark every new staff draft "Invalid code". Website submissions
always carry a code.

### 1. Initialize variable
- Name: `Result`. Type: **Integer**. Value: `3`.

### 2. List rows (Dataverse)
Keep the step name **List rows**.

| Setting | Value |
|---|---|
| Table name | **Sign Up Invites** |
| Select columns | *(leave blank, so the Draft link and Expires On are included)* |
| Filter rows | type `bnsw_trackingcode eq '`, then add the **expression** below, then type `'` |
| Row count | `1` |

```
replace(triggerOutputs()?['body/bnsw_trackingcode'], '''', '''''')
```
The filter box should end up reading `bnsw_trackingcode eq '` + *[expression]* + `'`.

### 3. Condition: was an invite found?
Left: expression `length(outputs('List_rows')?['body/value'])`. Operator: **is greater than**.
Right: `0`.

#### If yes

**3a. Compose.** Rename the step to **Invite**. Inputs: expression
```
first(outputs('List_rows')?['body/value'])
```

**3b. Switch.** On: expression `outputs('Invite')?['bnsw_invitestatus']`

- **Case 1:** Equals `1` (Issued)
  - **Condition:** rename it to **Expired?**. Left: the expression below. Operator: **is
    equal to**. Right: `true`.
    ```
    and(not(empty(outputs('Invite')?['bnsw_expireson'])), less(outputs('Invite')?['bnsw_expireson'], formatDateTime(utcNow(), 'yyyy-MM-dd')))
    ```
    - **If yes:** **Set variable** `Result` = `5`
    - **If no** (a valid code):
      1. **Set variable** `Result` = `2`
      2. **Update a row (Dataverse).** Rename it to **Mark invite used**.
         - Table: **Sign Up Invites**.
         - Row ID: `outputs('Invite')?['bnsw_signupinviteid']`
         - **Invite Status:** Used.
         - **Used On:** `utcNow()`
         - **Prefill Data:** expression `null` (under Show advanced options).
      3. **Condition.** Rename it to **Has draft?**. Left: the expression below. Operator:
         **is equal to**. Right: `false`.
         ```
         empty(outputs('Invite')?['_bnsw_draft_value'])
         ```
         - **If yes:**
           1. **Get a row by ID (Dataverse).** Rename it to **Get draft**.
              - Table: **Apprentice Sign Ups**.
              - Row ID: `outputs('Invite')?['_bnsw_draft_value']`
              - Select columns: `_ownerid_value` (a lookup must be listed by its `_…_value` name; `ownerid` returns nothing)
           2. **Update a row.** Rename it to **Replace draft**.
              - Table: **Apprentice Sign Ups**.
              - Row ID: `outputs('Invite')?['_bnsw_draft_value']`
              - **Stage:** Replaced. **Status:** Inactive. **Status Reason:** Inactive.
           3. **Update a row.** Rename it to **Link submission to draft**.
              - Table: **Apprentice Sign Ups**.
              - Row ID: the trigger's **Apprentice Sign Up** (Dynamic content).
              - **Staff Draft (Apprentice Sign Ups):** expression (in the **fx** editor):
                ```
                concat('bnsw_apprenticesignups(', outputs('Invite')?['_bnsw_draft_value'], ')')
                ```
              - **Owner** (*Enter custom value*, expression):
                ```
                concat(coalesce(outputs('Get_draft')?['body/_ownerid_type'], 'systemusers'), '(', outputs('Get_draft')?['body/_ownerid_value'], ')')
                ```
         - **If no:** nothing. This was an invite created without a draft.
- **Case 2:** Equals `2` (Used): **Set variable** `Result` = `4`.
- **Default** (Cancelled, or anything else): leave it empty. Result stays `3`.

**3c. Update a row.** Rename it to **Link invite**. It goes **after the Switch**, still
inside **If yes**.
- Table: **Apprentice Sign Ups**.
- Row ID: the trigger's **Apprentice Sign Up**.
- **Sign Up Invite (Sign Up Invites):** expression (in the **fx** editor):
  ```
  concat('bnsw_signupinvites(', outputs('Invite')?['bnsw_signupinviteid'], ')')
  ```

#### If no
Nothing. Result stays `3` (Invalid code).

### 4. Update a row: final result
This goes **after the condition**, at the top level, so it always runs. Rename it to **Set
verification status**.
- Table: **Apprentice Sign Ups**.
- Row ID: the trigger's **Apprentice Sign Up**.
- **Verification Status** (*Enter custom value*): `variables('Result')`
- **Stage** (*Enter custom value*): `3`, which is Submitted.

**Save.** The flow turns on automatically.

## Checking your version
Common reasons a hand-built version misbehaves:

| Symptom | Likely cause |
|---|---|
| Every staff draft becomes "Invalid code" | The **trigger condition** is missing. |
| Everything is "Invalid code", even valid codes | The filter is wrong. It must read exactly `bnsw_trackingcode eq '<expression>'`, quotes included. Or **Row count** isn't 1, or the step isn't named **List rows**. |
| Valid codes stay "Pending" | The flow failed. Open **28-day run history** and look for the red step. Usually it's an expression referring to a step name that's different in your flow (`Invite`, `List_rows`, `Get_draft`). |
| Expired codes come out Verified | The **Expired?** condition's right side must be `true` with **is equal to**. Check Expires On is a *Date only* column. |
| Invite not marked Used | **Mark invite used** is in the wrong branch. It belongs in Case 1 → Expired? → **If no**. |
| Draft not replaced | The invite has no **Draft** set (it wasn't created by the send-to-applicant flow), or **Has draft?** compares to `true` instead of `false`. |
| Error setting Owner, e.g. "`systemusers()` is invalid" | The Owner value came out empty: the step isn't named exactly **Get draft**, so `outputs('Get_draft')` finds nothing. Rename the step, or change `Get_draft` in the expression to your step's name. Check **Get draft → Show raw outputs** has `_ownerid_value`. If the body only has the record id, **Select columns** says `ownerid`: change it to `_ownerid_value`. |
| A lookup line is rejected as an invalid expression | In the **fx** editor, use the `concat('bnsw_…s(', …, ')')` form shown. The `bnsw_…s(@{…})` form only works typed as plain text in the box. |
| "Resource not found for the segment" | The lookup value must use the table's **plural** (entity set) name: `bnsw_apprenticesignups(…)` / `bnsw_signupinvites(…)`. Check it in Tables → table → Properties → Advanced → *Entity set name*. |

## Testing
1. **Valid code from a staff draft:** submission **Verified**, Stage Submitted. Invite Used,
   Prefill Data empty. Draft **Replaced** and inactive. Submission has Staff Draft set and
   the draft's owner.
2. **The same link again:** "already submitted". If you force a second submission, it's
   flagged **Code already used**.
3. **Invite with Expires On = yesterday:** **Code expired**.
4. **Cancelled invite:** **Invalid code**.
5. **New staff draft:** the flow does **not** run. Check the run history: no new run.
