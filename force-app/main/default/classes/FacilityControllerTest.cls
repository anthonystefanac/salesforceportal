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

    @isTest
    static void testGetWardsForFacilityReturnsEmptyListWhenFacilityIdIsNull() {
        Test.startTest();
        List<Ward__c> wards = FacilityController.getWardsForFacility(null);
        Test.stopTest();

        System.assertEquals(0, wards.size());
    }

    @isTest
    static void testGetWardsForFacilityReturnsOnlyWardsForTheGivenFacility() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facilityA = TestDataFactory.createFacility(acct.Id, 'Riverside Aged Care');
        Facility__c facilityB = TestDataFactory.createFacility(acct.Id, 'Meridian Corporate Health');
        TestDataFactory.createWard(facilityA.Id, 'Ward A');
        TestDataFactory.createWard(facilityA.Id, 'Ward B');
        TestDataFactory.createWard(facilityB.Id, 'Ward C');

        Id portalProfileId = TestDataFactory.getPortalProfileIdOrNull();
        if (portalProfileId == null) {
            return; // Experience Cloud site/license not yet enabled in this org - see TestDataFactory.
        }
        User portalUser = TestDataFactory.createPortalUser(portalProfileId, con.Id, 'wardtest');

        Test.startTest();
        List<Ward__c> wards;
        System.runAs(portalUser) {
            wards = FacilityController.getWardsForFacility(facilityA.Id);
        }
        Test.stopTest();

        System.assertEquals(2, wards.size(), 'Only wards under the requested facility should be returned');
    }
}
