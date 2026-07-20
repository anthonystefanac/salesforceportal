@isTest
private class FacilityControllerTest {

    @isTest
    static void testReturnsEmptyListForNonPortalRunningUser() {
        Test.startTest();
        List<Facility__c> facilities = FacilityController.getFacilitiesForCurrentUser();
        Test.stopTest();

        System.assertEquals(0, facilities.size(), 'Standard test running user has no linked Account');
    }

    @isTest
    static void testReturnsOnlyActiveFacilitiesForPortalUser() {
        Account acct = TestDataFactory.createAccount('Test Corporate Client');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        TestDataFactory.createFacility(acct.Id, 'Active Facility');
        Facility__c inactive = TestDataFactory.createFacility(acct.Id, 'Inactive Facility');
        inactive.Active__c = false;
        update inactive;

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'facilitytest');

        Test.startTest();
        List<Facility__c> facilities;
        System.runAs(portalUser) {
            facilities = FacilityController.getFacilitiesForCurrentUser();
        }
        Test.stopTest();

        System.assertEquals(1, facilities.size(), 'Only the active facility should be returned');
        System.assertEquals('Active Facility', facilities[0].Name);
    }
}
