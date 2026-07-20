/**
 * Domain logic for the client approve/query timesheet actions. Field history
 * tracking on Approval_Status__c and Query_Comment__c (enabled on the object)
 * is what supplies the client-facing audit trail called for in the MVP spec.
 */
public with sharing class TimesheetService {

    public static void approveTimesheet(Id timesheetId) {
        applyUpdate(new Timesheet__c(
            Id = timesheetId,
            Approval_Status__c = 'Approved',
            Approved_Date__c = Datetime.now(),
            Approved_By__c = PortalUserContext.getCurrentContactId()
        ));
    }

    public static void queryTimesheet(Id timesheetId, String comment) {
        applyUpdate(new Timesheet__c(
            Id = timesheetId,
            Approval_Status__c = 'Queried',
            Query_Comment__c = comment,
            Approved_By__c = PortalUserContext.getCurrentContactId()
        ));
    }

    private static void applyUpdate(Timesheet__c timesheet) {
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.UPDATABLE,
            new List<Timesheet__c>{ timesheet }
        );
        update decision.getRecords();
    }
}
