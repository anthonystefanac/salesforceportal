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

    public static Staffing_Request__c createStaffingRequest(Id facilityId, Id contactId) {
        Staffing_Request__c request = new Staffing_Request__c(
            Facility__c = facilityId,
            Requested_By_Contact__c = contactId,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today().addDays(3),
            Start_Time__c = Time.newInstance(7, 0, 0, 0),
            End_Time__c = Time.newInstance(15, 0, 0, 0),
            Quantity__c = 1,
            Priority__c = 'Medium',
            Status__c = 'Submitted'
        );
        insert request;
        return request;
    }

    public static Timesheet__c createTimesheet(Id staffingRequestId, Id contactId) {
        Timesheet__c timesheet = new Timesheet__c(
            Staffing_Request__c = staffingRequestId,
            Contact__c = contactId,
            Shift_Date__c = Date.today(),
            Hours_Worked__c = 8,
            Approval_Status__c = 'Pending Review'
        );
        insert timesheet;
        return timesheet;
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
        insert portalUser;
        return portalUser;
    }
}
