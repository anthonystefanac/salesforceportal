@isTest
private class StaffingRequestValidationServiceTest {

    @isTest
    static void testInsertWithEqualStartEndTimesIsBlocked() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');

        Staffing_Request__c request = new Staffing_Request__c(
            Facility__c = facility.Id,
            Requested_By_Contact__c = con.Id,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today().addDays(2),
            Start_Time__c = Time.newInstance(7, 0, 0, 0),
            End_Time__c = Time.newInstance(7, 0, 0, 0),
            Quantity__c = 1,
            Priority__c = 'Standard',
            Status__c = 'Submitted'
        );

        Boolean dmlExceptionThrown = false;
        Test.startTest();
        try {
            insert request;
        } catch (DmlException dmlError) {
            dmlExceptionThrown = true;
            System.assert(
                dmlError.getDmlMessage(0).contains('End Time cannot be the same as Start Time'),
                'Expected the validation message, got: ' + dmlError.getDmlMessage(0)
            );
        }
        Test.stopTest();

        System.assert(dmlExceptionThrown, 'Insert with equal Start/End Time should be blocked');
    }

    @isTest
    static void testInsertWithDifferentTimesSucceeds() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');

        Test.startTest();
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        Test.stopTest();

        System.assertNotEquals(null, request.Id, 'A request with different Start/End times should insert successfully');
    }

    @isTest
    static void testUpdateChangingToEqualTimesIsBlocked() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        request.End_Time__c = request.Start_Time__c;

        Boolean dmlExceptionThrown = false;
        Test.startTest();
        try {
            update request;
        } catch (DmlException dmlError) {
            dmlExceptionThrown = true;
        }
        Test.stopTest();

        System.assert(dmlExceptionThrown, 'Updating an existing request to have equal Start/End Time should be blocked');
    }

    @isTest
    static void testLeavingPreExistingEqualTimesUnchangedIsAllowed() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        // Simulate legacy data that already had equal Start/End times before
        // this validation existed, by bypassing the check for this one
        // setup write only - real pre-existing data doesn't go through this
        // trigger again just because the validation was deployed.
        StaffingRequestValidationService.bypassForTests = true;
        request.Start_Time__c = Time.newInstance(7, 0, 0, 0);
        request.End_Time__c = Time.newInstance(7, 0, 0, 0);
        update request;
        StaffingRequestValidationService.bypassForTests = false;

        Test.startTest();
        request.Notes__c = 'Updated for an unrelated reason';
        update request; // must not throw, even though times are still equal and still unchanged
        Test.stopTest();

        Staffing_Request__c afterUpdate = [SELECT Notes__c FROM Staffing_Request__c WHERE Id = :request.Id];
        System.assertEquals(
            'Updated for an unrelated reason',
            afterUpdate.Notes__c,
            'An unrelated field edit to a pre-existing invalid record must not be blocked'
        );
    }

    @isTest
    static void testInsertWithPastShiftDateIsBlocked() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');

        Staffing_Request__c request = new Staffing_Request__c(
            Facility__c = facility.Id,
            Requested_By_Contact__c = con.Id,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today().addDays(-1),
            Start_Time__c = Time.newInstance(7, 0, 0, 0),
            End_Time__c = Time.newInstance(15, 0, 0, 0),
            Quantity__c = 1,
            Priority__c = 'Standard',
            Status__c = 'Submitted'
        );

        Boolean dmlExceptionThrown = false;
        Test.startTest();
        try {
            insert request;
        } catch (DmlException dmlError) {
            dmlExceptionThrown = true;
            System.assert(
                dmlError.getDmlMessage(0).contains('Shift Date cannot be in the past'),
                'Expected the validation message, got: ' + dmlError.getDmlMessage(0)
            );
        }
        Test.stopTest();

        System.assert(dmlExceptionThrown, 'Insert with a past Shift Date should be blocked');
    }

    @isTest
    static void testInsertWithTodayAsShiftDateSucceeds() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');

        Staffing_Request__c request = new Staffing_Request__c(
            Facility__c = facility.Id,
            Requested_By_Contact__c = con.Id,
            Role__c = 'Registered Nurse',
            Shift_Date__c = Date.today(),
            Start_Time__c = Time.newInstance(7, 0, 0, 0),
            End_Time__c = Time.newInstance(15, 0, 0, 0),
            Quantity__c = 1,
            Priority__c = 'Standard',
            Status__c = 'Submitted'
        );

        Test.startTest();
        insert request;
        Test.stopTest();

        System.assertNotEquals(null, request.Id, 'Today should count as a valid, non-past Shift Date');
    }

    @isTest
    static void testUpdateChangingShiftDateToThePastIsBlocked() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);
        request.Shift_Date__c = Date.today().addDays(-1);

        Boolean dmlExceptionThrown = false;
        Test.startTest();
        try {
            update request;
        } catch (DmlException dmlError) {
            dmlExceptionThrown = true;
        }
        Test.stopTest();

        System.assert(dmlExceptionThrown, 'Changing an existing request\'s Shift Date to the past should be blocked');
    }

    @isTest
    static void testUnrelatedUpdateToAlreadyPastDatedRequestIsAllowed() {
        Account acct = TestDataFactory.createAccount('Test Aged Care Group');
        Contact con = TestDataFactory.createContact(acct.Id, 'Portal', 'Tester');
        Facility__c facility = TestDataFactory.createFacility(acct.Id, 'Test Facility');
        Staffing_Request__c request = TestDataFactory.createStaffingRequest(facility.Id, con.Id);

        // Simulate the calendar having advanced past this request's Shift
        // Date, exactly as StaffingRequestMaintenanceService's daily overdue
        // job encounters in production - never someone editing the date
        // backward, which is what this validation actually guards against.
        StaffingRequestValidationService.bypassForTests = true;
        request.Shift_Date__c = Date.today().addDays(-3);
        update request;
        StaffingRequestValidationService.bypassForTests = false;

        Test.startTest();
        request.Status__c = 'Unable to Fill'; // exactly what the overdue job sets
        update request; // must not throw, even though Shift Date is still in the past
        Test.stopTest();

        Staffing_Request__c afterUpdate = [SELECT Status__c FROM Staffing_Request__c WHERE Id = :request.Id];
        System.assertEquals(
            'Unable to Fill',
            afterUpdate.Status__c,
            'Updating an already past-dated request for an unrelated reason must not be blocked'
        );
    }
}
