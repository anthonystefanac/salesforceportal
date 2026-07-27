/**
 * Server-side backstop for two rules requestStaffForm already checks
 * client-side - both checks only ever lived in the LWC's JavaScript, so
 * anything that bypasses the form (Data Loader, a direct edit, a future
 * integration) could still save an invalid record. Called from
 * StaffingRequestTrigger's before insert/before update, not inline from
 * StaffingRequestService, so it also catches those other paths:
 * - End Time can't equal Start Time.
 * - Shift Date can't be in the past.
 *
 * Both rules use the same "don't re-block existing data" shape on update:
 * a save that leaves the relevant field(s) exactly as they already were is
 * let through, so pre-existing data doesn't need to be found and fixed (or
 * deleted) before this deploys, and an unrelated field edit to one of those
 * old records won't suddenly start failing. This matters a great deal for
 * the Shift Date rule specifically: a request's Shift Date is expected to
 * become "in the past" simply by the calendar advancing (that's exactly
 * what StaffingRequestMaintenanceService's daily overdue job acts on), so
 * this rule only blocks a save that actively introduces or keeps changing
 * into a past date, never a record that has merely become past-dated with
 * time or is being updated for an unrelated reason (e.g. that same overdue
 * job setting Status__c).
 */
public inherited sharing class StaffingRequestValidationService {

    // Lets a one-off data setup (e.g. a test simulating pre-existing legacy
    // data, or a future one-time data migration) skip these checks for
    // exactly the write that needs it, without weakening the rule for
    // everything else. Never toggled by portal-facing code paths.
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

    public static void validateShiftDateNotInPast(List<Staffing_Request__c> newRecords, Map<Id, Staffing_Request__c> oldMap) {
        if (bypassForTests) {
            return;
        }
        Date today = Date.today();
        for (Staffing_Request__c request : newRecords) {
            if (request.Shift_Date__c == null || request.Shift_Date__c >= today) {
                continue;
            }

            Staffing_Request__c previous = oldMap != null ? oldMap.get(request.Id) : null;
            Boolean dateUnchanged = previous != null && previous.Shift_Date__c == request.Shift_Date__c;
            if (dateUnchanged) {
                continue;
            }

            request.Shift_Date__c.addError('Shift Date cannot be in the past.');
        }
    }
}
