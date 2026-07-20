@isTest
private class PortalDashboardControllerTest {

    @isTest
    static void testReturnsZeroCountsForNonPortalRunningUser() {
        Test.startTest();
        PortalDashboardController.DashboardSummary summary = PortalDashboardController.getDashboardSummary();
        Test.stopTest();

        System.assertEquals(0, summary.openRequestCount);
        System.assertEquals(0, summary.atRiskShiftCount);
        System.assertEquals(0, summary.timesheetsAwaitingApprovalCount);
    }

    @isTest
    static void testCountsReflectPortalUsersAccountData() {
        Account acct = TestDataFactory.createAccount('Test Hospital Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Hospital');

        Staffing_Request__c openRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Staffing_Request__c unableToFillRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        unableToFillRequest.Status__c = 'Unable to Fill';
        update unableToFillRequest;

        Staffing_Request__c filledRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        filledRequest.Status__c = 'Filled';
        update filledRequest;

        TestDataFactory.createTimesheet(openRequest.Id, con.Id);

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'dashboardtest');

        Test.startTest();
        PortalDashboardController.DashboardSummary summary;
        System.runAs(portalUser) {
            summary = PortalDashboardController.getDashboardSummary();
        }
        Test.stopTest();

        // Submitted + Unable to Fill count as open (not Filled/Unable to Fill/Cancelled excluded) -
        // Unable to Fill is explicitly excluded from "open", so only the Submitted one counts.
        System.assertEquals(1, summary.openRequestCount, 'Only the Submitted request counts as open');
        System.assertEquals(1, summary.atRiskShiftCount, 'The Unable to Fill request is the at-risk shift');
        System.assertEquals(1, summary.timesheetsAwaitingApprovalCount, 'One Pending Review timesheet was created');
    }
}
