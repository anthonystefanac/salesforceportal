# Alliance Client Portal — Phase 1 MVP

A Salesforce DX (SFDX) source project implementing the "Alliance Client Portal"
described in `Alliance_Client_Portal_Phase_1_MVP.pptx`: a Salesforce Experience
Cloud portal that lets Business NSW/Alliance's staffing clients (hospitals,
aged care, corporate accounts) **request** shift/staffing demand, **track**
its fulfilment status, and **view invoices** — a controlled extension of the
existing "Project Elevate" ecosystem (Salesforce + Bullhorn/Classic Scheduler
+ 2Cloud9), not a new platform.

Note: the deck's third MVP job, timesheet approval, was subsequently descoped
at the user's request and is not part of this build — see "Scope" below.

## What's in this repo

```
force-app/main/default/
  objects/            Facility__c, Ward__c, Staffing_Request__c, Invoice__c,
                       plus Case field extensions (Related_Staffing_Request__c,
                       Portal_Request_Type__c) for the Support/Query screen
  classes/             Apex controllers, domain services, mocked integration
                       boundaries, notification/validation services, and their test classes
  triggers/            StaffingRequestTrigger — fires the Start/End Time
                       validation and the submit/status-change notification
                       emails (see "Data validation" / "Notifications" below)
  lwc/                 13 Lightning Web Components covering the current screens
                       (plus timeFormatUtils, a shared non-visual helper module),
                       including an added Calendar screen for reviewing bookings by day,
                       a header user/account badge (portalUserBadge), and a Reporting
                       screen (staffingRequestReporting)
  permissionsets/      Alliance_Client_Portal_User — assign to every portal Contact's User
  sharingSets/         Grants same-Account contacts shared read access
  tabs/                Custom object tabs
  networks/            Placeholder only — see "Experience Cloud site setup" below
```

### Screens → components

| Screen | Components |
|---|---|
| Home dashboard | `portalHomeDashboard` (+ `portalDashboardTile`) |
| Request staff | `requestStaffForm` (+ `facilityPicker`, `wardPicker`) |
| My requests | `myStaffingRequests` (+ `requestStatusBadge`) |
| Calendar | `requestStaffCalendar` (+ `requestStatusBadge`) |
| Invoices | `invoiceList` |
| Support / query | `supportRequestForm` |
| Reporting | `staffingRequestReporting` (+ `requestStatusBadge`) |

`requestStaffCalendar` (nav label "Calendar") is an added convenience
screen, not part of the original 6-screen deck: a month grid showing a
badge on any day with existing requests. Clicking a day shows that day's
bookings (Quantity + Role, Facility/Ward, Status) plus a **Request Staff**
button that navigates to the Request Staff page with the date carried in
`state`, rather than embedding the request form on this page — Calendar is
for reviewing what's already booked on a day, Request Staff is where you
actually submit one. Each booking itself is also clickable, navigating to My
Requests filtered to that shift date. It reuses the existing
`Staffing_Request__c` object and `StaffingRequestController` — no new Apex or
objects were needed for it.

The Home dashboard's five tiles — **Open Requests**, **Unable to Fill
Shifts** (the tile label — the underlying `unfilled` filter key and
`unfilledShiftCount` field are unchanged, since renaming those would be
churn for no visible benefit), **Filled Shifts**, **Cancelled Shifts**, and
**Overdue Invoices** — the Calendar's Request Staff button, each Calendar
booking, and Support's
post-submit confirmation are all clickable/navigable and deep-link across
pages: **Open**, **Filled**, and **Cancelled** go to My Requests filtered to
their matching status (`open` excludes Filled/Unable to Fill/Cancelled;
`filled`/`cancelled` are exact `Status__c` matches). **Unable to Fill Shifts**
is the one exception — it goes to **Reporting** instead (`REPORTING_PAGE_NAME`
in `TILE_NAVIGATION`, no `state`), since My Requests now only shows shifts
from today onwards (see below) and the daily overdue job only ever sets
Unable to Fill on a shift whose date has already passed — routing that tile
to My Requests would always land on an empty page. Overdue
Invoices goes to Invoices, a selected Calendar day goes to Request Staff
with that date pre-filled, a Calendar booking goes to My Requests filtered
to its shift date, and a submitted Support request offers a "View My
Requests" button — each filtered destination has a "Show all" control to
clear the filter. `PortalDashboardController.getDashboardSummary()` counts
all four statuses with the same `Facility__r.Account__c = :accountId`
pattern as the existing Open Requests/Unfilled Shifts counts, and adds
`AND Shift_Date__c >= TODAY` to the Filled and Cancelled counts specifically
so they match what My Requests' own today-onwards scope will actually show
after clicking through (Unable to Fill stays an all-time count, since it's
inherently historical and routes to Reporting anyway) — no new
object or sharing considerations, since they're the same object and field
already covered by the Sharing Set. The tile grid caps at **3 columns**
(`grid-template-columns: repeat(3, ...)` in `portalHomeDashboard.css`, not
the auto-fit/minmax it used before) so 5 tiles wrap to 2 rows instead of
spreading across one on wide screens, with breakpoints down to 2 columns
and then 1 on narrower viewports. This uses
`NavigationMixin` with `comm__namedPage` and a `state` parameter, which the
destination component reads back via `@wire(CurrentPageReference)`
(`myStaffingRequests` reads both `state.filter` and `state.shiftDate`;
`invoiceList` reads `state.filter`; `requestStaffForm` reads
`state.defaultDate`). **The target page names are set to the real
Experience Builder page API names** (`My_Requests__c`, `Invoices__c` in
`TILE_NAVIGATION` inside `portalHomeDashboard.js`) confirmed from the live
site, **except `Request_Staff__c`** (`REQUEST_STAFF_PAGE_NAME` in
`requestStaffCalendar.js`) **and `Reporting__c`** (`REPORTING_PAGE_NAME` in
`portalHomeDashboard.js`), which are still placeholders — confirm/update
them the same way the other two were, from each page's own Settings panel
in Experience Builder once it exists. If any of these pages is
ever recreated or renamed, update the matching constant to its new API Name.

