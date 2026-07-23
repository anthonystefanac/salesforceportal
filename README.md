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
                       boundaries, and their test classes
  lwc/                 10 Lightning Web Components covering the current screens,
                       including an added Calendar screen for reviewing bookings by day
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
bookings (Role, Facility/Ward, Status) plus a **Request Staff** button that
navigates to the Request Staff page with the date carried in `state`, rather
than embedding the request form on this page — Calendar is for reviewing
what's already booked on a day, Request Staff is where you actually submit
one. It reuses the existing `Staffing_Request__c` object and
`StaffingRequestController` — no new Apex or objects were needed for it.

The Home dashboard's three tiles, and the Calendar's Request Staff button,
are clickable/navigable and deep-link across pages: Open Requests and
Unfilled Shifts go to My Requests, Overdue Invoices goes to Invoices, and a
selected Calendar day goes to Request Staff with that date pre-filled —
each of the first two with a "Show all" control to clear the filter. This
uses `NavigationMixin` with `comm__namedPage` and a `state` parameter, which
the destination component reads back via `@wire(CurrentPageReference)`
(`myStaffingRequests`/`invoiceList` read `state.filter`; `requestStaffForm`
reads `state.defaultDate`). **The target page names are set to the real
Experience Builder page API names** (`My_Requests__c`, `Invoices__c` in
`TILE_NAVIGATION` inside `portalHomeDashboard.js`) confirmed from the live
site, **except `Request_Staff__c`** (`REQUEST_STAFF_PAGE_NAME` in
`requestStaffCalendar.js`), which is still a placeholder — confirm/update it
the same way the other two were, from the Request Staff page's own Settings
panel in Experience Builder once that page exists. If any of these pages is
ever recreated or renamed, update the matching constant to its new API Name.

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

## Verification

### Runs locally right now — no org needed

```
npm install
npm run test:unit
```

45 Jest tests across all 10 LWCs. This is the only thing in this project
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
