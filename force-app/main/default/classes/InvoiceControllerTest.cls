@isTest
private class InvoiceControllerTest {

    @isTest
    static void testGetInvoicesReturnsEmptyListForNonPortalRunningUser() {
        Test.startTest();
        List<Invoice__c> invoices = InvoiceController.getInvoices();
        Test.stopTest();

        System.assertEquals(0, invoices.size(), 'Standard test running user has no linked Account');
    }

    @isTest
    static void testGetInvoicesReturnsOnlyOwnAccountInvoices() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        TestDataFactory.createInvoice(acct.Id, 'INV-1001');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'invoicetest');

        Test.startTest();
        List<Invoice__c> invoices;
        System.runAs(portalUser) {
            invoices = InvoiceController.getInvoices();
        }
        Test.stopTest();

        System.assertEquals(1, invoices.size(), 'Portal user should see the one invoice tied to their Account');
        System.assertEquals('INV-1001', invoices[0].Invoice_Number__c);
    }
}
