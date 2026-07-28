@isTest
private class PortalDashboardControllerTest {

    @isTest
    static void testReturnsZeroCountsForNonPortalRunningUser() {
        Test.startTest();
        PortalDashboardController.DashboardSummary summary = PortalDashboardController.getDashboardSummary();
        Test.stopTest();

        System.assertEquals(0, summary.openRequestCount);
        System.assertEquals(0, summary.unfilledShiftCount);
        System.assertEquals(0, summary.filledShiftCount);
        System.assertEquals(0, summary.cancelledShiftCount);
        System.assertEquals(0, summary.overdueInvoiceCount);
    }

    @isTest
    static void testCountsReflectPortalUsersAccountData() {
        Account acct = TestDataFactory.createAccount('Test Hospital Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Hospital');

        TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Staffing_Request__c unableToFillRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        unableToFillRequest.Status__c = 'Unable to Fill';
        update unableToFillRequest;

        Staffing_Request__c filledRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        filledRequest.Status__c = 'Filled';
        update filledRequest;

        Staffing_Request__c cancelledRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        cancelledRequest.Status__c = 'Cancelled';
        update cancelledRequest;

        TestDataFactory.createInvoice(acct.Id, 'INV-1001');
        Invoice__c overdueInvoice = TestDataFactory.createInvoice(acct.Id, 'INV-1002');
        overdueInvoice.Status__c = 'Overdue';
        update overdueInvoice;

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

        // Unable to Fill is explicitly excluded from "open", so only the Submitted one counts.
        System.assertEquals(1, summary.openRequestCount, 'Only the Submitted request counts as open');
        System.assertEquals(1, summary.unfilledShiftCount, 'The Unable to Fill request is the unfilled shift');
        System.assertEquals(1, summary.filledShiftCount, 'The Filled request is the filled shift');
        System.assertEquals(1, summary.cancelledShiftCount, 'The Cancelled request is the cancelled shift');
        System.assertEquals(1, summary.overdueInvoiceCount, 'Only the Overdue invoice counts');
    }
}
