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
        insert sanitizedRequest;

        IWorkforceManagementService wfmService = WorkforceManagementServiceFactory.getService();
        sanitizedRequest.External_Demand_Id__c = wfmService.submitDemandRequest(sanitizedRequest);
        sanitizedRequest.Last_Status_Update__c = Datetime.now();
        update sanitizedRequest;

        return sanitizedRequest.Id;
    }
}
