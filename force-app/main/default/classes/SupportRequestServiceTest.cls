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
            Related_Staffing_Request__c = request.Id,
            Cancelled_By__c = 'Jane Doe'
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

        Staffing_Request__c updatedRequest = [
            SELECT Cancellation_Requested__c, Cancelled_By__c
            FROM Staffing_Request__c
            WHERE Id = :request.Id
        ];
        System.assertEquals(
            true,
            updatedRequest.Cancellation_Requested__c,
            'A Cancellation Request Case must flag the related Staffing_Request__c'
        );
        System.assertEquals(
            'Jane Doe',
            updatedRequest.Cancelled_By__c,
            'Cancelled_By__c from the Case must be copied onto the related Staffing_Request__c'
        );
    }

    @isTest
    static void testGeneralQueryDoesNotFlagCancellationRequested() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return;
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'supportcasetest3');

        Case newCase = new Case(
            Subject = 'Question about a shift',
            Description = 'Just checking something.',
            Portal_Request_Type__c = 'General Query',
            Related_Staffing_Request__c = request.Id
        );

        Test.startTest();
        System.runAs(portalUser) {
            SupportRequestService.submitNewCase(newCase);
        }
        Test.stopTest();

        Staffing_Request__c unchangedRequest = [
            SELECT Cancellation_Requested__c
            FROM Staffing_Request__c
            WHERE Id = :request.Id
        ];
        System.assertEquals(
            false,
            unchangedRequest.Cancellation_Requested__c,
            'A General Query about a related request must not flag it as a cancellation'
        );
    }

    @isTest
    static void testDoesNotFlagAStaffingRequestFromAnotherAccount() {
        Account ownAccount = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(ownAccount.Id, 'Portal', 'Tester');

        Account otherAccount = TestDataFactory.createAccount('A Different Client');
        Facility__c otherFacility = TestDataFactory.createFacility(otherAccount.Id, 'A Different Facility');
        Staffing_Request__c otherRequest = TestDataFactory.createStaffingRequest(otherFacility.Id, con.Id);

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'supportcasetest4');

        Case newCase = new Case(
            Subject = 'Need to cancel a shift',
            Description = 'Overstaffed for this shift.',
            Portal_Request_Type__c = 'Cancellation Request',
            Related_Staffing_Request__c = otherRequest.Id
        );

        Test.startTest();
        Id newCaseId;
        System.runAs(portalUser) {
            newCaseId = SupportRequestService.submitNewCase(newCase);
        }
        Test.stopTest();

        System.assertNotEquals(
            null,
            newCaseId,
            'The Case itself must still be created even when the related request belongs to another Account'
        );

        Staffing_Request__c unchangedRequest = [
            SELECT Cancellation_Requested__c
            FROM Staffing_Request__c
            WHERE Id = :otherRequest.Id
        ];
        System.assertEquals(
            false,
            unchangedRequest.Cancellation_Requested__c,
            'A Staffing_Request__c from another Account must never be flagged, no matter what a client submits'
        );
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
