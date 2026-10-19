# Moving the Apprentice Sign-Up from dev to production

**The rule:** build and change everything in **dev**, package it as a **solution**, and
**import** that solution into **prod**. Don't build or edit in prod directly. A managed
solution keeps prod identical to what you tested, and future changes become an upgrade
import.

Allow half a day for the first move, plus time for licensing and approvals.

---

## Part A: Before you start (one-off)

| Item | Why | Who |
|---|---|---|
| **Production environment with Dataverse**, Australia region | Holds applicants' personal data | Power Platform admin |
| **Power Pages capacity in prod**: anonymous users add-on, AU$112.20 per 500 users/site/month, allocated to the prod environment (admin centre → Resources → Capacity → Add-ons) | A trial site expires and can't go live | Admin / licensing |
| **Staff licences**: Power Apps Premium for anyone using the staff app | Model-driven app on Dataverse | Licensing |
| **A service account** with Power Automate Premium (or Power Apps Premium) | Owns the 3 flows and their connections, so they don't stop if someone leaves | IT |
| **Shared mailbox**, with Send As for the service account | Sends the invite emails | M365 admin |
| **Privacy sign-off** on which fields are pre-filled | Anyone with a link sees those values | Privacy officer |
| **Custom domain** (optional), e.g. `signup.apprenticeshipsupport.com.au` | A trusted address for applicants; needs a production site and a DNS record | IT / web team |
| **The real source table** for pre-fill | The flow must point at it instead of the test copy | You / data owner |

---

## Part B: Prepare the solution in dev

1. **Use one solution for everything.** Either keep **ASATestAIApp**, or create a clean
   **ASA Apprentice Sign Up** solution under the same publisher (prefix `bnsw`) and move the
   components into it.

2. **Add these components** (Solution → **Add existing**):

   | Type | Components |
   |---|---|
   | Tables | **Apprentice Sign Up**, **Sign Up Invite** (with all columns, forms, views, keys). **Not** *Applicant Record (test)*. |
   | App | The staff model-driven app |
   | Security | The staff **security role**, and the **ASA Case Managers** column security profile |
   | Cloud flows | Verify tracking code, Email invite link, Prefill invite |
   | Site | **Site → ASA Sign Up**. On the enhanced data model this brings the web templates, page templates, web pages, site settings, table permissions and web roles. |

   When asked, choose **Include required components**.

3. **Remove hard-coded dev values from the flows.**
   - **Email flow:** the link uses `https://site-9diru.powerappsportals.com`. Create an
     **environment variable** in the solution (**New → More → Environment variable**, type
     Text), named `ASA Sign-up site URL`. Use it in the email body in place of the address.
   - **Prefill flow:** it reads *Applicant Records (test)*. Before exporting, either:
     - point it at the **real source table** with the column mapping (see `PREFILL.md`,
       "Switching to your real table"); or
     - leave it **out** of this release and add it in a later version.
   - **Connection references:** flows built inside the solution already use them, and you
     pick the prod connections on import. If a flow was built outside the solution, open it
     from the solution, then **Edit → Remove from this solution → Add existing** so it picks
     them up.

4. **Tidy up.**
   - Run **Solution checker** and fix anything Critical or High.
   - Click **Publish all customisations**.
   - Bump the solution **Version**, e.g. `1.0.0.0`; later releases go `1.1.0.0`, `1.2.0.0` and so on.

5. **Export twice.**
   - **Unmanaged**: your backup and source copy. Commit it to the Git repository with the template.
   - **Managed**: what goes to prod.

> **Optional, better long-term:** Power Platform **Pipelines** (Solutions → Pipelines)
> automate export and import from dev to prod with an approval step. Prod has to be a
> Managed Environment. Set this up once the first manual move works.

---

## Part C: Import into prod

1. In prod, go to **make.powerapps.com → Solutions → Import solution**, choose the
   **managed** zip, then click **Next**.
2. **Connections:** for each connection reference (Dataverse, Office 365 Outlook), pick or
   create a connection **signed in as the service account**.
3. **Environment variables:** set `ASA Sign-up site URL` to the **prod** site address. If you
   don't know it yet, use a placeholder and update it after step 4.
4. **Import**, and wait. It can take 10–20 minutes.
5. **Activate the site.** Imported sites start inactive.
   1. In **make.powerpages.microsoft.com**, choose the prod environment.
   2. Go to **Inactive sites → ASA Sign Up → Reactivate**.
   3. Give it its prod address.
   4. Update the environment variable if needed.

---

## Part D: Finish setup in prod

Solutions don't carry over people, data or some site security links. Check each item:

