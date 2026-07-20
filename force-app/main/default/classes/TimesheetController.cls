public with sharing class TimesheetController {

    @AuraEnabled(cacheable=true)
    public static List<Timesheet__c> getPendingTimesheets() {
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            return new List<Timesheet__c>();
        }
        return [
            SELECT Id, Name, Staffing_Request__c, Staffing_Request__r.Name,
                   Staffing_Request__r.Facility__r.Name, Contact__r.Name, Shift_Date__c,
                   Hours_Worked__c, Approval_Status__c, Approved_Date__c, Query_Comment__c
            FROM Timesheet__c
            WHERE Staffing_Request__r.Facility__r.Account__c = :accountId
            AND Approval_Status__c = 'Pending Review'
            WITH SECURITY_ENFORCED
            ORDER BY Shift_Date__c ASC
            LIMIT 200
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Timesheet__c> getTimesheetHistory(Id staffingRequestId) {
        return [
            SELECT Id, Name, Shift_Date__c, Hours_Worked__c, Approval_Status__c,
                   Approved_Date__c, Query_Comment__c
            FROM Timesheet__c
            WHERE Staffing_Request__c = :staffingRequestId
            WITH SECURITY_ENFORCED
            ORDER BY Shift_Date__c DESC
        ];
    }

    @AuraEnabled
    public static void approveTimesheet(Id timesheetId) {
        TimesheetService.approveTimesheet(timesheetId);
    }

    @AuraEnabled
    public static void queryTimesheet(Id timesheetId, String comment) {
        TimesheetService.queryTimesheet(timesheetId, comment);
    }
}
