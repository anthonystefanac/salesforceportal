/**
 * Domain logic for submitting a Support/Query Case from the portal. Mirrors
 * StaffingRequestService's pattern: strip inaccessible fields, force the
 * server-set requester, then send a confirmation email. Email failure never
 * blocks the Case itself from being submitted - it's a nice-to-have, not the
 * core function.
 *
 * Also the entry point for cancellation requests, whichever screen submits
 * one (myStaffingRequests' per-row action today) - a Cancellation Request
 * Case here also flags Staffing_Request__c.Cancellation_Requested__c and
 * copies Cancelled_By__c onto the related record, since both fields are
 * portal read-only (server-set only) and nothing else in the codebase ever
 * sets them.
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

        if (sanitizedCase.Portal_Request_Type__c == 'Cancellation Request'
            && sanitizedCase.Related_Staffing_Request__c != null) {
            flagCancellationRequested(sanitizedCase.Related_Staffing_Request__c, sanitizedCase.Cancelled_By__c);
        }

        try {
            sendConfirmationEmail(sanitizedCase);
        } catch (Exception emailError) {
            System.debug(LoggingLevel.WARN, 'Support request confirmation email failed: ' + emailError.getMessage());
        }

        return sanitizedCase.Id;
    }

    // Mirrors StaffingRequestService.validateFacilityAndWardAccess: the same
    // Sharing Set cascade gap (Staffing_Request__c is two Master-Detail hops
    // from Account, via Facility__c) that blocks a "with sharing" insert
    // also blocks a "with sharing" update to a field on an *existing*
    // record. The ownership check below is the real access control (it
    // independently confirms this Staffing_Request__c belongs to the
    // requesting user's own Account), which is what makes it safe to then
    // do the update without sharing (see WithoutSharingDml) rather than
    // depend on a mechanism proven not to cover this case. If the request
    // doesn't belong to the user's Account - not reachable through normal
    // use, since the id always comes from the user's own My Requests list -
    // this skips the flag rather than failing the whole Case submission
    // over it.
    private static void flagCancellationRequested(Id staffingRequestId, String cancelledBy) {
        Id currentAccountId = PortalUserContext.getCurrentAccountId();
        List<Staffing_Request__c> ownRequests = [
            SELECT Id
            FROM Staffing_Request__c
            WHERE Id = :staffingRequestId AND Facility__r.Account__c = :currentAccountId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (ownRequests.isEmpty()) {
            return;
        }

        WithoutSharingDml.updateRecord(new Staffing_Request__c(
            Id = staffingRequestId,
            Cancellation_Requested__c = true,
            Cancelled_By__c = cancelledBy
        ));
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
            + 'Date: ' + DateFormatUtil.format(relatedRequest.Shift_Date__c) + '\n'
            + 'Facility: ' + (relatedRequest.Facility__r != null ? relatedRequest.Facility__r.Name : '') + '\n'
            + 'Ward: ' + (relatedRequest.Ward__r != null ? relatedRequest.Ward__r.Name : 'N/A') + '\n'
            + 'Role: ' + relatedRequest.Role__c + '\n'
            + 'Start Time: ' + TimeFormatUtil.format(relatedRequest.Start_Time__c) + '\n';
    }
}
