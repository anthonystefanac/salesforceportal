/**
 * Domain logic for submitting a Support/Query Case from the portal. Mirrors
 * StaffingRequestService's pattern: strip inaccessible fields, force the
 * server-set requester, then send a confirmation email. Email failure never
 * blocks the Case itself from being submitted - it's a nice-to-have, not the
 * core function.
 */
public with sharing class SupportRequestService {

    public static Id submitNewCase(Case newCase) {
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.CREATABLE,
            new List<Case>{ newCase }
        );
        Case sanitizedCase = (Case) decision.getRecords()[0];

        sanitizedCase.ContactId = PortalUserContext.getCurrentContactId();
        insert sanitizedCase;

        try {
            sendConfirmationEmail(sanitizedCase);
        } catch (Exception emailError) {
            System.debug(LoggingLevel.WARN, 'Support request confirmation email failed: ' + emailError.getMessage());
        }

        return sanitizedCase.Id;
    }

    private static void sendConfirmationEmail(Case submittedCase) {
        if (submittedCase.ContactId == null) {
            return;
        }

        String body = 'Your support request has been submitted.\n\n'
            + 'Request Type: ' + submittedCase.Portal_Request_Type__c + '\n'
            + 'Subject: ' + submittedCase.Subject + '\n'
            + relatedStaffingRequestDetails(submittedCase.Related_Staffing_Request__c);

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setTargetObjectId(submittedCase.ContactId);
        email.setSubject('Support Request Received: ' + submittedCase.Subject);
        email.setPlainTextBody(body);
        email.setSaveAsActivity(false);

        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
    }

    private static String relatedStaffingRequestDetails(Id relatedRequestId) {
        if (relatedRequestId == null) {
            return '';
        }

        List<Staffing_Request__c> relatedRequests = [
            SELECT Shift_Date__c, Start_Time__c, Role__c, Facility__r.Name, Ward__r.Name
            FROM Staffing_Request__c
            WHERE Id = :relatedRequestId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (relatedRequests.isEmpty()) {
            return '';
        }

        Staffing_Request__c relatedRequest = relatedRequests[0];
        return '\nRelated Staffing Request:\n'
            + 'Date: ' + (relatedRequest.Shift_Date__c != null ? relatedRequest.Shift_Date__c.format() : '') + '\n'
            + 'Facility: ' + (relatedRequest.Facility__r != null ? relatedRequest.Facility__r.Name : '') + '\n'
            + 'Ward: ' + (relatedRequest.Ward__r != null ? relatedRequest.Ward__r.Name : 'N/A') + '\n'
            + 'Role: ' + relatedRequest.Role__c + '\n'
            + 'Start Time: ' + formatTime(relatedRequest.Start_Time__c) + '\n';
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