`myStaffingRequests` and `invoiceList` both have a search box (matches
request/facility/ward/role/specialty/status, or invoice number/status) and
sortable column headers (click to sort ascending, click again to toggle
descending) — both are client-side, layered on top of the existing deep-link
filters, so no new Apex was needed. `myStaffingRequests` **only shows shifts
from today onwards, sorted by Shift Date ascending** (soonest first) by
default — set via `sortField`/`sortDirection`'s initial values rather than a
click, so the "Shift Date" column header shows as already sorted (▲) on
first load. This is a hard floor applied before any other filter, search,
or deep link (a `get upcomingRequests()` getter that every other filter
branch reads from instead of the raw wire data) rather than just the
unfiltered view's default, since a shift dated before today has, by
definition, already been worked, cancelled, or marked Unable to Fill — that
history now belongs to **Reporting**, not My Requests. A subtitle under the
page title says as much. This previously defaulted to sorting by Request
number descending (newest first, relying on `Staffing_Request__c`'s
zero-padded `SR-{0000}` Name format so descending string comparison lines
up with descending numeric order) — that behavior is superseded by the
shift-date default above. `myStaffingRequests` also paginates at 10
rows per page (Previous/Next, with a "Showing X–Y of Z" summary) — the table
had no upper bound before this, and a client's request history only grows
over time. Changing the search term, the sort column, or the active filter
all reset back to page 1. `requestStaffForm` and `supportRequestForm`'s
Submit buttons now show a "Submitting…" label plus a small spinner while
their Apex call is in flight, instead of only a (easy-to-miss) disabled
state.

`myStaffingRequests` also shows an **Assigned Contact** column —
`Staffing_Request__c.Assigned_Contact__c`, a plain text field (not a Contact
lookup, since the individual actually completing a shift is a Bullhorn
candidate, not a Contact record in this org) that internal staff fill in
once a shift is filled. It's read-only to the portal, same as Status. It's
also included in the Filled/Unable to Fill/Cancelled notification emails
whenever it's populated.

Each row in `myStaffingRequests` also has a **Request Cancellation** action
— this used to live on the Support/Query screen as a "Cancellation Request"
type, but now lives directly on the row it applies to, since that's a more
natural place to act on a specific request. It's a compact
`lightning-button-menu` (a small dropdown, icon-only trigger) with a single
"Request Cancellation" menu item, rather than a full-width destructive
button — the earlier button-per-row approach was visibly too wide and
pushed the table past the screen edge on the live site. Selecting the menu
item asks for confirmation (a native `window.confirm`, not a custom modal —
kept simple rather than building a full dialog component), then reuses the
exact same `SupportRequestController.createCase()` path Support already
used: it creates a `Portal_Request_Type__c = 'Cancellation Request'` Case
linked to that request (same confirmation email, same Case note) and
refreshes the list. The action only shows for requests that aren't already
Cancellation-Requested and aren't already in a terminal status (Filled /
Unable to Fill / Cancelled). This also closed a real gap:
`Cancellation_Requested__c` existed and was displayed as a column already,
but nothing in the codebase ever actually set it — `SupportRequestService`
now flags it on the related request whenever a Cancellation Request Case is
created, regardless of which screen submitted it.

**The Action column is the first column, titled "Action".** It started as
a trailing, unlabeled column; it's now the leading column with a header, so
it's the first thing a user sees for each row rather than something they
have to scroll to find. The dropdown's `menu-alignment` also moved from
`right` to `left` — `right` was correct while this was the *last* column
(it opens the menu leftward from the button, staying inside the table), but
once Action became the *first* column that same alignment opened the menu
off the left edge of the table, where it got clipped by the table wrapper's
`overflow-x: auto`. `left` opens it rightward into the table instead, where
there's room.

The `myStaffingRequests` table container also has defensive
`max-width: 100%`/`overflow-x: auto` CSS on its wrapper elements, so any
wide row content scrolls within the table's own frame instead of stretching
the surrounding page.

