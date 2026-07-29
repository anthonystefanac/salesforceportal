@isTest
private class PortalUserBadgeControllerTest {

    @isTest
    static void testReturnsUserNameButNoAccountForNonPortalRunningUser() {
        Test.startTest();
        PortalUserBadgeController.PortalUserBadge badge = PortalUserBadgeController.getCurrentUserBadge();
        Test.stopTest();

        System.assertNotEquals(null, badge.userName, 'Should always resolve the running user\'s Name');
        System.assertEquals(null, badge.accountName, 'Standard test running user has no linked Account');
    }

    @isTest
    static void testReturnsEmptyBadgeForGuestUserRunningContext() {
        User guestUser = TestDataFactory.getGuestUserOrNull();
        if (guestUser == null) {
            return; // Experience Cloud site not yet set up in this org - see TestDataFactory.
        }

        Test.startTest();
        PortalUserBadgeController.PortalUserBadge badge;
        System.runAs(guestUser) {
            badge = PortalUserBadgeController.getCurrentUserBadge();
        }
        Test.stopTest();

        System.assertEquals(null, badge.userName, 'Guest User running context should not resolve a Name');
        System.assertEquals(null, badge.accountName, 'Guest User running context should not resolve an Account');
    }

    @isTest
    static void testReturnsUserAndAccountNameForPortalUser() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'badgetest');

        Test.startTest();
        PortalUserBadgeController.PortalUserBadge badge;
        System.runAs(portalUser) {
            badge = PortalUserBadgeController.getCurrentUserBadge();
        }
        Test.stopTest();

        System.assertEquals('Portal Test User', badge.userName);
        System.assertEquals('Test Corporate Client', badge.accountName);
    }
}
