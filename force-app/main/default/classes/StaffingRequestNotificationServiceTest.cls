@isTest
private class StaffingRequestNotificationServiceTest {

    @isTest
    static void testSendsOneEmailInvocationOnInsert() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');

        Test.startTest();
        Integer before = Limits.getEmailInvocations();
        TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        Integer after = Limits.getEmailInvocations();
        Test.stopTest();

        System.assertEquals(before + 1, after, 'Submitting a request should send exactly one batched email invocation');
    }

    @isTest
    static void testSendsOneEmailInvocationWhenStatusChangesToATerminalStatus() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Test.startTest();
        Integer before = Limits.getEmailInvocations();
        request.Status__c = 'Filled';
        update request;
        Integer after = Limits.getEmailInvocations();
        Test.stopTest();

        System.assertEquals(before + 1, after, 'A status change to Filled should send exactly one batched email invocation');
    }

    @isTest
    static void testDoesNotEmailOnNonTerminalStatusChange() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Test.startTest();
        Integer before = Limits.getEmailInvocations();
        request.Status__c = 'Being Worked';
        update request;
        Integer after = Limits.getEmailInvocations();
        Test.stopTest();

        System.assertEquals(before, after, 'A non-terminal status change should not send an email');
    }

    @isTest
    static void testBulkStatusChangeStillSendsOnlyOneEmailInvocation() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');

        List<Staffing_Request__c> requests = new List<Staffing_Request__c>{
            TestDataFactory.createStaffingRequest(facility.Id, con.Id),
            TestDataFactory.createStaffingRequest(facility.Id, con.Id),
            TestDataFactory.createStaffingRequest(facility.Id, con.Id)
        };

        Test.startTest();
        Integer before = Limits.getEmailInvocations();
        for (Staffing_Request__c request : requests) {
            request.Status__c = 'Unable to Fill';
        }
        update requests;
        Integer after = Limits.getEmailInvocations();
        Test.stopTest();

        System.assertEquals(
            before + 1,
            after,
            'Updating many requests to a terminal status in one DML must still only use a single Messaging.sendEmail call, not one per record'
        );
    }
}
