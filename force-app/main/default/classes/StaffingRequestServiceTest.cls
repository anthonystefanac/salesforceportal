@isTest
private class StaffingRequestServiceTest {

    @isTest
    static void testSubmitNewRequestAsPortalUser() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Aged Care Facility');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'sfrequesttest');

        Staffing_Request__c newRequest = new Staffing_Request__c(
            Facility__c = facility.Id,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today().addDays(2),
            Start_Time__c = Time.newInstance(6, 0, 0, 0),
            End_Time__c = Time.newInstance(14, 0, 0, 0),
            Quantity__c = 2,
            Priority__c = 'High'
        );

        Test.startTest();
        Id newRequestId;
        System.runAs(portalUser) {
            newRequestId = StaffingRequestService.submitNewRequest(newRequest);
        }
        Test.stopTest();

        Staffing_Request__c inserted = [
            SELECT Status__c, External_Demand_Id__c, Requested_By_Contact__c
            FROM Staffing_Request__c
            WHERE Id = :newRequestId
        ];
        System.assertEquals('Submitted', inserted.Status__c);
        System.assertNotEquals(null, inserted.External_Demand_Id__c, 'Mock WFM service should populate an external demand id');
        System.assertEquals(con.Id, inserted.Requested_By_Contact__c, 'Requester must be forced to the running portal user, not client input');
    }

    @isTest
    static void testSubmitNewRequestWithEqualStartEndTimesThrowsFriendlyError() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Aged Care Facility');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'sfrequesttest2');

        Staffing_Request__c newRequest = new Staffing_Request__c(
            Facility__c = facility.Id,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today().addDays(2),
            Start_Time__c = Time.newInstance(7, 0, 0, 0),
            End_Time__c = Time.newInstance(7, 0, 0, 0),
            Quantity__c = 1,
            Priority__c = 'Medium'
        );

        Test.startTest();
        Boolean threwFriendlyError = false;
        System.runAs(portalUser) {
            try {
                StaffingRequestService.submitNewRequest(newRequest);
            } catch (AuraHandledException auraError) {
                threwFriendlyError = true;
                System.assert(
                    auraError.getMessage().contains('End Time cannot be the same as Start Time'),
                    'Expected the validation message, got: ' + auraError.getMessage()
                );
            }
        }
        Test.stopTest();

        System.assert(threwFriendlyError, 'Submitting with equal Start/End Time should throw a friendly AuraHandledException');
    }
}
