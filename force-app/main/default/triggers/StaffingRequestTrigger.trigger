trigger StaffingRequestTrigger on Staffing_Request__c (before insert, before update, after insert, after update) {
    if (Trigger.isBefore) {
        Map<Id, Staffing_Request__c> oldMap = Trigger.isUpdate ? Trigger.oldMap : null;
        StaffingRequestValidationService.validateStartEndTimes(Trigger.new, oldMap);
        StaffingRequestValidationService.validateShiftDateNotInPast(Trigger.new, oldMap);
    } else if (Trigger.isInsert) {
        StaffingRequestNotificationService.notifyOnSubmit(Trigger.new);
    } else if (Trigger.isUpdate) {
        StaffingRequestNotificationService.notifyOnStatusChange(Trigger.new, Trigger.oldMap);
    }
}
