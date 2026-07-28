@isTest
private class WithoutSharingDmlTest {

    @isTest
    static void testInsertRecordInsertsTheGivenRecord() {
        Account acct = new Account(Name = 'Insert Test Account');

        Test.startTest();
        WithoutSharingDml.insertRecord(acct);
        Test.stopTest();

        System.assertNotEquals(null, acct.Id, 'insertRecord must insert the record and populate its Id');
    }

    @isTest
    static void testUpdateRecordUpdatesTheGivenRecord() {
        Account acct = new Account(Name = 'Update Test Account');
        insert acct;

        Test.startTest();
        WithoutSharingDml.updateRecord(new Account(Id = acct.Id, Name = 'Updated Name'));
        Test.stopTest();

        Account updated = [SELECT Name FROM Account WHERE Id = :acct.Id];
        System.assertEquals('Updated Name', updated.Name);
    }
}
