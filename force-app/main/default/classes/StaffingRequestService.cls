/**
 * Domain logic for submitting a new staffing request. Strips any field the
 * portal user isn't permitted to set before trusting server-set fields
 * (requester, status), then hands the request to the Workforce Management
 * integration boundary to obtain an external demand id.
 */
public with sharing class StaffingRequestService {

    public static Id submitNewRequest(Staffing_Request__c request) {
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.CREATABLE,
            new List<Staffing_Request__c>{ request }
        );
        Staffing_Request__c sanitizedRequest = (Staffing_Request__c) decision.getRecords()[0];

        sanitizedRequest.Requested_By_Contact__c = PortalUserContext.getCurrentContactId();
        sanitizedRequest.Status__c = 'Submitted';

        // Facility/Ward come straight from client input (the id of whatever
        // the user picked). stripInaccessible only checks field/object level
        // security, not whether this specific Facility/Ward record is one
        // this user's Account can actually see - a stale or cross-account id
        // would otherwise reach the insert below and fail there with a raw
        // "insufficient access rights on cross-reference id" DmlException,
        // which is technically correct but not an actionable message for a
        // portal user. Checking it here turns that into a clear message
        // pointing at what to do (refresh and re-select). This check is
        // also *why* the DML below is safe to run without sharing (see
        // WithoutSharingDml).
        validateFacilityAndWardAccess(sanitizedRequest);

        try {
            WithoutSharingDml.insertRecord(sanitizedRequest);
        } catch (DmlException dmlError) {
            // Surfaces StaffingRequestValidationService's addError() message
            // to the LWC cleanly - an uncaught DmlException instead reaches
            // the client as a generic, unhelpful "Script-thrown exception".
            throw friendlyError(dmlError.getDmlMessage(0));
        }

        IWorkforceManagementService wfmService = WorkforceManagementServiceFactory.getService();
        sanitizedRequest.External_Demand_Id__c = wfmService.submitDemandRequest(sanitizedRequest);
        sanitizedRequest.Last_Status_Update__c = Datetime.now();
        WithoutSharingDml.updateRecord(sanitizedRequest);

        return sanitizedRequest.Id;
    }

    private static void validateFacilityAndWardAccess(Staffing_Request__c request) {
        if (request.Facility__c == null) {
            return;
        }

        Id currentAccountId = PortalUserContext.getCurrentAccountId();
        List<Facility__c> accessibleFacilities = [
            SELECT Id
            FROM Facility__c
            WHERE Id = :request.Facility__c AND Account__c = :currentAccountId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (accessibleFacilities.isEmpty()) {
            throw friendlyError('The selected facility is no longer available to you. Please refresh the page and choose a facility again.');
        }

        if (request.Ward__c == null) {
            return;
        }

        List<Ward__c> accessibleWards = [
            SELECT Id
            FROM Ward__c
            WHERE Id = :request.Ward__c AND Facility__c = :request.Facility__c
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (accessibleWards.isEmpty()) {
            throw friendlyError('The selected ward is no longer available for this facility. Please refresh the page and choose a ward again.');
        }
    }

    private static AuraHandledException friendlyError(String message) {
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }
}
