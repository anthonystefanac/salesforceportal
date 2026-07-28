public with sharing class PortalDashboardController {

    public class DashboardSummary {
        @AuraEnabled public Integer openRequestCount;
        @AuraEnabled public Integer unfilledShiftCount;
        @AuraEnabled public Integer filledShiftCount;
        @AuraEnabled public Integer cancelledShiftCount;
        @AuraEnabled public Integer overdueInvoiceCount;
    }

    @AuraEnabled(cacheable=true)
    public static DashboardSummary getDashboardSummary() {
        DashboardSummary summary = new DashboardSummary();
        Id accountId = PortalUserContext.getCurrentAccountId();

        if (accountId == null) {
            summary.openRequestCount = 0;
            summary.unfilledShiftCount = 0;
            summary.filledShiftCount = 0;
            summary.cancelledShiftCount = 0;
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

        // Unable to Fill/Filled/Cancelled are all scoped to today onwards,
        // matching My Requests. Unable to Fill isn't only ever historical:
        // the daily overdue job sets it on a shift whose date has already
        // passed, but Bullhorn can also flag a future shift Unable to Fill
        // ahead of time if no staff are available for it - both cases are
        // real, current-facing information, so this counts the same way
        // Filled/Cancelled do rather than as an all-time total.
        List<AggregateResult> unfilledShifts = [
            SELECT COUNT(Id) total
            FROM Staffing_Request__c
            WHERE Facility__r.Account__c = :accountId
            AND Status__c = 'Unable to Fill'
            AND Shift_Date__c >= TODAY
            WITH SECURITY_ENFORCED
        ];
        summary.unfilledShiftCount = (Integer) unfilledShifts[0].get('total');

        List<AggregateResult> filledShifts = [
            SELECT COUNT(Id) total
            FROM Staffing_Request__c
            WHERE Facility__r.Account__c = :accountId
            AND Status__c = 'Filled'
            AND Shift_Date__c >= TODAY
            WITH SECURITY_ENFORCED
        ];
        summary.filledShiftCount = (Integer) filledShifts[0].get('total');

        List<AggregateResult> cancelledShifts = [
            SELECT COUNT(Id) total
            FROM Staffing_Request__c
            WHERE Facility__r.Account__c = :accountId
            AND Status__c = 'Cancelled'
            AND Shift_Date__c >= TODAY
            WITH SECURITY_ENFORCED
        ];
        summary.cancelledShiftCount = (Integer) cancelledShifts[0].get('total');

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
