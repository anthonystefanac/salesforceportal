/**
 * MOCK — replace with a real Bullhorn / Classic Scheduler callout implementation
 * of IWorkforceManagementService once that system is connected. Returns
 * deterministic, clearly-fake data so the Request/Track portal flows can be
 * built and demoed before the real integration exists.
 */
public class MockWorkforceManagementService implements IWorkforceManagementService {

    public String submitDemandRequest(Staffing_Request__c request) {
        return 'WFM-' + String.valueOf(Datetime.now().getTime());
    }

    public WorkforceManagementDemandStatus getDemandStatus(String externalDemandId) {
        return new WorkforceManagementDemandStatus('Broadcasted', Datetime.now());
    }
}
