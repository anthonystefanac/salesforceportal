/**
 * MOCK — replace with a real 2Cloud9 callout implementation of
 * I2Cloud9InvoiceService once that system is connected. Invoices in this
 * build are read-only Phase 1 records maintained directly in Salesforce;
 * syncInvoices is a deliberate no-op until the real sync exists.
 */
public class Mock2Cloud9InvoiceService implements I2Cloud9InvoiceService {

    public List<Invoice__c> syncInvoices(Id accountId) {
        return new List<Invoice__c>();
    }

    public Blob getInvoicePdf(String externalInvoiceId) {
        return Blob.valueOf('Mock invoice PDF placeholder for ' + externalInvoiceId);
    }
}
