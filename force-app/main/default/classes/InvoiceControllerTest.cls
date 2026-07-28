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

    @isTest
    static void testGetInvoiceFileIdsReturnsEmptyMapForNonPortalRunningUser() {
        Test.startTest();
        Map<Id, Id> fileIdsByInvoiceId = InvoiceController.getInvoiceFileIds();
        Test.stopTest();

        System.assertEquals(0, fileIdsByInvoiceId.size(), 'Standard test running user has no linked Account');
    }

    @isTest
    static void testGetInvoiceFileIdsOnlyIncludesInvoicesWithAnAttachedFile() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Invoice__c invoiceWithFile = TestDataFactory.createInvoice(acct.Id, 'INV-2001');
        Invoice__c invoiceWithoutFile = TestDataFactory.createInvoice(acct.Id, 'INV-2002');

        ContentVersion version = new ContentVersion(
            Title = 'Test Invoice PDF',
            PathOnClient = 'test-invoice.pdf',
            VersionData = Blob.valueOf('Dummy PDF content'),
            FirstPublishLocationId = invoiceWithFile.Id
        );
        insert version;

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'invoicefiletest');

        Test.startTest();
        Map<Id, Id> fileIdsByInvoiceId;
        System.runAs(portalUser) {
            fileIdsByInvoiceId = InvoiceController.getInvoiceFileIds();
        }
        Test.stopTest();

        System.assert(
            fileIdsByInvoiceId.containsKey(invoiceWithFile.Id),
            'The invoice with an attached file should have a file Id entry'
        );
        System.assert(
            !fileIdsByInvoiceId.containsKey(invoiceWithoutFile.Id),
            'The invoice without a file should have no entry at all'
        );
    }

    @isTest
    static void testGetInvoiceFileDataReturnsTheAttachedFilesBytesAsBase64() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Invoice__c invoice = TestDataFactory.createInvoice(acct.Id, 'INV-3001');

        ContentVersion version = new ContentVersion(
            Title = 'Test Invoice PDF',
            PathOnClient = 'test-invoice.pdf',
            VersionData = Blob.valueOf('Dummy PDF content'),
            FirstPublishLocationId = invoice.Id
        );
        insert version;

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'invoicefiledatatest');

        Test.startTest();
        InvoiceController.InvoiceFile file;
        System.runAs(portalUser) {
            file = InvoiceController.getInvoiceFileData(invoice.Id);
        }
        Test.stopTest();

        System.assertEquals('Test Invoice PDF.pdf', file.fileName);
        System.assertEquals(
            EncodingUtil.base64Encode(Blob.valueOf('Dummy PDF content')),
            file.base64Data
        );
    }

    @isTest
    static void testGetInvoiceFileDataThrowsWhenTheInvoiceHasNoAttachedFile() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Invoice__c invoice = TestDataFactory.createInvoice(acct.Id, 'INV-3002');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'invoicenofiletest');

        Test.startTest();
        Boolean threw = false;
        System.runAs(portalUser) {
            try {
                InvoiceController.getInvoiceFileData(invoice.Id);
            } catch (AuraHandledException e) {
                threw = true;
            }
        }
        Test.stopTest();

        System.assert(threw, 'Expected an AuraHandledException when the invoice has no attached file');
    }

    @isTest
    static void testGetInvoiceFileDataThrowsForAnInvoiceOutsideTheRunningUsersAccount() {
        Account ownAccount = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(ownAccount.Id, 'Portal', 'Tester');

        Account otherAccount = TestDataFactory.createAccount('Someone Else');
        Invoice__c otherInvoice = TestDataFactory.createInvoice(otherAccount.Id, 'INV-3003');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'invoicecrossaccounttest');

        Test.startTest();
        Boolean threw = false;
        System.runAs(portalUser) {
            try {
                InvoiceController.getInvoiceFileData(otherInvoice.Id);
            } catch (AuraHandledException e) {
                threw = true;
            }
        }
        Test.stopTest();

        System.assert(threw, "Expected an AuraHandledException for another Account's invoice");
    }
}
