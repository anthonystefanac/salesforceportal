/**
 * Emails the requesting Contact when a Staffing_Request__c is submitted, and
 * again whenever its Status__c changes to Filled, Unable to Fill, or
 * Cancelled. Called from StaffingRequestTrigger rather than inline from the
 * Apex that creates/updates these records, specifically so it also catches
 * status changes made directly on the record - e.g. an internal user marking
 * a request Filled or Cancelled by hand, which today has no other code path -
 * not just the scheduled overdue job. Runs without sharing for the same
 * reason StaffingRequestMaintenanceService does: it must not silently skip a
 * notification because the triggering user's sharing access doesn't cover
 * some record in the batch.
 */
public without sharing class StaffingRequestNotificationService {

    private static final Set<String> STATUS_CHANGE_NOTIFY_STATUSES = new Set<String>{
        'Filled', 'Unable to Fill', 'Cancelled'
    };

    public static void notifyOnSubmit(List<Staffing_Request__c> newRequests) {
        Set<Id> requestIds = idsOf(newRequests);
        if (requestIds.isEmpty()) {
            return;
        }

        List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();
        for (Staffing_Request__c request : queryDetails(requestIds)) {
            addEmail(emails, request, submitSubject(request), submitBody(request));
        }
        sendAll(emails);
    }

    public static void notifyOnStatusChange(List<Staffing_Request__c> newRequests, Map<Id, Staffing_Request__c> oldMap) {
        Set<Id> changedIds = new Set<Id>();
        for (Staffing_Request__c request : newRequests) {
            Staffing_Request__c previous = oldMap.get(request.Id);
            if (previous != null
                && request.Status__c != previous.Status__c
                && STATUS_CHANGE_NOTIFY_STATUSES.contains(request.Status__c)) {
                changedIds.add(request.Id);
            }
        }
        if (changedIds.isEmpty()) {
            return;
        }

        List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();
        for (Staffing_Request__c request : queryDetails(changedIds)) {
            addEmail(emails, request, statusChangeSubject(request), statusChangeBody(request));
        }
        sendAll(emails);
    }

    private static Set<Id> idsOf(List<Staffing_Request__c> requests) {
        Set<Id> ids = new Set<Id>();
        for (Staffing_Request__c request : requests) {
            ids.add(request.Id);
        }
        return ids;
    }

    private static List<Staffing_Request__c> queryDetails(Set<Id> ids) {
        return [
            SELECT Name, Status__c, Role__c, Shift_Date__c, Start_Time__c, End_Time__c, Quantity__c,
                   Facility__r.Name, Ward__r.Name, Requested_By_Contact__c
            FROM Staffing_Request__c
            WHERE Id IN :ids
        ];
    }

    private static void addEmail(
        List<Messaging.SingleEmailMessage> emails,
        Staffing_Request__c request,
        String subject,
        String body
    ) {
        if (request.Requested_By_Contact__c == null) {
            return;
        }
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setTargetObjectId(request.Requested_By_Contact__c);
        email.setSubject(subject);
        email.setPlainTextBody(body);
        email.setSaveAsActivity(false);
        emails.add(email);
    }

    // Batched into a single Messaging.sendEmail call regardless of how many
    // requests changed - Apex allows only 10 calls to this method per
    // transaction, but each call can carry any number of messages, so a
    // scheduled job resolving many overdue requests at once must not call it
    // once per record.
    private static void sendAll(List<Messaging.SingleEmailMessage> emails) {
        if (emails.isEmpty()) {
            return;
        }
        try {
            Messaging.sendEmail(emails);
        } catch (Exception emailError) {
            System.debug(LoggingLevel.WARN, 'Staffing request notification email failed: ' + emailError.getMessage());
        }
    }

    private static String submitSubject(Staffing_Request__c request) {
        return 'Staffing Request Submitted: ' + request.Name;
    }

    private static String submitBody(Staffing_Request__c request) {
        return 'Your staffing request has been submitted.\n\n' + detailLines(request);
    }

    private static String statusChangeSubject(Staffing_Request__c request) {
        return 'Staffing Request ' + request.Status__c + ': ' + request.Name;
    }

    private static String statusChangeBody(Staffing_Request__c request) {
        return 'Your staffing request status has changed to ' + request.Status__c + '.\n\n' + detailLines(request);
    }

    private static String detailLines(Staffing_Request__c request) {
        return 'Request: ' + request.Name + '\n'
            + 'Facility: ' + (request.Facility__r != null ? request.Facility__r.Name : '') + '\n'
            + 'Ward: ' + (request.Ward__r != null ? request.Ward__r.Name : 'N/A') + '\n'
            + 'Role: ' + request.Role__c + '\n'
            + 'Shift Date: ' + (request.Shift_Date__c != null ? request.Shift_Date__c.format() : '') + '\n'
            + 'Start Time: ' + formatTime(request.Start_Time__c) + '\n'
            + 'End Time: ' + formatTime(request.End_Time__c) + '\n'
            + 'Quantity: ' + request.Quantity__c + '\n'
            + 'Status: ' + request.Status__c + '\n';
    }

    // Apex's Time class has no .format() method (unlike Date/Datetime), so
    // build a simple HH:MM string from its hour()/minute() accessors.
    private static String formatTime(Time value) {
        if (value == null) {
            return '';
        }
        return String.valueOf(value.hour()).leftPad(2, '0') + ':' + String.valueOf(value.minute()).leftPad(2, '0');
    }
}
