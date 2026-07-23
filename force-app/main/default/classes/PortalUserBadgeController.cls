public with sharing class PortalUserBadgeController {

    @AuraEnabled(cacheable=true)
    public static PortalUserBadge getCurrentUserBadge() {
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
