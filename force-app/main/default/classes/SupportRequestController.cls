public with sharing class SupportRequestController {

    @AuraEnabled
    public static Id createCase(Case newCase) {
        return SupportRequestService.submitNewCase(newCase);
    }
}
