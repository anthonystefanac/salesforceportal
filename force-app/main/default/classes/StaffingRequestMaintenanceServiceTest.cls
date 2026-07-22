@isTest
private class StaffingRequestMaintenanceServiceTest {

    @isTest
    static void testMarksOverdueUnresolvedRequestsUnableToFill() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Aged Care Facility');

        Staffing_Request__c overdueSubmitted = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        overdueSubmitted.Shift_Date__c = Date.today().addDays(-2);
        overdueSubmitted.Status__c = 'Submitted';
        update overdueSubmitted;

        Staffing_Request__c overdueFilled = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        overdueFilled.Shift_Date__c = Date.today().addDays(-2);
        overdueFilled.Status__c = 'Filled';
        update overdueFilled;

        Staffing_Request__c futureSubmitted = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Test.startTest();
        Integer updatedCount = StaffingRequestMaintenanceService.markOverdueRequestsUnableToFill();
        Test.stopTest();

        System.assertEquals(1, updatedCount, 'Only the overdue, unresolved request should be updated');

        Map<Id, Staffing_Request__c> afterById = new Map<Id, Staffing_Request__c>(
            [SELECT Id, Status__c FROM Staffing_Request__c]
        );
        System.assertEquals('Unable to Fill', afterById.get(overdueSubmitted.Id).Status__c);
        System.assertEquals('Filled', afterById.get(overdueFilled.Id).Status__c, 'Already-resolved requests must not be touched');
        System.assertEquals('Submitted', afterById.get(futureSubmitted.Id).Status__c, 'Future-dated requests must not be touched');
    }
}
