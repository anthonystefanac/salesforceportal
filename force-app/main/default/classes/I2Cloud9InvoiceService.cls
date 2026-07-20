/**
 * Integration boundary for 2Cloud9 (invoicing/payroll). Not connected in this
 * build — see InvoiceSyncServiceFactory for the swap point.
 */
public interface I2Cloud9InvoiceService {
    List<Invoice__c> syncInvoices(Id accountId);
    Blob getInvoicePdf(String externalInvoiceId);
}
