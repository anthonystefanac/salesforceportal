/**
 * Integration boundary for the Workforce Management system (Bullhorn / Classic Scheduler).
 * Not connected in this build — see WorkforceManagementServiceFactory for the swap point.
 */
public interface IWorkforceManagementService {
    String submitDemandRequest(Staffing_Request__c request);
    WorkforceManagementDemandStatus getDemandStatus(String externalDemandId);
}