### Site
- [ ] **Studio → Security → Table permissions:** both permissions have their **roles**:
  - *Apprentice Sign Up - own records*: Create only, **Anonymous Users** + Authenticated Users.
  - *Sign Up Invite - code check*: Read only, **Anonymous Users** + Authenticated Users.

  (In dev, the role links had to be added by hand. Check them here too.)
- [ ] **Site settings** exist, and `Webapi/bnsw_apprenticesignup/fields` includes
  `bnsw_prefilled,bnsw_prefillchanges`.
- [ ] **There is no `Webapi/bnsw_signupinvite/enabled` setting.**
- [ ] **Pages:** the sign-up page has no page permission (open to everyone). Home uses the
  sign-up template, and "Use Website Header and Footer" is off.
- [ ] **Site visibility:** set to **Public** (Studio → Set up → Site visibility).
- [ ] **Column permissions / Enhanced Authorization** for the sensitive columns. This didn't
  save on the dev trial site. Set it up here and test a submission straight after.
- [ ] **Custom domain** (optional): Studio → Set up → Custom domain names → add the domain and
  certificate. Then update the environment variable.
- [ ] **Sync**, then clear the cache: sign in as an admin, open `/_services/about`, click **Clear cache**.

### People and security (never in a solution)
- [ ] Assign the staff **security role** to caseworkers (admin centre → Users).
- [ ] Add caseworkers to the **ASA Case Managers** column security profile.
- [ ] Share the staff app with them.

### Flows
- [ ] All three flows are **On**. Each one's owner is the service account, with a second
  co-owner.
- [ ] The email flow's **shared mailbox** works: send one test invite to yourself.
- [ ] Turn on failure alerts: in each flow's details, under **Run only users / Owners**,
  owners get failure emails by default. Make sure a monitored mailbox is an owner.

### Data
- [ ] **Old codes still in use:** import them into **Sign Up Invites** with the code filled in
  and status Issued.
- [ ] **Code numbering:** prod codes start again from `ASA-10000-…`. If imported old codes
  use the same `ASA-1xxxx` pattern, ask for a script to raise the starting number so they
  can never clash.
- [ ] **Don't copy test submissions or the test source table** to prod.

---

## Part E: Smoke test in prod (fresh private window)

1. **Opening the form:**
   1. Create an invite for yourself. The email arrives, and the link opens the form with
      the code in the banner.
   2. If pre-fill is enabled, the yellow note shows and the fields are filled in.
2. **Submitting:**
   1. Submit, then check the record in the staff app: all values are saved and
      **Verification Status = Verified**.
   2. Check the invite: it shows **Used** and Prefill Data is empty.
3. **Using the same link again:** it shows "already submitted".
4. **Cancelled code:** "no longer active". **Expired code:** "expired". **Made-up code:**
   "couldn't find".
5. **Staff access:**
   - A caseworker can see the sensitive columns.
   - A user without the profile sees them locked.
6. **Phone:** do one submission from a mobile phone.

Delete your test records afterwards.

---

## Part F: Go live
- Point any links (website, email templates, staff instructions) at the prod address.
- Tell the team that invites now come from prod. **Stop issuing invites in dev.**
- Keep dev for testing changes. Never use real applicant data there.

## Making changes after go-live
1. Change in **dev**: the template, a flow, a column. Test it there. Ask Claude in the
   repository for template changes; the browser tests run before anything is pushed.
2. Bump the solution version, then export **managed**.
3. Import into prod. Choose **Upgrade**, the default, so removed components are cleaned up.
4. **Sync** the site, clear the cache, and do a quick smoke test.

**Don't** paste template changes straight into prod. A managed solution makes prod
components read-only for a reason, and the next import would overwrite your change anyway.

## If something goes wrong
- **Import fails:** the message names the missing component. Usually it's a required
  component that wasn't added. Add it in dev, re-export, re-import.
- **The form says "couldn't find" for every code:** the *Sign Up Invite - code check* permission
  is missing Anonymous Users, or the site wasn't synced.
- **Submit gives 403:** the *Apprentice Sign Up* permission is missing Anonymous Users, or the
  fields site setting is missing a column. The Technical details link shows which.
- **Roll back:** import the previous managed version. Keep each release's zip.

## Alternative: rebuild prod with the scripts
If a solution import isn't possible, for example because the dev site can't be added to a
solution, you can rebuild prod the same way dev was built:
1. Run against the prod environment URL, in order:
   - `Create-ApprenticeSignUpTable.ps1`
   - `Build-ApprenticeSignUpForm.ps1`
   - `Configure-ApprenticeSignUpSecurity.ps1`
   - `Enable-TrackingCodeCheck.ps1`
   - `Enable-Prefill.ps1`
2. Create the prod site and paste the template.
3. Rebuild the three flows from the guides.

This works, but every later change has to be repeated by hand, so prefer the solution route.
