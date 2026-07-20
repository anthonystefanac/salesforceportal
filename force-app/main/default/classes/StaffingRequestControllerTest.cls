@isTest
private class StaffingRequestControllerTest {

    @isTest
    static void testGetMyRequestsReturnsEmptyListForNonPortalRunningUser() {
        Test.startTest();
        List<Staffing_Request__c> requests = StaffingRequestController.getMyRequests();
        Test.stopTest();

        System.assertEquals(0, requests.size(), 'Standard test running user has no linked Account');
    }

    @isTest
    static void testGetMyRequestsReturnsOnlyOwnAccountRequests() {
        Account acct = TestDataFactory.createAccount('Test Hospital Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Hospital');
        TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'sfmyrequests');

        Test.startTest();
        List<Staffing_Request__c> requests;
        System.runAs(portalUser) {
            requests = StaffingRequestController.getMyRequests();
        }
        Test.stopTest();

        System.assertEquals(1, requests.size(), 'Portal user should see the one request tied to their Account');
    }
}
