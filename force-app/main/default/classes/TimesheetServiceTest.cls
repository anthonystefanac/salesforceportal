@isTest
private class TimesheetServiceTest {

    @isTest
    static void testApproveAndQueryTimesheetAsPortalUser() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Corporate Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        Timesheet__c timesheetToApprove = TestDataFactory.createTimesheet(request.Id, con.Id);
        Timesheet__c timesheetToQuery = TestDataFactory.createTimesheet(request.Id, con.Id);

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'timesheettest');

        Test.startTest();
        System.runAs(portalUser) {
            TimesheetService.approveTimesheet(timesheetToApprove.Id);
            TimesheetService.queryTimesheet(timesheetToQuery.Id, 'Hours look incorrect, please review.');
        }
        Test.stopTest();

        Timesheet__c approved = [
            SELECT Approval_Status__c, Approved_Date__c, Approved_By__c
            FROM Timesheet__c
            WHERE Id = :timesheetToApprove.Id
        ];
        System.assertEquals('Approved', approved.Approval_Status__c);
        System.assertNotEquals(null, approved.Approved_Date__c);
        System.assertEquals(con.Id, approved.Approved_By__c);

        Timesheet__c queried = [
            SELECT Approval_Status__c, Query_Comment__c
            FROM Timesheet__c
            WHERE Id = :timesheetToQuery.Id
        ];
        System.assertEquals('Queried', queried.Approval_Status__c);
        System.assertEquals('Hours look incorrect, please review.', queried.Query_Comment__c);
    }
}
