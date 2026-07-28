/**
 * Shared HH:MM formatting for Apex Time values, used anywhere a notification
 * or confirmation email needs to print a shift's Start/End Time. Apex's Time
 * class has no .format() method (unlike Date/Datetime), so this builds a
 * simple string from its hour()/minute() accessors.
 */
public inherited sharing class TimeFormatUtil {
    public static String format(Time value) {
        if (value == null) {
            return '';
        }
        return String.valueOf(value.hour()).leftPad(2, '0') + ':' + String.valueOf(value.minute()).leftPad(2, '0');
    }
}
