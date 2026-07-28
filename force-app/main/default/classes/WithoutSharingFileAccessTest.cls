@isTest
private class WithoutSharingFileAccessTest {

    @isTest
    static void testGetLatestContentDocumentIdsByLinkedEntityReturnsEmptyMapForEmptyInput() {
        Test.startTest();
        Map<Id, Id> result = WithoutSharingFileAccess.getLatestContentDocumentIdsByLinkedEntity(new Set<Id>());
        Test.stopTest();

        System.assertEquals(0, result.size(), 'Empty input should return an empty map, not query at all');
    }

    @isTest
    static void testGetLatestContentDocumentIdsByLinkedEntityMapsEachLinkedRecordToItsFile() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Invoice__c invoice = TestDataFactory.createInvoice(acct.Id, 'INV-4001');

        ContentVersion version = new ContentVersion(
            Title = 'Test File',
            PathOnClient = 'test-file.pdf',
            VersionData = Blob.valueOf('Dummy content'),
            FirstPublishLocationId = invoice.Id
        );
        insert version;

        Test.startTest();
        Map<Id, Id> result = WithoutSharingFileAccess.getLatestContentDocumentIdsByLinkedEntity(
            new Set<Id>{ invoice.Id }
        );
        Test.stopTest();

        System.assert(result.containsKey(invoice.Id), 'The invoice should map to its attached file');
    }

    @isTest
    static void testGetLatestContentVersionReturnsNullWhenNoVersionExists() {
        Test.startTest();
        ContentVersion result = WithoutSharingFileAccess.getLatestContentVersion(null);
        Test.stopTest();

        System.assertEquals(null, result, 'No matching ContentVersion should return null, not throw');
    }

    @isTest
    static void testGetLatestContentVersionReturnsTheMatchingVersion() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Invoice__c invoice = TestDataFactory.createInvoice(acct.Id, 'INV-4002');

        ContentVersion version = new ContentVersion(
            Title = 'Test File',
            PathOnClient = 'test-file.pdf',
            VersionData = Blob.valueOf('Dummy content'),
            FirstPublishLocationId = invoice.Id
        );
        insert version;
        Id contentDocumentId = [
            SELECT ContentDocumentId
            FROM ContentVersion
            WHERE Id = :version.Id
        ].ContentDocumentId;

        Test.startTest();
        ContentVersion result = WithoutSharingFileAccess.getLatestContentVersion(contentDocumentId);
        Test.stopTest();

        System.assertEquals('Test File', result.Title);
    }
}
