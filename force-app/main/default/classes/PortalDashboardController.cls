public with sharing class PortalDashboardController {

    public class DashboardSummary {
        @AuraEnabled public Integer openRequestCount;
        @AuraEnabled public Integer atRiskShiftCount;
        @AuraEnabled public Integer overdueInvoiceCount;
    }

    @AuraEnabled(cacheable=true)
    public static DashboardSummary getDashboardSummary() {
        DashboardSummary summary = new DashboardSummary();
        Id accountId = PortalUserContext.getCurrentAccountId();

        if (accountId == null) {
            summary.openRequestCount = 0;
            summary.atRiskShiftCount = 0;
            summary.overdueInvoiceCount = 0;
            return summary;
        }

        List<AggregateResult> openRequests = [
            SELECT COUNT(Id) total
            FROM Staffing_Request__c
            WHERE Facility__r.Account__c = :accountId
            AND Status__c NOT IN ('Filled', 'Unable to Fill', 'Cancelled')
            WITH SECURITY_ENFORCED
        ];
        summary.openRequestCount = (Integer) openRequests[0].get('total');

        List<AggregateResult> atRiskShifts = [
            SELECT COUNT(Id) total
            FROM Staffing_Request__c
            WHERE Facility__r.Account__c = :accountId
            AND Status__c = 'Unable to Fill'
            WITH SECURITY_ENFORCED
        ];
        summary.atRiskShiftCount = (Integer) atRiskShifts[0].get('total');

        List<AggregateResult> overdueInvoices = [
            SELECT COUNT(Id) total
            FROM Invoice__c
            WHERE Account__c = :accountId
            AND Status__c = 'Overdue'
            WITH SECURITY_ENFORCED
        ];
        summary.overdueInvoiceCount = (Integer) overdueInvoices[0].get('total');

        return summary;
    }
}
