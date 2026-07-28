@isTest
private class DateFormatUtilTest {

    @isTest
    static void testFormatsDayMonthYearPaddedToTwoDigits() {
        System.assertEquals('05/01/2026', DateFormatUtil.format(Date.newInstance(2026, 1, 5)));
        System.assertEquals('30/07/2026', DateFormatUtil.format(Date.newInstance(2026, 7, 30)));
    }

    @isTest
    static void testReturnsEmptyStringForNull() {
        System.assertEquals('', DateFormatUtil.format(null));
    }
}
