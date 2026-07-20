@isTest
private class MockWorkforceManagementServiceTest {

    @isTest
    static void testSubmitDemandRequestReturnsExternalId() {
        Account acct = TestDataFactory.createAccount('Test Hospital Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Jane', 'Client');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Hospital');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        Test.startTest();
        IWorkforceManagementService service = WorkforceManagementServiceFactory.getService();
        String externalId = service.submitDemandRequest(request);
        Test.stopTest();

        System.assertNotEquals(null, externalId, 'Mock service should return a non-null external demand id');
        System.assert(externalId.startsWith('WFM-'), 'Mock external id should be prefixed for traceability');
    }

    @isTest
    static void testGetDemandStatusReturnsStatus() {
        Test.startTest();
        IWorkforceManagementService service = WorkforceManagementServiceFactory.getService();
        WorkforceManagementDemandStatus status = service.getDemandStatus('WFM-123456');
        Test.stopTest();

        System.assertNotEquals(null, status, 'Mock service should return a status object');
        System.assertNotEquals(null, status.status, 'Status value should be populated');
    }
}