**Error/success feedback doesn't rely solely on toasts.** Both forms
originally surfaced validation and Apex errors only via
`lightning/platformShowToastEvent`. That's a problem here specifically
because **Experience Cloud LWR sites (this portal's site type) don't render
platform toasts at all** — so a blocked submission (e.g. the End Time/Start
Time check below) looked like it silently did nothing, with no visible
explanation. Both forms now also show a guaranteed inline banner (an
error-red or success-green message rendered directly in the component,
cleared at the start of the next submit attempt) alongside the existing
toast dispatches — the toasts are left in place in case this component is
ever reused somewhere toasts do render, but the banner is what a user on
this site will actually see.

`supportRequestForm` (Support/Query) no longer submits through a bare
`lightning-record-edit-form` — it's now a custom Apex-backed form (matching
`requestStaffForm`'s pattern) via `SupportRequestController.createCase()` /
`SupportRequestService.submitNewCase()`, giving it a **reliable post-submit
confirmation** (an inline confirmation panel, not just a toast, which can be
unreliable on some LWR sites) with **View My Requests** and **Submit
Another Request** buttons, plus a **confirmation email**
(`SupportRequestService` emails the submitting Contact via
`Messaging.SingleEmailMessage.setTargetObjectId` with the Case's
Subject/Request Type; email failures are caught and logged rather than
blocking the Case from being created — confirmation email is a nice-to-have,
not the core function).

`supportRequestForm` no longer offers a Request Type picker or a Related
Request picker — it's now just Subject/Description, and only ever submits
`Portal_Request_Type__c = 'General Query'`. Both removals reflect the same
shift: cancellation requests moved to a per-row action on My Requests
(above), which is also where the Related Request context naturally lives
now (the row you clicked *is* the related request), so a general Support
query no longer needs to reference one. The `Portal_Request_Type__c`
picklist value `Cancellation Request` and the `Case.Related_Staffing_Request__c`
field both still exist and are still used — just by that My Requests row
action, not by anything a user picks on this form.

**Subject is actually enforced as required now.** The `required` attribute
on the Subject `lightning-input` only drives browser-native validation UI
when something calls `reportValidity()` — nothing did, so it was purely
decorative and the Case submitted fine with a blank Subject. `handleSubmit`
now calls `reportValidity()` (for the native "Complete this field" styling)
and, since Jest's `lightning-input` stub can't exercise real DOM validity,
also gates on the trimmed `formData.subject` value itself and shows the
guaranteed inline error banner ("Subject is required.") if it's blank or
whitespace-only — the same pattern this form already uses for Apex errors,
rather than relying solely on native validity UI that may not be reliable
on this site type either.

**`requestStaffForm` had the same gap, across more fields.** Role, Shift
Date, Start Time, End Time, Quantity, and Priority were all marked
`required` (Facility is required too, as a required Master-Detail
relationship, though the `facilityPicker` child component that owns it
didn't mark it `required` itself), but nothing called `reportValidity()`
there either — a blank submission still went all the way to Apex, where
the object's own `required=true` fields would reject it with a raw DML
error message (e.g. "Required fields are missing: [Role__c]") instead of a
clean, instant, client-side message. `handleSubmit` now checks
Facility/Role/Shift Date/Start Time/End Time/Quantity/Priority up front
and shows a single banner listing only whichever of those are still
missing (e.g. "Please fill in: Facility, Role, Shift Date.") before ever
calling Apex. Quantity and Priority always carry a default value in this
form, so in practice they can't go blank through normal use, but they're
included in the check anyway in case those defaults ever change. Ward,
Specialty, and Notes are genuinely optional on the object and stay that
way here.

### Reporting

`staffingRequestReporting` (nav label "Reporting") reuses the same
`StaffingRequestController.getMyRequests()` data as My Requests — no new
Apex — filtered client-side by `Shift_Date__c` against one of five ranges:
- **All** — no date filtering; every request the user can see. Added so
  there's an explicit, unambiguous way to clear the date filter, rather
  than making one of the other buttons deselectable (which would leave an
  ambiguous "nothing selected" state).
- **Last 7 Days** — a rolling window (today minus 6 days through today).
- **Last Week** — the most recently *completed* calendar week (Monday
  through Sunday), not a rolling window. Deliberately different from Last 7
  Days rather than a duplicate of it.
- **Last Month** — the most recently completed calendar month.
- **Custom Range** — manual From/To date pickers; shows a prompt rather
  than silently showing everything until both dates are set.

A **Download CSV** button builds a CSV client-side (same columns as the
table) from whatever's currently filtered *and sorted* and triggers a
browser download — disabled when there's nothing to download. The filename
is `staffing-requests-all.csv` for the All range, or
`staffing-requests-<from>-to-<to>.csv` otherwise. Defaults to Last 7 Days
on load. This screen is read-only (no search/pagination/row actions) — it's
meant for pulling a data extract for a date range, not day-to-day request
management, which is what My Requests is for.

**Sortable column headers**, the same client-side implementation as
`myStaffingRequests` (click to sort ascending, click again to toggle
descending) — sorting is layered on top of whichever date-range preset is
active, and the CSV download reflects the current sort order too.

**Column widths match My Requests.** Both tables now use
`table-layout: fixed` with the same explicit per-column widths (set via
`:nth-child` in each component's own CSS, since Shadow DOM means the two
components can't share a CSS file) so the 15 columns the two screens have
in common line up the same way on both pages, rather than each table
auto-sizing its columns to its own content and column count. My Requests
has an Action column Reporting doesn't — it's the leading column there, so
every other field's `:nth-child` index in `myStaffingRequests.css` is one
higher than the matching field's index in `staffingRequestReporting.css`
(e.g. Request is `nth-child(2)` on My Requests but `nth-child(1)` on
Reporting), even though both give that field the same width.

The download itself uses a `data:` URI (`<a download href="data:text/csv...">`),
**not** the more common `Blob` + `URL.createObjectURL("blob:...")` pattern —
that was the first approach, but it didn't actually download anything on
this site: the link just navigated to a blank page instead of saving a
file. Same root cause family as the toast issue elsewhere in this doc — this
site's CSP/Lightning Web Security sandboxing doesn't treat `blob:` URLs the
way a plain web app would. A `data:` URI sidesteps it: the whole file is
encoded directly into the `href`, with no separate object-URL lifecycle (and
so no possible early-revocation race) involved. If a future change to this
screen ever needs Blob-based downloads again (e.g. for a binary file type
`data:` URIs handle poorly), test it on the actual site early — don't
assume the textbook browser pattern works here.

**This is a brand new page, so it needs a manual Experience Builder step**
the same way Calendar did when it was added: create a new page in
Experience Builder, drag `staffingRequestReporting` onto it, and add a
"Reporting" entry to the site's navigation menu. None of that is something
that can be captured as deployable metadata up front — see "Experience
Cloud site setup" below for the same caveat about hand-composed pages.

## No Salesforce org is connected here

This project was built with no org attached to the build environment, so
nothing here has been deployed or run against real Salesforce. Everything is
source-format metadata, ready to deploy once you connect an org:

```
sf org login web --alias alliance-portal --set-default
```

Salesforce metadata deploys are all-or-nothing — a single failing component
rolls back the entire deploy. The `Network` placeholder
(`force-app/main/default/networks/AllianceClientPortal.network-meta.xml`)
will fail until the actual Experience Cloud site exists (see "Experience
Cloud site setup" below), so exclude it from your first deploy:

```
sf project deploy start --source-dir force-app/main/default/objects force-app/main/default/classes force-app/main/default/lwc force-app/main/default/permissionsets force-app/main/default/tabs
```

(`.forceignore` already excludes `sharingSets` automatically — see that
section below for why.) Once the site exists, either keep excluding
`networks/` this way, or retrieve the real site metadata over the
placeholder (next section) and deploy everything together.

If you'd already deployed an earlier version of this repo that included
`Timesheet__c` (before it was removed), re-running `sf project deploy start`
won't delete it from the org — Salesforce deploys are additive by default.
Remove it manually in Setup, or deploy a `destructiveChanges.xml` listing
`Timesheet__c` and its related metadata.

### Mocked integrations

Bullhorn/Classic Scheduler and 2Cloud9 aren't reachable either. Both
integration points are built behind an interface + factory so the swap to a
real implementation later is a one-line change, not a rewrite:

- `WorkforceManagementServiceFactory.getService()` → `MockWorkforceManagementService`
  (stands in for Bullhorn / Classic Scheduler: submits demand, returns status)
- `InvoiceSyncServiceFactory.getService()` → `Mock2Cloud9InvoiceService`
  (stands in for 2Cloud9: invoice sync is a deliberate no-op; PDF returns a
  placeholder blob)

Swap the single `return new Mock...()` line in each factory for a real
callout implementation once that system is connected — no other code changes.

### Scheduled jobs

`StaffingRequestMaintenanceService.markOverdueRequestsUnableToFill()` marks
any Staffing_Request__c whose Shift Date has passed while still Submitted/
Being Worked/Broadcasted as **Unable to Fill** — the same status the Unfilled
Shifts dashboard tile already counts, so this is what keeps that tile (and
My Requests) accurate without manual admin cleanup. `StaffingRequestOverdueScheduler`
is the `Schedulable` wrapper around it.

Deploying these classes does **not** start them running — a scheduled job is
org runtime state, not metadata. Activate it once per org:

- Setup → Apex Classes → **Schedule Apex** → class `StaffingRequestOverdueScheduler`,
  frequency Daily, whatever time suits (e.g. just after midnight)
- or via Anonymous Apex: `System.schedule('Staffing Request Overdue Check', '0 0 2 * * ?', new StaffingRequestOverdueScheduler());`

### Data validation

`requestStaffForm` blocks submitting a request whose Start Time and End Time
are identical — but that check only ever lived in the LWC's JavaScript, so
anything that bypasses the form (Data Loader, a direct edit in Salesforce, a
future integration) could still save an invalid pair. `StaffingRequestTrigger`
(before insert, before update on `Staffing_Request__c`) now enforces the same
rule server-side via `StaffingRequestValidationService`, so the client-side
check is a fast first pass and this is the real backstop.

**This does not require touching any existing data.** The validation only
runs on records being inserted or updated, so it doesn't retroactively scan
or flag anything already in the org — an existing request with equal
Start/End times (e.g. leftover test data) is left exactly as-is. It only
becomes relevant the next time that specific record is saved again, and even
then it's not blanket-blocked: a save that leaves both times exactly as they
already were (an unrelated field being edited) is still let through; only a
save that actively introduces or keeps changing into an equal pair is
rejected. So there's nothing to clean up before this deploys, and old
records won't suddenly become uneditable.

`StaffingRequestService.submitNewRequest` catches the resulting `DmlException`
and rethrows it as an `AuraHandledException` with the same friendly message,
so the LWC's `error.body.message` shows "End Time cannot be the same as
Start Time." rather than Salesforce's raw, verbose DML exception text.

`requestStaffForm` also blocks a Shift Date before today (the date picker's
`min` is set to today, plus the same submit-time check as the End Time rule),
and `StaffingRequestValidationService.validateShiftDateNotInPast` enforces it
server-side the same way. This one needs its own "don't re-block existing
data" logic, for a reason specific to this field: a request's Shift Date is
*expected* to become "in the past" simply by the calendar advancing — that's
exactly what `StaffingRequestMaintenanceService`'s daily overdue job acts on
— so this rule only blocks a save that actively introduces or changes into a
past date, never a record that's merely aged into being past-dated, or is
being updated for an unrelated reason (like that same overdue job setting
Status to Unable to Fill). Without that distinction, the daily overdue job
would break the moment this validation deployed.

**Facility/Ward access is checked before insert, and the insert itself runs
without sharing.** `Facility__c` and `Ward__c` on a new request are ids the
client sends straight from whatever the user picked in
`facilityPicker`/`wardPicker`. `Security.stripInaccessible` (already run
beforehand) only checks field/object level security, not whether *this
specific* Facility or Ward record is one the submitting user's Account can
actually see. `submitNewRequest` now checks that `Facility__c` belongs to
the user's own Account and, if set, that `Ward__c` belongs to that Facility
*before* the insert, throwing a clear "...refresh the page and choose a
facility/ward again" message rather than a raw DML error if either check
fails.

That check turned out to be necessary but not sufficient. On a real
connected org, a portal user confirmed to already have
`Alliance_Client_Portal_User` assigned still hit
`insufficient access rights on cross-reference id: <id>` on submit, for a
Facility that check had *just* verified belonged to their own Account. The
Facility itself was even readable moments earlier through the exact same
"with sharing" query used by that check and by `facilityPicker`'s own list
— so this isn't a data/Account mismatch, and it isn't a missing permission
set assignment either. `Staffing_Request__c` is two Master-Detail hops from
`Account` (`Staffing_Request__c` → `Facility__c` → `Account`), and the
Sharing Set's cascade wasn't extending far enough to satisfy Salesforce's
own cross-reference check specifically at **DML** time, even though plain
reads of the same record work fine. Since `validateFacilityAndWardAccess`
already independently proves the Facility/Ward genuinely belong to the
user's own Account — that check *is* the real access control here — the
insert and the follow-up `update` (setting `External_Demand_Id__c`/
`Last_Status_Update__c`) now run through a `private without sharing class
DmlHelper` nested inside `StaffingRequestService`, bypassing Salesforce's
sharing check for just those two DML statements rather than depending on a
mechanism proven not to cover this case. Triggers still fire as normal —
`without sharing` only affects row-level visibility/CRUD-adjacent checks
made by the calling Apex, not trigger execution — so
`StaffingRequestValidationService`'s Start/End Time and Shift Date rules
are unaffected.

**The same sharing gap also affected flagging `Cancellation_Requested__c`.**
That field's whole purpose is to record that a portal user has asked for a
shift to be cancelled — it's read-only to the portal (nothing else in the
codebase ever sets it), driven entirely by
`SupportRequestService.flagCancellationRequested`, called whenever a
"Cancellation Request" Case is created with a `Related_Staffing_Request__c`
(today, exclusively from the My Requests row action). It's what the
"Cancellation Requested" column reflects and what makes `canCancel` on
`myStaffingRequests` hide the action once cancellation's already been
asked for. `flagCancellationRequested`'s `update` targets an *existing*
`Staffing_Request__c` by Id in a `with sharing` class — the same two-hop
Master-Detail-from-Account chain the Facility/Ward fix above addresses for
inserts, so it hit the identical sharing gap for this update. Fixed the
same way: an explicit check that the request's `Facility__r.Account__c`
matches the requesting user's own Account (the real access control, not
reachable through normal use with a mismatch since the id always comes from
the user's own My Requests list) before doing the update through a nested
`without sharing` class. A request that doesn't belong to the user's
Account silently skips the flag rather than failing the whole Case
submission over it — the Case is still the primary outcome; the flag is
secondary, same as the confirmation email.

(`DmlHelper` in both classes uses instance methods, not `static` ones —
Apex doesn't allow `static` members on inner classes at all, "static can
only be used on methods of a top level type", so each caller does
`new DmlHelper().someMethod(...)` instead.)

**`TestDataFactory.createPortalUser` now assigns the permission set — in a
way that avoids `MIXED_DML_OPERATION`.** The first real `sf apex run test`
run against a connected org surfaced the missing assignment: every
FLS/CRUD-dependent test failed in different-looking ways depending on which
Apex API noticed the missing grants first — a `WITH SECURITY_ENFORCED`
query throws a hard `QueryException` the moment *any* selected field is
inaccessible (`StaffingRequestController`/`FacilityController`/
`InvoiceController`/`PortalDashboardController`'s tests),
`Security.stripInaccessible` throws `NoAccessException` when the user has
*zero* object-level access at all (`StaffingRequestServiceTest`'s
create-a-request tests), and it silently strips just the one inaccessible
field, no exception at all, when the object still has *some* baseline
access (`SupportRequestServiceTest.testSubmitNewCaseAsPortalUserWithRelatedRequest`
— `Related_Staffing_Request__c` came back `null` on the inserted Case with
no error). None of this was caused by the Facility/Ward or
Subject/required-field work above — it's a gap in the shared test fixture.
The first attempt at fixing it (inserting a `PermissionSetAssignment` right
after the `User`) broke nearly every test a second way:
`MIXED_DML_OPERATION`, because `User`/`PermissionSetAssignment` are "setup
objects" and can't be inserted in the same transaction as the
Account/Contact/Facility a test already created. Both inserts now run
inside `System.runAs(new User(Id = UserInfo.getUserId()))`, which opens a
transaction scope exempt from that restriction — the standard,
Salesforce-documented workaround for exactly this "create a test user, then
assign it a permission set" pattern.

### Notifications

`StaffingRequestTrigger` (after insert, after update on `Staffing_Request__c`)
emails the requesting Contact:
- when a request is first submitted, and
- whenever its Status changes to **Filled**, **Unable to Fill**, or
  **Cancelled**.

This is trigger-based rather than called inline from the Apex that
creates/updates these records, specifically so it also catches status
changes made directly on the record — e.g. an internal user marking a
request Filled or Cancelled by hand in Salesforce, which today has no other
code path at all (there's no real Bullhorn integration yet to do this
automatically). It also means the scheduled overdue job above triggers the
Unable to Fill email automatically, with no extra code. All the actual email
logic lives in `StaffingRequestNotificationService`; email failures are
caught and logged rather than blocking the record change, matching
`SupportRequestService`'s existing pattern. Every request in one batched
change (e.g. the overdue job resolving several requests in one run) is sent
via a single `Messaging.sendEmail` call, not one per record — Apex allows
only 10 calls to that method per transaction, so batching avoids hitting
that limit as request volume grows.

### Date formatting

All user-facing dates are explicit **DD/MM/YYYY** (and DD/MM/YYYY, HH:MM
where a time is included), regardless of anyone's Salesforce Locale
setting. Locale (Setup → Users → a user → Locale, e.g. "English
(Australia)") looked like the obvious lever, but it doesn't reliably cover
this whole app:
- It's per-user. A portal user, an internal staff member, and whoever the
  scheduled overdue job runs as can each have a different Locale, and
  **Apex's `Date.format()`** (used in the notification/confirmation
  emails) follows the Locale of whichever of *those* is running the code
  at the time — not the portal recipient's.
- Even where a component already used a Lightning date component
  (`lightning-formatted-date-time` for My Requests/Reporting's "Last
  Update" column), its day/month/year *order* is still Locale-driven, not
  fixed by its format attributes — pinning `day="2-digit"` etc. controls
  digit padding, not DD/MM vs MM/DD.
- Several date cells (Shift Date; Invoice Date/Due Date) were plain
  `{value}` interpolation of the raw ISO string from the wire — Locale
  wouldn't touch those at all.

Fixed with two small, explicit formatters instead of relying on Locale
anywhere:
- **`c/dateFormatUtils`** (new LWC module) — `formatDate`/`formatDateTime`,
  used by `myStaffingRequests`, `staffingRequestReporting`, and
  `invoiceList`.
- **`DateFormatUtil.format(Date)`** (new Apex class) — used by
  `StaffingRequestNotificationService` and `SupportRequestService` in
  place of `Date.format()`.

**The underlying ISO value is kept alongside the formatted one, not
replaced by it.** Shift Date/Last Update (My Requests, Reporting) and
Invoice Date/Due Date (Invoices) all still filter, sort, and — for
Reporting's date-range preset math and CSV filename — compare correctly
*only* because ISO (`YYYY-MM-DD...`) sorts lexicographically the same as
it sorts chronologically; `DD/MM/YYYY` does not (`"05/07/2026"` would
lexicographically look earlier than `"20/06/2026"`, which is backwards).
So each row object carries both: e.g. `shiftDate` (raw ISO, used for
filtering/sorting/comparison) and `shiftDateDisplay` (DD/MM/YYYY, used only
by the table cell). Reporting's CSV export deliberately still uses the raw
ISO columns too, not the Display ones — a spreadsheet import is exactly the
context where an unlabelled DD/MM/YYYY value risks being misread as
MM/DD/YYYY, so ISO is the safer choice for a machine-facing export even
though the on-screen table (a human reading it directly) uses DD/MM/YYYY.

The Calendar's day-detail heading (`requestStaffCalendar.js`) already used
`toLocaleDateString('en-AU', ...)` — hardcoding the locale argument rather
than relying on the runtime default — so it was already immune to this and
didn't need changing.

### Experience Cloud site setup

The actual Experience Builder site (pages, theme, navigation menu — the
`Network`/`Site`/`ExperienceBundle` metadata) is a UI/CLI-generated artifact
that Salesforce composes when you create a site; it isn't something that can
be reliably hand-authored as static XML without an org to validate the result
against. `force-app/main/default/networks/AllianceClientPortal.network-meta.xml`
is a placeholder only. To create the real site:

```
sf org create community wizard --name "Alliance Client Portal" \
  --template-name "Build Your Own (LWR)" --url-path-prefix portal
```

or via Setup → Digital Experiences → New. Then pull the generated metadata
into source control (this overwrites the placeholder):

```
sf project retrieve start -m Network -m ExperienceBundle
```

In Experience Builder, add each exposed LWC from the table above to a page
and wire up navigation matching the 6 screens. Also in Setup:

- Add your portal Contacts as users under a **Customer Community** /
  **Customer Community Login** license (whichever your org has available —
  Developer Edition orgs typically come with Customer Community Login).
  **Plus is not required**: the Sharing Set below is specifically the
  mechanism that grants account-based visibility to these base license
  tiers, which don't support Roles. On each Contact, use **Enable Customer
  User** (may need adding to the Contact page layout's Lightning actions if
  it's not already there) — this also requires the Account's owner to have
  a Role set in the Role Hierarchy, or it fails with "Portal Account Owner
  Has No Role".
- Assign the **Alliance Client Portal User** permission set to every portal
  user.
- **Sharing Set**: `force-app/main/default/sharingSets/Alliance_Client_Portal_Sharing_Set.sharingSet-meta.xml`
  has repeatedly failed to deploy with an element-ordering error
  (`permissionSets invalid at this location`) that two attempts at
  reordering didn't resolve — meaning the exact schema for this metadata
  type isn't reliably known here. `.forceignore` now excludes it
  automatically so it's never picked up by `sf project deploy start`.
  Configure the equivalent Sharing Set by hand instead, in **Setup →
  Sharing Settings → Sharing Sets → New**: map the **Account** object to
  `Contact.AccountId` with Read access, granted to the **Alliance Client
  Portal User** permission set. Map Account only, not Facility__c/Invoice__c
  — those are Master-Detail children of Account, so they have no
  independently configurable sharing and won't even appear as selectable
  objects in the Sharing Set UI. A single Account-level Read grant cascades
  down through the whole Master-Detail chain (Account → Facility__c →
  Ward__c, and Account → Invoice__c) automatically. While there, also
  confirm Account's organization-wide default (Setup → Sharing Settings →
  Organization-Wide Defaults) is **Private** — if it's Public Read Only or
  wider, portal users would see every client's Account regardless of the
  Sharing Set.
- **Header — logged-in user/account badge**: `portalUserBadge` shows an
  initials avatar, the current user's name, and their Account name (e.g.
  "Riverside Aged Care Group"), with a dropdown offering **Log Out** (fully
  functional) and **View Profile** (shown disabled, tagged "Coming soon" —
  standard Salesforce record-page navigation for the User object didn't
  resolve correctly on the live site, so it's disabled rather than shipped
  broken; re-enabling it means finding the right target page for this org's
  site and restoring the `NavigationMixin` call this component used to make).
  In Experience Builder, open the site Header, remove the standard Profile
  Menu component if present, and drag `portalUserBadge` in from the Custom
  Components section instead. It's backed by
  `PortalUserBadgeController.getCurrentUserBadge()`, which resolves the
  Account name via the existing `PortalUserContext` helper (the same
  Contact → Account lookup every other controller already uses).

## Code cleanup pass

A self-review pass looking specifically for duplication and best-practice
gaps across the whole codebase turned up three genuine repeats, all now
extracted into shared utilities:

- **`sortRecords`/`toggleSort`/`buildSortableColumns`** (new `c/sortTableUtils`
  LWC module) — `myStaffingRequests`, `staffingRequestReporting`, and
  `invoiceList` had all independently grown the exact same client-side sort
  comparator, sort-direction-toggle logic, and sortable-column-header
  decoration. All three now import the shared module instead; each keeps its
  own column definitions and CSS class prefix (passed in as a parameter),
  since those genuinely differ per component.
- **`TimeFormatUtil.format(Time)`** (new Apex class) — `StaffingRequestNotificationService`
  and `SupportRequestService` each had their own byte-identical private
  `formatTime` helper (Apex's `Time` class has no `.format()` method, unlike
  `Date`/`Datetime`). Both now call the shared class instead.
- **`WithoutSharingDml.insertRecord`/`updateRecord`** (new Apex class) —
  `StaffingRequestService` and `SupportRequestService` had each grown their
  own private `without sharing` inner class for the exact same reason (see
  "Facility/Ward access" and "Cancellation_Requested__c" above). Consolidated
  into one top-level `without sharing` class with plain static methods —
  which also fixes needing an inner-class instance in the first place, since
  Apex doesn't allow `static` methods on inner classes at all.

Also reviewed and found already in good shape: every non-test Apex class
declares `with sharing`/`without sharing`/`inherited sharing` explicitly
(the only classes without one are the two integration interfaces and their
mock/factory implementations, none of which do any SOQL/DML at all so the
declaration wouldn't do anything); the trigger and validation/notification
services are all properly bulkified (no SOQL/DML inside loops); every
`for:each` has a `key`; no leftover `console.log`/`debugger`/`TODO`s.

One gap noted but *not* fixed here, since it's a larger, separate addition
rather than a cleanup of existing code: this project has no ESLint/Prettier
config at all (`sf project generate` normally scaffolds
`@salesforce/eslint-config-lwc` and a `.eslintrc.json` automatically; this
project never went through that path). Worth adding if useful going
forward — ask if you'd like it set up.

## Verification

### Runs locally right now — no org needed

```
npm install
npm run test:unit
```

131 Jest tests across all 15 LWCs (including the `sortTableUtils` and
`dateFormatUtils` shared modules). This is the only thing in this project
that's actually been run and confirmed passing in this environment.

### Requires a connected org (not verified here)

- `sf apex run test --test-level RunLocalTests` — all Apex test classes,
  including the `TestDataFactory`-driven portal-user-context tests. Several
  tests (`StaffingRequestServiceTest`, `FacilityControllerTest`, etc.) look up
  an existing Customer Community profile and skip their portal-user
  assertions gracefully if one isn't enabled yet in the org — run them again
  after the Experience Cloud site and license are set up to get full coverage.
- `sf project deploy validate` — metadata deploy validation.
- Visual QA of the actual Experience Builder pages.

## Data model

All child objects are Master-Detail to their parent, so read sharing is
"Controlled by Parent" — no custom Apex sharing needed beyond the Sharing Set.

- **Facility__c** (MD → Account) — a client site; `Facility_Type__c`,
  address fields, `Active__c`.
- **Ward__c** (MD → Facility__c) — an optional sub-location within a
  facility (e.g. Riverside Aged Care → Ward A). Not every facility has
  wards defined; the picker on Request Staff is disabled with a helpful
  placeholder when the selected facility has none.
- **Staffing_Request__c** (MD → Facility__c, optional lookup → Ward__c) —
  the shift/staff demand request. `Status__c` is the client-safe lifecycle:
  Submitted, Being Worked, Broadcasted, Filled, Unable to Fill, Cancelled.
  `Requested_By_Contact__c` and `External_Demand_Id__c` are intentionally
  not portal-readable — server-set only. `Assigned_Contact__c` (plain text,
  not a lookup — see "Screens → components" above) and
  `Cancellation_Requested__c` are portal-readable but not portal-editable —
  both are set only by trusted server-side Apex. `Role__c` is a
  **restricted** picklist (Clinical Nurse, Registered Nurse, Registered
  Midwife, Enrolled Nurse, Nursing Assistant (AIN), Personal Care Assistant,
  Kitchen Hand, Pantry, Food Services Assistant, Cleaner, Laundry, Assistant
  Cook, Cook, Chef, Head Chef Supervisor, Allied Health) — being restricted
  means `requestStaffForm`'s `ROLE_OPTIONS` must exactly match the field's
  valueSet, or picking a value the field doesn't allow would submit fine
  client-side and only fail once it reaches Apex/the database.
- **Invoice__c** (MD → Account) — read-only in Phase 1.
  `External_Invoice_Id__c` is not portal-readable. The PDF itself is a
  standard `ContentVersion`/`ContentDocumentLink`, not a custom field.
- **Case** (standard object) — reused for the Support/Query screen via two
  added fields, rather than a new custom object.

## Scope

**In scope**: client login/access model, submit a single shift/staff
request (including via the calendar entry point), view status + broadcast/fill
visibility, read-only invoice download, support query/cancellation request.

**Out of scope for this phase**: full VMS replacement, full roster planning,
client-side worker selection, payment gateway, advanced compliance
dashboards, custom mobile app (responsive web only). Timesheet approval was
also in the original deck's MVP scope (the "Approve" job) but was removed
from this build at the user's request — `Timesheet__c`, its controller/
service, and the two timesheet LWCs no longer exist here. Re-adding it later
would mean restoring that object/Apex/LWC trio and the third Home dashboard
tile it fed.
