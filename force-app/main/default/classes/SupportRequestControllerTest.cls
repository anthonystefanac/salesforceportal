@isTest
private class SupportRequestControllerTest {

    @isTest
    static void testCreateCaseDelegatesToService() {
        Account acct = TestDataFactory.createAccount('Test Corporate Health');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return;
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'supportctrltest1');

        Case newCase = new Case(
            Subject = 'Question about invoice',
            Description = 'Can you clarify a line item?',
            Portal_Request_Type__c = 'General Query'
        );

        Test.startTest();
        Id newCaseId;
        System.runAs(portalUser) {
            newCaseId = SupportRequestController.createCase(newCase);
        }
        Test.stopTest();

        System.assertNotEquals(null, newCaseId);
    }
}
