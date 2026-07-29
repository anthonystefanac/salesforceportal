/**
 * Shared record builders for Apex test classes across the portal.
 */
@isTest
public class TestDataFactory {

    public static Account createAccount(String name) {
        Account acct = new Account(Name = name);
        insert acct;
        return acct;
    }

    public static Contact createContact(Id accountId, String firstName, String lastName) {
        Contact con = new Contact(
            AccountId = accountId,
            FirstName = firstName,
            LastName = lastName,
            Email = firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@example.com'
        );
        insert con;
        return con;
    }

    public static Facility__c createFacility(Id accountId, String name) {
        Facility__c facility = new Facility__c(
            Name = name,
            Account__c = accountId,
            Facility_Type__c = 'Hospital',
            Active__c = true
        );
        insert facility;
        return facility;
    }

    public static Ward__c createWard(Id facilityId, String name) {
        Ward__c ward = new Ward__c(Name = name, Facility__c = facilityId);
        insert ward;
        return ward;
    }

    public static Staffing_Request__c createStaffingRequest(Id facilityId, Id contactId) {
        Staffing_Request__c request = new Staffing_Request__c(
            Facility__c = facilityId,
            Requested_By_Contact__c = contactId,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today().addDays(3),
            Start_Time__c = Time.newInstance(7, 0, 0, 0),
            End_Time__c = Time.newInstance(15, 0, 0, 0),
            Quantity__c = 1,
            Priority__c = 'Standard',
            Status__c = 'Submitted'
        );
        insert request;
        return request;
    }

    public static Invoice__c createInvoice(Id accountId, String invoiceNumber) {
        Invoice__c invoice = new Invoice__c(
            Account__c = accountId,
            Invoice_Number__c = invoiceNumber,
            Invoice_Date__c = Date.today(),
            Amount__c = 1000,
            Status__c = 'Issued'
        );
        insert invoice;
        return invoice;
    }

    /**
     * Returns an Experience Cloud / Customer Community profile if this org
     * already has one (only true once the Experience Cloud site has been set
     * up in Setup - a manual step outside version control), otherwise null.
     * Tests use this to run the portal-user-context path when possible and
     * degrade gracefully when it isn't available yet.
     */
    public static Id getPortalProfileIdOrNull() {
        List<Profile> portalProfiles = [
            SELECT Id
            FROM Profile
            WHERE UserLicenseId IN (
                SELECT Id FROM UserLicense WHERE Name LIKE '%Community%' OR Name LIKE '%Customer%'
            )
            LIMIT 1
        ];
        return portalProfiles.isEmpty() ? null : portalProfiles[0].Id;
    }

    /**
     * Returns this org's Experience Cloud site Guest User if a site already
     * exists (only true once one has been created in Setup - a manual step
     * outside version control, same caveat as getPortalProfileIdOrNull
     * above), otherwise null. Tests use this to verify pre-login/Guest User
     * behaviour when possible and degrade gracefully when no site exists yet
     * to have provisioned one. Unlike a portal user, the Guest User record
     * itself can't be created by a test - it's auto-provisioned once per
     * site - so this looks up the existing one rather than inserting it.
     */
    public static User getGuestUserOrNull() {
        List<Profile> guestProfiles = [SELECT Id FROM Profile WHERE UserType = 'Guest' LIMIT 1];
        if (guestProfiles.isEmpty()) {
            return null;
        }
        List<User> guestUsers = [SELECT Id FROM User WHERE ProfileId = :guestProfiles[0].Id LIMIT 1];
        return guestUsers.isEmpty() ? null : guestUsers[0];
    }

    public static User createPortalUser(Id profileId, Id contactId, String uniqueName) {
        User portalUser = new User(
            ProfileId = profileId,
            ContactId = contactId,
            Username = uniqueName + '@alliance.portal.test',
            Email = uniqueName + '@alliance.portal.test',
            Alias = uniqueName.left(8),
            TimeZoneSidKey = 'Australia/Sydney',
            LocaleSidKey = 'en_AU',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            LastName = 'Portal Test User'
        );
        // User and PermissionSetAssignment are both "setup objects" - inserting
        // them in the same transaction as the Account/Contact/Facility a test
        // already created (non-setup objects) throws MIXED_DML_OPERATION.
        // System.runAs opens a transaction scope that's exempt from that
        // restriction - the standard workaround for exactly this "insert a
        // test user, then assign it a permission set" pattern.
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert portalUser;

            // Every real portal user needs Alliance_Client_Portal_User assigned
            // in Setup for FLS/CRUD to work at all - without it here too, every
            // WITH SECURITY_ENFORCED query and Security.stripInaccessible call
            // in the classes under test sees this fixture as if it had none of
            // the permission set's grants, which fails in three different ways
            // depending on the call: a hard QueryException (secure query hit an
            // inaccessible field), a NoAccessException (stripInaccessible found
            // zero object-level access at all), or a silent, unannounced field
            // strip (an object that still has *some* baseline access, just not
            // that specific field - e.g. Case.Related_Staffing_Request__c).
            List<PermissionSet> portalPermissionSets = [
                SELECT Id FROM PermissionSet WHERE Name = 'Alliance_Client_Portal_User' LIMIT 1
            ];
            if (!portalPermissionSets.isEmpty()) {
                insert new PermissionSetAssignment(
                    AssigneeId = portalUser.Id,
                    PermissionSetId = portalPermissionSets[0].Id
                );
            }
        }

        return portalUser;
    }
}
