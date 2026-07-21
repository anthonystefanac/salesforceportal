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
                       including an added calendar-based entry point to Request Staff
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
| Request staff — calendar | `requestStaffCalendar` (embeds `requestStaffForm`) |
| My requests | `myStaffingRequests` (+ `requestStatusBadge`) |
| Invoices | `invoiceList` |
| Support / query | `supportRequestForm` |

`requestStaffCalendar` is an added convenience screen, not part of the
original 6-screen deck: a month grid where clicking a day pre-fills Shift
Date on the same `requestStaffForm`, with a small badge on any day that
already has requests. It reuses the existing `Staffing_Request__c` object
and `StaffingRequestController` — no new Apex or objects were needed for it,
just the calendar UI and a reactive `defaultDate` input added to
`requestStaffForm`.

The Home dashboard's three tiles are clickable and deep-link into a
pre-filtered list: Open Requests and At-Risk Shifts go to My Requests,
Overdue Invoices goes to Invoices — each with a "Show all" control to clear
the filter. This uses `NavigationMixin` with `comm__namedPage` and a
`state.filter` parameter, which `myStaffingRequests`/`invoiceList` read back
via `@wire(CurrentPageReference)`. **The target page names
(`TILE_NAVIGATION` in `portalHomeDashboard.js`) are placeholders** — each
must match the actual Experience Builder page's Name once the site is built
(Setup → the page's own Settings panel), the same kind of gap as the
Network/ExperienceBundle placeholder described below.

## No Salesforce org is connected here

This project was built with no org attached to the build environment, so
nothing here has been deployed or run against real Salesforce. Everything is
source-format metadata, ready to deploy once you connect an org:

```
sf org login web --alias alliance-portal
sf project deploy start
```

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
sf project retrieve start -m Network -m ExperienceBundle -m Site
```

In Experience Builder, add each exposed LWC from the table above to a page
and wire up navigation matching the 6 screens. Also in Setup:

- Enable a **Customer Community Plus** license (needed for the Sharing Set's
  account-based visibility) and add your portal Contacts as users.
- Assign the **Alliance Client Portal User** permission set to every portal
  user.

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
