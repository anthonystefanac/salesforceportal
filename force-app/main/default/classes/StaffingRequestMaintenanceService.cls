/**
 * System-level housekeeping for staffing requests, run on a schedule rather
 * than in response to a portal user action - see StaffingRequestOverdueScheduler.
 * Runs without sharing since it must catch overdue requests across every
 * client Account, not just those visible to whichever user's scheduled job
 * happens to run it.
 */
public without sharing class StaffingRequestMaintenanceService {

    private static final Set<String> UNRESOLVED_STATUSES = new Set<String>{
        'Submitted', 'Being Worked', 'Broadcasted'
    };

    public static Integer markOverdueRequestsUnableToFill() {
        List<Staffing_Request__c> overdueRequests = [
            SELECT Id
            FROM Staffing_Request__c
            WHERE Shift_Date__c < :Date.today()
            AND Status__c IN :UNRESOLVED_STATUSES
        ];

        for (Staffing_Request__c request : overdueRequests) {
            request.Status__c = 'Unable to Fill';
            request.Last_Status_Update__c = Datetime.now();
        }

        if (!overdueRequests.isEmpty()) {
            update overdueRequests;
        }

        return overdueRequests.size();
    }
}
