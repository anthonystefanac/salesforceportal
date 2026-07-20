@isTest
private class TimesheetControllerTest {

    @isTest
    static void testGetPendingTimesheetsReturnsEmptyListForNonPortalRunningUser() {
        Test.startTest();
        List<Timesheet__c> timesheets = TimesheetController.getPendingTimesheets();
        Test.stopTest();

        System.assertEquals(0, timesheets.size(), 'Standard test running user has no linked Account');
    }

    @isTest
    static void testGetPendingTimesheetsOnlyReturnsPendingReview() {
        Account acct = TestDataFactory.createAccount('Test Hospital Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Hospital');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        TestDataFactory.createTimesheet(request.Id, con.Id);
        Timesheet__c alreadyApproved = TestDataFactory.createTimesheet(request.Id, con.Id);
        alreadyApproved.Approval_Status__c = 'Approved';
        update alreadyApproved;

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'tscontrollertest');

        Test.startTest();
        List<Timesheet__c> pending;
        System.runAs(portalUser) {
            pending = TimesheetController.getPendingTimesheets();
        }
        Test.stopTest();

        System.assertEquals(1, pending.size(), 'Only the Pending Review timesheet should be returned');
    }
}
