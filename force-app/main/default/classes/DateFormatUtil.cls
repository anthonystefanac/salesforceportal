/**
 * Explicit DD/MM/YYYY date formatting for notification/confirmation email
 * bodies, used instead of Apex's locale-dependent Date.format(). Date.format()
 * follows the Locale of whichever user's context is running the Apex at that
 * moment - the submitting portal user, an internal user editing the record
 * by hand, or whichever user the scheduled overdue job runs as - not
 * necessarily an Australian one, so it isn't a reliable way to guarantee
 * DD/MM/YYYY in these emails regardless of who/what triggered them.
 */
public inherited sharing class DateFormatUtil {
    public static String format(Date value) {
        if (value == null) {
            return '';
        }
        return String.valueOf(value.day()).leftPad(2, '0') + '/'
            + String.valueOf(value.month()).leftPad(2, '0') + '/'
            + String.valueOf(value.year());
    }
}
