/**
 * Resolves the Contact/Account behind the current Experience Cloud user.
 * Every portal controller shares this instead of repeating the same lookup.
 */
public with sharing class PortalUserContext {

    public static Id getCurrentContactId() {
        List<User> users = [SELECT ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        return users.isEmpty() ? null : users[0].ContactId;
    }

    public static Id getCurrentAccountId() {
        Id contactId = getCurrentContactId();
        if (contactId == null) {
            return null;
        }
        List<Contact> contacts = [
            SELECT AccountId
            FROM Contact
            WHERE Id = :contactId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        return contacts.isEmpty() ? null : contacts[0].AccountId;
    }
}
