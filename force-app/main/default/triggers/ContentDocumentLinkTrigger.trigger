trigger ContentDocumentLinkTrigger on ContentDocumentLink (after insert) {
    ContentDocumentLinkVisibilityService.ensureAllUsersVisibilityForInvoiceFiles(Trigger.new);
}
