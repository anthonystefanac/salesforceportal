public with sharing class PortalUserBadgeController {

    // Before a portal user actually logs in, Experience Cloud pages (the
    // Login page in particular) can still run under the site's Guest User -
    // a real, queryable User record with a real Name, not an absent/null
    // running user. Returning that Guest User's details here would let this
    // badge (and its Log Out action) render as if someone were logged in on
    // a page where nobody is - so this returns an empty badge instead,
    // before ever running the query below, whenever the running context is
    // the Guest User rather than an authenticated portal user.
    @AuraEnabled(cacheable=true)
    public static PortalUserBadge getCurrentUserBadge() {
        if (UserInfo.getUserType() == 'Guest') {
            return new PortalUserBadge();
        }

        List<User> users = [SELECT Name FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];

        PortalUserBadge badge = new PortalUserBadge();
        badge.userName = users.isEmpty() ? null : users[0].Name;

        Id accountId = PortalUserContext.getCurrentAccountId();
        if (accountId != null) {
            List<Account> accounts = [
                SELECT Name
                FROM Account
                WHERE Id = :accountId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            badge.accountName = accounts.isEmpty() ? null : accounts[0].Name;
        }
        return badge;
    }

    public class PortalUserBadge {
        @AuraEnabled public String userName;
        @AuraEnabled public String accountName;
    }
}
