@isTest
private class SupportRequestServiceTest {

    @isTest
    static void testSubmitNewCaseAsPortalUserWithRelatedRequest() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'supportcasetest1');

        Case newCase = new Case(
            Subject = 'Need to cancel a shift',
            Description = 'Overstaffed for this shift.',
            Portal_Request_Type__c = 'Cancellation Request',
            Related_Staffing_Request__c = request.Id
        );

        Test.startTest();
        Id newCaseId;
        System.runAs(portalUser) {
            newCaseId = SupportRequestService.submitNewCase(newCase);
        }
        Test.stopTest();

        Case inserted = [SELECT ContactId, Subject, Related_Staffing_Request__c FROM Case WHERE Id = :newCaseId];
        System.assertEquals(con.Id, inserted.ContactId, 'Case must be linked to the running portal user\'s Contact');
        System.assertEquals('Need to cancel a shift', inserted.Subject);
        System.assertEquals(request.Id, inserted.Related_Staffing_Request__c);
    }

    @isTest
    static void testSubmitNewCaseWithoutRelatedRequestStillSucceeds() {
        Account acct = TestDataFactory.createAccount('Test Hospital Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return;
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'supportcasetest2');

        Case newCase = new Case(
            Subject = 'General question',
            Description = 'Just checking something.',
            Portal_Request_Type__c = 'General Query'
        );

        Test.startTest();
        Id newCaseId;
        System.runAs(portalUser) {
            newCaseId = SupportRequestService.submitNewCase(newCase);
        }
        Test.stopTest();

        System.assertNotEquals(null, newCaseId, 'Case creation must not fail even with no related request or email sent');
    }
}
