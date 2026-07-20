public with sharing class StaffingRequestController {

    @AuraEnabled(cacheable=true)
    public static List<Staffing_Request__c> getMyRequests() {
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            return new List<Staffing_Request__c>();
        }
        return [
            SELECT Id, Name, Facility__r.Name, Ward__r.Name, Role__c, Specialty__c,
                   Shift_Date__c, Start_Time__c, End_Time__c, Quantity__c, Priority__c,
                   Status__c, Broadcasted_Date__c, Last_Status_Update__c,
                   Cancellation_Requested__c
            FROM Staffing_Request__c
            WHERE Facility__r.Account__c = :accountId
            WITH SECURITY_ENFORCED
            ORDER BY Shift_Date__c DESC
            LIMIT 200
        ];
    }

    @AuraEnabled
    public static Id createRequest(Staffing_Request__c newRequest) {
        return StaffingRequestService.submitNewRequest(newRequest);
    }
}
