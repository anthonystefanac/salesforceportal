public with sharing class InvoiceController {

    @AuraEnabled(cacheable=true)
    public static List<Invoice__c> getInvoices() {
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            return new List<Invoice__c>();
        }
        return [
            SELECT Id, Name, Invoice_Number__c, Invoice_Date__c, Due_Date__c, Amount__c, Status__c
            FROM Invoice__c
            WHERE Account__c = :accountId
            WITH SECURITY_ENFORCED
            ORDER BY Invoice_Date__c DESC
            LIMIT 200
        ];
    }

    // The PDF itself is a standard ContentVersion/ContentDocumentLink, not a
    // custom field on Invoice__c - this maps each invoice to its most
    // recently modified attached file (if any) so the portal's "View /
    // Download" button can link straight to the file instead of only the
    // record page. Invoice Ids are scoped to the running user's own Account
    // first, the same ownership check getInvoices() already relies on, so
    // ContentDocumentLink itself doesn't need a separate WITH SECURITY_ENFORCED
    // - it's only ever filtered down to records this user is already allowed
    // to see.
    @AuraEnabled(cacheable=true)
    public static Map<Id, Id> getInvoiceFileIds() {
        Map<Id, Id> fileIdsByInvoiceId = new Map<Id, Id>();
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            return fileIdsByInvoiceId;
        }

        Set<Id> invoiceIds = new Map<Id, Invoice__c>([
            SELECT Id
            FROM Invoice__c
            WHERE Account__c = :accountId
            WITH SECURITY_ENFORCED
            LIMIT 200
        ]).keySet();
        if (invoiceIds.isEmpty()) {
            return fileIdsByInvoiceId;
        }

        List<ContentDocumentLink> links = [
            SELECT LinkedEntityId, ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :invoiceIds
            ORDER BY ContentDocument.ContentModifiedDate DESC
        ];
        for (ContentDocumentLink link : links) {
            if (!fileIdsByInvoiceId.containsKey(link.LinkedEntityId)) {
                fileIdsByInvoiceId.put(link.LinkedEntityId, link.ContentDocumentId);
            }
        }
        return fileIdsByInvoiceId;
    }
}
