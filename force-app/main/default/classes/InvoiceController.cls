public with sharing class InvoiceController {

    public class InvoiceFile {
        @AuraEnabled public String fileName;
        @AuraEnabled public String base64Data;
    }

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
    // Download" button knows whether to show "Download PDF" or fall back to
    // "View" (the record page). Invoice Ids are scoped to the running user's
    // own Account first, the same ownership check getInvoices() already
    // relies on - that's the real access control here, since a "with
    // sharing" query against ContentDocumentLink itself returned zero rows
    // for a portal user in testing even for a file they could see fine
    // through the record's own Files related list. See
    // WithoutSharingFileAccess for why the actual lookup runs there instead.
    @AuraEnabled(cacheable=true)
    public static Map<Id, Id> getInvoiceFileIds() {
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            return new Map<Id, Id>();
        }

        Set<Id> invoiceIds = new Map<Id, Invoice__c>([
            SELECT Id
            FROM Invoice__c
            WHERE Account__c = :accountId
            WITH SECURITY_ENFORCED
            LIMIT 200
        ]).keySet();
        if (invoiceIds.isEmpty()) {
            return new Map<Id, Id>();
        }

        return WithoutSharingFileAccess.getLatestContentDocumentIdsByLinkedEntity(invoiceIds);
    }

    // Fetches the actual file bytes on demand (imperative, not cacheable -
    // only called when the user clicks Download, not preloaded for every
    // invoice up front). Returns them as base64 so the LWC can build a
    // data: URI download link, the same technique Reporting's CSV export
    // already uses on this site - linking directly to Salesforce's internal
    // file-download servlet path (/sfc/servlet.shepherd/...) doesn't work
    // here, since that's a core-domain path the Experience Cloud site's own
    // routing doesn't proxy through to; it 404s to the site's own "Invalid
    // Page" rather than ever reaching the file.
    @AuraEnabled
    public static InvoiceFile getInvoiceFileData(Id invoiceId) {
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            throw new AuraHandledException('Not authorized.');
        }

        List<Invoice__c> invoices = [
            SELECT Id
            FROM Invoice__c
            WHERE Id = :invoiceId
            AND Account__c = :accountId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (invoices.isEmpty()) {
            throw new AuraHandledException('Invoice not found.');
        }

        Map<Id, Id> contentDocumentIds = WithoutSharingFileAccess.getLatestContentDocumentIdsByLinkedEntity(
            new Set<Id>{ invoiceId }
        );
        if (!contentDocumentIds.containsKey(invoiceId)) {
            throw new AuraHandledException('No file is attached to this invoice.');
        }

        ContentVersion version = WithoutSharingFileAccess.getLatestContentVersion(contentDocumentIds.get(invoiceId));
        if (version == null) {
            throw new AuraHandledException('No file is attached to this invoice.');
        }

        InvoiceFile file = new InvoiceFile();
        file.fileName = String.isNotBlank(version.FileExtension)
            ? version.Title + '.' + version.FileExtension
            : version.Title;
        file.base64Data = EncodingUtil.base64Encode(version.VersionData);
        return file;
    }
}
