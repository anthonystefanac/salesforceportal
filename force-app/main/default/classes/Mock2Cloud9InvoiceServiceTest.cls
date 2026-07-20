@isTest
private class Mock2Cloud9InvoiceServiceTest {

    @isTest
    static void testSyncInvoicesReturnsEmptyList() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');

        Test.startTest();
        I2Cloud9InvoiceService service = InvoiceSyncServiceFactory.getService();
        List<Invoice__c> invoices = service.syncInvoices(acct.Id);
        Test.stopTest();

        System.assertNotEquals(null, invoices, 'Mock sync should return an empty list, not null');
        System.assertEquals(0, invoices.size(), 'Mock sync is a no-op until 2Cloud9 is connected');
    }

    @isTest
    static void testGetInvoicePdfReturnsPlaceholderBlob() {
        Test.startTest();
        I2Cloud9InvoiceService service = InvoiceSyncServiceFactory.getService();
        Blob pdf = service.getInvoicePdf('INV-999');
        Test.stopTest();

        System.assertNotEquals(null, pdf, 'Mock PDF blob should not be null');
    }
}
