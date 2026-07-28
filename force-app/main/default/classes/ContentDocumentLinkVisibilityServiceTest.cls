@isTest
private class ContentDocumentLinkVisibilityServiceTest {

    @isTest
    static void testFileUploadedToAnInvoiceIsCorrectedToAllUsersVisibility() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Invoice__c invoice = TestDataFactory.createInvoice(acct.Id, 'INV-5001');

        Test.startTest();
        ContentVersion version = new ContentVersion(
            Title = 'Test Invoice PDF',
            PathOnClient = 'test-invoice.pdf',
            VersionData = Blob.valueOf('Dummy PDF content'),
            FirstPublishLocationId = invoice.Id
        );
        insert version;
        Test.stopTest();

        ContentDocumentLink link = [
            SELECT Visibility
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :invoice.Id
        ];
        System.assertEquals(
            'AllUsers',
            link.Visibility,
            'A file uploaded to an Invoice should be corrected to AllUsers visibility'
        );
    }

    // Deliberately not relying on whatever visibility the platform assigns
    // by default for a non-Invoice record (that can vary by org config) -
    // instead, explicitly forces it to a known, distinct value first, then
    // confirms the service leaves that value untouched for a record it's
    // not scoped to touch.
    @isTest
    static void testFileUploadedToSomeOtherRecordIsLeftAlone() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');

        ContentVersion version = new ContentVersion(
            Title = 'Unrelated File',
            PathOnClient = 'unrelated.pdf',
            VersionData = Blob.valueOf('Dummy content'),
            FirstPublishLocationId = acct.Id
        );
        insert version;

        ContentDocumentLink link = [
            SELECT Id, LinkedEntityId, Visibility
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :acct.Id
        ];
        link.Visibility = 'InternalUsers';
        update link;

        Test.startTest();
        ContentDocumentLinkVisibilityService.ensureAllUsersVisibilityForInvoiceFiles(new List<ContentDocumentLink>{ link });
        Test.stopTest();

        ContentDocumentLink unchangedLink = [SELECT Visibility FROM ContentDocumentLink WHERE Id = :link.Id];
        System.assertEquals(
            'InternalUsers',
            unchangedLink.Visibility,
            'A file linked to a non-Invoice record should be left exactly as it was'
        );
    }
}
