/**
 * Narrow escape hatch for DML that a caller has already independently
 * validated is safe, for cases where Salesforce's own sharing enforcement
 * doesn't cover it. Both current callers hit the same root cause: a
 * Staffing_Request__c is two Master-Detail hops from Account (via
 * Facility__c), and the Sharing Set's cascade doesn't extend far enough to
 * satisfy Salesforce's own cross-reference/row check at DML time - even
 * though the exact same record reads fine through a "with sharing" SELECT
 * moments earlier (see StaffingRequestService.validateFacilityAndWardAccess
 * and SupportRequestService.flagCancellationRequested, which each run that
 * equivalent SELECT and treat it as the real access control before ever
 * calling into here). This bypasses sharing for the DML only - object/field
 * level security (CRUD/FLS) and all trigger logic still apply as normal.
 *
 * Being a top-level `without sharing` class rather than a `with sharing`
 * caller's own inner class means the DML methods can be plain static calls
 * (Apex doesn't allow static methods on inner classes at all), and this one
 * implementation is shared instead of being duplicated per caller.
 */
public without sharing class WithoutSharingDml {
    public static void insertRecord(SObject record) {
        insert record;
    }

    public static void updateRecord(SObject record) {
        update record;
    }
}
