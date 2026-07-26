trigger StaffingRequestTrigger on Staffing_Request__c (before insert, before update, after insert, after update) {
    if (Trigger.isBefore) {
        StaffingRequestValidationService.validateStartEndTimes(
            Trigger.new,
            Trigger.isUpdate ? Trigger.oldMap : null
        );
    } else if (Trigger.isInsert) {
        StaffingRequestNotificationService.notifyOnSubmit(Trigger.new);
    } else if (Trigger.isUpdate) {
        StaffingRequestNotificationService.notifyOnStatusChange(Trigger.new, Trigger.oldMap);
    }
}
