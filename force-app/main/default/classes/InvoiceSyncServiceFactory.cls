/**
 * Single swap point for the 2Cloud9 invoicing integration. Callers only ever
 * go through this factory, so connecting the real system later means
 * changing the one line below, nothing else.
 */
public class InvoiceSyncServiceFactory {

    public static I2Cloud9InvoiceService getService() {
        // MOCK — swap this line for the real 2Cloud9 implementation once
        // that integration is connected.
        return new Mock2Cloud9InvoiceService();
    }
}
