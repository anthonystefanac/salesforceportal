trigger StaffingRequestTrigger on Staffing_Request__c (after insert, after update) {
    if (Trigger.isInsert) {
        StaffingRequestNotificationService.notifyOnSubmit(Trigger.new);
    } else if (Trigger.isUpdate) {
        StaffingRequestNotificationService.notifyOnStatusChange(Trigger.new, Trigger.oldMap);
    }
}
