/**
 * Data shape returned by IWorkforceManagementService.getDemandStatus.
 */
public class WorkforceManagementDemandStatus {
    public String status;
    public Datetime broadcastedDate;

    public WorkforceManagementDemandStatus(String status, Datetime broadcastedDate) {
        this.status = status;
        this.broadcastedDate = broadcastedDate;
    }
}
