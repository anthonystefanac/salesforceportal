/**
 * Scheduled entry point for StaffingRequestMaintenanceService. This class
 * isn't self-scheduling - an admin must activate it once via Setup -> Apex
 * Classes -> Schedule Apex (or System.schedule in Anonymous Apex), since a
 * running scheduled job is org runtime state, not metadata that deploys on
 * its own. See README's "Scheduled jobs" section.
 */
public without sharing class StaffingRequestOverdueScheduler implements Schedulable {
    public void execute(SchedulableContext context) {
        StaffingRequestMaintenanceService.markOverdueRequestsUnableToFill();
    }
}
