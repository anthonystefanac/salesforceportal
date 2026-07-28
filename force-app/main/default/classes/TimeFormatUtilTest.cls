@isTest
private class TimeFormatUtilTest {

    @isTest
    static void testFormatsHourAndMinutePaddedToTwoDigits() {
        System.assertEquals('07:05', TimeFormatUtil.format(Time.newInstance(7, 5, 0, 0)));
        System.assertEquals('23:59', TimeFormatUtil.format(Time.newInstance(23, 59, 0, 0)));
    }

    @isTest
    static void testReturnsEmptyStringForNull() {
        System.assertEquals('', TimeFormatUtil.format(null));
    }
}
