/**
 * Files uploaded via the standard "Add Files" button on a record can end up
 * with ContentDocumentLink.Visibility = 'InternalUsers' - a hard, platform-
 * level restriction that makes the file invisible to any external/Community
 * portal user no matter what sharing rules, CRUD, or permission sets say.
 * This was the actual root cause behind Invoices' "Download PDF" button
 * silently never finding a file for a real portal user, confirmed via
 * Execute Anonymous against a real connected org (see the Invoices section
 * of README.md for the full story) - fixed by hand for the files already
 * uploaded during that investigation, but that's a one-off; nothing stops
 * the same problem recurring for every future invoice file an internal user
 * uploads. This service auto-corrects it going forward, scoped to
 * Invoice__c specifically, so an internal user attaching a file to some
 * other, unrelated record is left alone.
 *
 * without sharing so the fix applies regardless of which internal user's
 * own sharing happens to allow updating this ContentDocumentLink - the scope
 * check below (is this actually linked to an Invoice__c) is the real access
 * control, not sharing.
 */
public without sharing class ContentDocumentLinkVisibilityService {

    private static final String ALL_USERS_VISIBILITY = 'AllUsers';

    public static void ensureAllUsersVisibilityForInvoiceFiles(List<ContentDocumentLink> newLinks) {
        Set<Id> candidateEntityIds = new Set<Id>();
        for (ContentDocumentLink link : newLinks) {
            if (link.Visibility != ALL_USERS_VISIBILITY) {
                candidateEntityIds.add(link.LinkedEntityId);
            }
        }
        if (candidateEntityIds.isEmpty()) {
            return;
        }

        Set<Id> invoiceIds = new Map<Id, Invoice__c>([
            SELECT Id FROM Invoice__c WHERE Id IN :candidateEntityIds
        ]).keySet();
        if (invoiceIds.isEmpty()) {
            return;
        }

        List<ContentDocumentLink> linksToFix = new List<ContentDocumentLink>();
        for (ContentDocumentLink link : newLinks) {
            if (invoiceIds.contains(link.LinkedEntityId) && link.Visibility != ALL_USERS_VISIBILITY) {
                linksToFix.add(new ContentDocumentLink(Id = link.Id, Visibility = ALL_USERS_VISIBILITY));
            }
        }
        if (!linksToFix.isEmpty()) {
            update linksToFix;
        }
    }
}
