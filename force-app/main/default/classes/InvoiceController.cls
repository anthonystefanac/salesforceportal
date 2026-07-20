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
}
