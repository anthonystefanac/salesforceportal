@isTest
private class StaffingRequestOverdueSchedulerTest {

    @isTest
    static void testScheduledExecutionMarksOverdueRequestsUnableToFill() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Aged Care Facility');

        Staffing_Request__c overdueRequest = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        overdueRequest.Shift_Date__c = Date.today().addDays(-1);
        overdueRequest.Status__c = 'Broadcasted';
        update overdueRequest;

        Test.startTest();
        System.schedule(
            'Test Staffing Request Overdue Scheduler',
            '0 0 2 * * ?',
            new StaffingRequestOverdueScheduler()
        );
        Test.stopTest();

        Staffing_Request__c afterExecution = [
            SELECT Status__c
            FROM Staffing_Request__c
            WHERE Id = :overdueRequest.Id
        ];
        System.assertEquals('Unable to Fill', afterExecution.Status__c);
    }
}
