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

        try {
            insert sanitizedRequest;
        } catch (DmlException dmlError) {
            // Surfaces StaffingRequestValidationService's addError() message
            // to the LWC cleanly - an uncaught DmlException instead reaches
            // the client as a generic, unhelpful "Script-thrown exception".
            AuraHandledException friendlyError = new AuraHandledException(dmlError.getDmlMessage(0));
            friendlyError.setMessage(dmlError.getDmlMessage(0));
            throw friendlyError;
        }

        IWorkforceManagementService wfmService = WorkforceManagementServiceFactory.getService();
        sanitizedRequest.External_Demand_Id__c = wfmService.submitDemandRequest(sanitizedRequest);
        sanitizedRequest.Last_Status_Update__c = Datetime.now();
        update sanitizedRequest;

        return sanitizedRequest.Id;
    }
}
