@isTest
private class PortalUserContextTest {

    @isTest
    static void testReturnsNullForNonPortalRunningUser() {
        Test.startTest();
        Id contactId = PortalUserContext.getCurrentContactId();
        Id accountId = PortalUserContext.getCurrentAccountId();
        Test.stopTest();

        System.assertEquals(null, contactId, 'Standard test running user has no Contact');
        System.assertEquals(null, accountId, 'No Contact means no Account');
    }
}
