/**
 * Server-side backstop for the same "End Time can't equal Start Time" rule
 * requestStaffForm already checks client-side - that check only lives in the
 * LWC's JavaScript, so anything that bypasses the form (Data Loader, a
 * direct edit, a future integration) could still save an invalid pair.
 * Called from StaffingRequestTrigger's before insert/before update, not
 * inline from StaffingRequestService, so it also catches those other paths.
 *
 * Records that already had equal Start/End times before this validation
 * existed are deliberately not re-blocked on every future save: an update
 * that leaves both times exactly as they already were is let through, so
 * pre-existing data doesn't need to be found and fixed (or deleted) before
 * this deploys, and an unrelated field edit to one of those old records
 * won't suddenly start failing. Only a save that actively introduces or
 * keeps changing into an equal pair is blocked.
 */
public inherited sharing class StaffingRequestValidationService {

    // Lets a one-off data setup (e.g. a test simulating pre-existing legacy
    // data, or a future one-time data migration) skip this check for exactly
    // the write that needs it, without weakening the rule for everything
    // else. Never toggled by portal-facing code paths.
    @TestVisible
    private static Boolean bypassForTests = false;

    public static void validateStartEndTimes(List<Staffing_Request__c> newRecords, Map<Id, Staffing_Request__c> oldMap) {
        if (bypassForTests) {
            return;
        }
        for (Staffing_Request__c request : newRecords) {
            if (request.Start_Time__c == null || request.End_Time__c == null) {
                continue;
            }
            if (request.Start_Time__c != request.End_Time__c) {
                continue;
            }

            Staffing_Request__c previous = oldMap != null ? oldMap.get(request.Id) : null;
            Boolean timesUnchanged = previous != null
                && previous.Start_Time__c == request.Start_Time__c
                && previous.End_Time__c == request.End_Time__c;
            if (timesUnchanged) {
                continue;
            }

            request.End_Time__c.addError('End Time cannot be the same as Start Time.');
        }
    }
}
