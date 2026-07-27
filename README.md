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
  lwc/                 12 Lightning Web Components covering the current screens
                       (plus timeFormatUtils, a shared non-visual helper module),
                       including an added Calendar screen for reviewing bookings by day
                       and a header user/account badge (portalUserBadge)
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

The Home dashboard's three tiles, the Calendar's Request Staff button, each
Calendar booking, and Support's post-submit confirmation are all
clickable/navigable and deep-link across pages: Open Requests and Unfilled
Shifts go to My Requests, Overdue Invoices goes to Invoices, a selected
Calendar day goes to Request Staff with that date pre-filled, a Calendar
booking goes to My Requests filtered to its shift date, and a submitted
Support request offers a "View My Requests" button — each filtered
destination has a "Show all" control to clear the filter. This uses
`NavigationMixin` with `comm__namedPage` and a `state` parameter, which the
destination component reads back via `@wire(CurrentPageReference)`
(`myStaffingRequests` reads both `state.filter` and `state.shiftDate`;
`invoiceList` reads `state.filter`; `requestStaffForm` reads
`state.defaultDate`). **The target page names are set to the real
Experience Builder page API names** (`My_Requests__c`, `Invoices__c` in
`TILE_NAVIGATION` inside `portalHomeDashboard.js`) confirmed from the live
site, **except `Request_Staff__c`** (`REQUEST_STAFF_PAGE_NAME` in
`requestStaffCalendar.js`), which is still a placeholder — confirm/update it
the same way the other two were, from the Request Staff page's own Settings
panel in Experience Builder once that page exists. If any of these pages is
ever recreated or renamed, update the matching constant to its new API Name.

`myStaffingRequests` and `invoiceList` both have a search box (matches
request/facility/ward/role/specialty/status, or invoice number/status) and
sortable column headers (click to sort ascending, click again to toggle
descending) — both are client-side, layered on top of the existing deep-link
filters, so no new Apex was needed. `myStaffingRequests` also paginates at 10
rows per page (Previous/Next, with a "Showing X–Y of Z" summary) — the table
had no upper bound before this, and a client's request history only grows
over time. Changing the search term, the sort column, or the active filter
all reset back to page 1. `requestStaffForm` and `supportRequestForm`'s
Submit buttons now show a "Submitting…" label plus a small spinner while
their Apex call is in flight, instead of only a (easy-to-miss) disabled
state.

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
`SupportRequestService.submitNewCase()`, so it can do three things a plain
record-edit-form couldn't:
- **Live related-request detail**: picking a Related Request (populated from
  the same `getMyRequests()` data already used elsewhere) shows that
  request's Date, Facility, Ward, Role, and Start Time inline — no extra
  Apex call, since the data's already loaded client-side.
- **Reliable post-submit confirmation**: an inline confirmation panel (not
  just a toast, which can be unreliable on some LWR sites) with **View My
  Requests** and **Submit Another Request** buttons.
- **Confirmation email**: `SupportRequestService` emails the submitting
  Contact (via `Messaging.SingleEmailMessage.setTargetObjectId`) with the
  Case's Subject/Request Type and, when a Related Request was picked, that
  request's Date/Facility/Ward/Role/Start Time. Email failures are caught
  and logged rather than blocking the Case from being created — confirmation
  email is a nice-to-have, not the core function.

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

## Verification

### Runs locally right now — no org needed

```
npm install
npm run test:unit
```

80 Jest tests across all 12 LWCs. This is the only thing in this project
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
  not portal-readable — server-set only.
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
