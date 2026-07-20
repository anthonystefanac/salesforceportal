public with sharing class FacilityController {

    @AuraEnabled(cacheable=true)
    public static List<Facility__c> getFacilitiesForCurrentUser() {
        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId == null) {
            return new List<Facility__c>();
        }
        return [
            SELECT Id, Name, Facility_Type__c, Address_Suburb__c, Address_State__c
            FROM Facility__c
            WHERE Account__c = :accountId AND Active__c = true
            WITH SECURITY_ENFORCED
            ORDER BY Name ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Ward__c> getWardsForFacility(Id facilityId) {
        if (facilityId == null) {
            return new List<Ward__c>();
        }
        return [
            SELECT Id, Name
            FROM Ward__c
            WHERE Facility__c = :facilityId
            WITH SECURITY_ENFORCED
            ORDER BY Name ASC
        ];
    }
}
