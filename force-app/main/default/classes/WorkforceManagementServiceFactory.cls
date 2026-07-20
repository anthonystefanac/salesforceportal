/**
 * Single swap point for the Workforce Management (Bullhorn / Classic Scheduler)
 * integration. Callers (StaffingRequestService, etc.) only ever go through this
 * factory, never instantiate an implementation directly — so connecting the
 * real system later means changing the one line below, nothing else.
 */
public class WorkforceManagementServiceFactory {

    public static IWorkforceManagementService getService() {
        // MOCK — swap this line for the real Bullhorn/Classic Scheduler
        // implementation once that integration is connected.
        return new MockWorkforceManagementService();
    }
}
