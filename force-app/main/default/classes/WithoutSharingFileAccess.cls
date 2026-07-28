/**
 * Narrow without-sharing escape hatch for reading a file already linked to
 * a record the caller has independently verified the running user owns
 * (see InvoiceController.getInvoiceFileIds/getInvoiceFileData, which both
 * confirm the Invoice__c belongs to the running user's own Account via a
 * "with sharing" SELECT before ever calling into here). Needed because
 * ContentDocumentLink's own row-level visibility for external/portal users
 * doesn't reliably follow the linked record's sharing the way the standard
 * Files related list UI does - querying it from a "with sharing" context
 * returned zero rows for a portal user in testing, even though that same
 * user could see the file fine through the record's Files related list.
 * Mirrors the WithoutSharingDml pattern used for the same kind of
 * "ownership already confirmed, sharing model doesn't reach this far" gap
 * found with Staffing_Request__c/Facility__c. Object/field-level security
 * (CRUD/FLS) still applies as normal - only sharing is bypassed.
 */
public without sharing class WithoutSharingFileAccess {

    public static Map<Id, Id> getLatestContentDocumentIdsByLinkedEntity(Set<Id> linkedEntityIds) {
        Map<Id, Id> contentDocumentIdByLinkedEntityId = new Map<Id, Id>();
        if (linkedEntityIds == null || linkedEntityIds.isEmpty()) {
            return contentDocumentIdByLinkedEntityId;
        }

        // Ordered by the link's own SystemModstamp - ContentDocumentLink is
        // a restricted junction object with no CreatedDate/LastModifiedDate
        // field at all, only SystemModstamp. Deliberately not
        // ContentDocument.ContentModifiedDate: that would traverse into the
        // ContentDocument object via relationship, needing its own object
        // permission grant on top of ContentVersion's. SystemModstamp avoids
        // that entirely (when a file was linked to this record is a fine
        // proxy for "most recent" here anyway).
        List<ContentDocumentLink> links = [
            SELECT LinkedEntityId, ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :linkedEntityIds
            ORDER BY SystemModstamp DESC
        ];
        for (ContentDocumentLink link : links) {
            if (!contentDocumentIdByLinkedEntityId.containsKey(link.LinkedEntityId)) {
                contentDocumentIdByLinkedEntityId.put(link.LinkedEntityId, link.ContentDocumentId);
            }
        }
        return contentDocumentIdByLinkedEntityId;
    }

    public static ContentVersion getLatestContentVersion(Id contentDocumentId) {
        List<ContentVersion> versions = [
            SELECT Title, FileExtension, VersionData
            FROM ContentVersion
            WHERE ContentDocumentId = :contentDocumentId
            AND IsLatest = true
            LIMIT 1
        ];
        return versions.isEmpty() ? null : versions[0];
    }
}
