# Cross-check: latest MS Forms form vs the Power Pages solution

**Source:** *Sign Up - Apprentice or Trainee - Provide Your Details* (MS Forms, 62 questions,
printed 21 Oct 2026). Compared with the current web form, the Dataverse table and
`dataverse-table-schema.csv`.

**Summary:**
- **Additions:** 3 new questions, plus 3 "please specify" follow-ups.
- **Changes:** 5 choice lists, 1 wrong question, 5 required/optional differences, 3 date
  rules, and help text.
- **Deletions:** no whole fields; some choice options only.
- **Already the same:** 41 of the 62 questions.

## A. Additions

| # | MS Forms question | Proposed column | Type | Rule |
|---|---|---|---|---|
| 2 | Quiz - Support Indicator ID | `bnsw_quizid` | Text (50) | Required |
| 3 | Quiz - Literacy (Reading) result | `bnsw_quizliteracy` | Whole number | Required, 0–5 |
| 4 | Quiz - Numeracy (Maths) result | `bnsw_quiznumeracy` | Whole number | Required, 0–5 |
| 24 | Citizenship "Other": *state the country you're a legal resident of* | `bnsw_citizenshipcountry` | Text (100) | Required when Citizenship = Other |
| 26 | Country of birth: **Australia / Other** + *which country* | `bnsw_bornaustralia` (Choice: Australia / Other) + existing `bnsw_countryofbirth` for the country | Choice + text | Country required when Other |
| 27 | Language at home "Other": *specify the language* | `bnsw_languageother` | Text (100) | Required when Other |

The three quiz questions get a new first section, **Government requirements**. It holds the
form's instructions and the link to the Support Indicator quiz:
<https://www.apprenticeships.gov.au/apprentices/how-to-find-and-prepare-for-an-apprenticeship/check-your-literacy-and-numeracy-skills/Support%20indicator>

## B. Choice lists to change

| Question | MS Forms options | Current solution | Change |
|---|---|---|---|
| 23 Gender | Female, Male, Prefer not to say | Male, Female, Non-binary, Prefer not to say, Other | Show only the 3 form options. Keep the values: Male=1, Female=2, Prefer not to say=4. |
| 24 Citizenship | Australian Citizenship or Permanent Resident · NZ citizen in Australia > 6mths · Other | Australian Citizen · New Zealand Citizen · Permanent Resident · Other (visa required) | Relabel 1 → *Australian Citizen or Permanent Resident*, 2 → *NZ citizen in Australia > 6 months*. Remove 3 (Permanent Resident). Keep 4 = *Other* (visa + country required). |
| 28 Aboriginal / TSI | No, Aboriginal, Torres Strait Islander, Both | …the same plus *Prefer not to say* | Remove *Prefer not to say* (5). |
| 31 School level (still at school) | Yr 8 or below, Yr 9, Yr 10, Yr 11, Yr 12 | Yr 7 – Yr 12 | Relabel 8 → *Yr 8 or below*. Remove Yr 7 (7). |
| 32 Highest schooling | Did not go to School, Yr 8 or below, Yr 9 or equivalent, Yr 10 or equivalent, Yr 11 or equivalent, Yr 12 or equivalent | Year 10 or below, Year 11, Year 12, Certificate I/II, Certificate III/IV, Other | **Replace the list.** Proposed values follow the national VET (AVETMISS) codes: Did not go to school = 2, Yr 8 or below = 8, Yr 9 = 9, Yr 10 = 10, Yr 11 = 11, Yr 12 = 12. |

Only test data exists, so changing values now is safe. After go-live it would need a
data fix.

## C. Question wording that's wrong

| # | MS Forms | Current solution | Change |
|---|---|---|---|
| 39 | *Have you commenced the Qualification listed above before as Apprentice/Trainee?* (No / Yes - I've started this Qualification before) | *Did your Apprenticeship/Traineeship commence before today?* | **Different meaning.** Change the label and hint to match the form. The column stays the same. |
| 5 | *Do you KNOW your USI?* | *Do you have a USI?* | Relabel. Add the "create or check your USI at <https://www.usi.gov.au/>" help text and link. |
| 7 | USI permission: **Yes - I give Permission / No** | A tick box that must be ticked | Decision needed: allow "No" (as the form does), or keep it compulsory. |

## D. Required / optional differences

| # | Question | MS Forms | Current | Change |
|---|---|---|---|---|
| 35 | Employer | optional | required | → optional |
| 36 | Apprenticeship start date | optional (*"if you know it"*) | required | → optional |
| 37 | Job title | optional | required | → optional |
| 45 | Workplace name | optional | required | → optional |
| 44 | Hours per week (part time / casual) | required when shown | optional | → required when shown |

## E. Date rules

| # | Question | MS Forms | Current | Change |
|---|---|---|---|---|
| 42 | Previously worked – Ended | *"If still employed, the day BEFORE your apprenticeship start date"* | Can't be in the future | **Remove the "not in the future" rule.** The day before a future start date is a future date, so this currently blocks valid answers. Add the form's hint. |
| 49, 50 | Completed study – Started / Finished | **Month and year** (MM/YY) | Full date picker | Change to a **month picker**, stored as the 1st of the month. |
| 53 | Currently studying – Start date | dd/mm/yy | Date picker | No change |
| 33 | Month completed school | 2-digit number | Month drop-down (same values 1–12) | No change; the drop-down is easier |
| 16, 59 | Home / guardian state | Free text (*"EG NSW"*) | Drop-down | No change; it stops typos |

## F. Help text to bring across

- **Your details:** *"These details will be recorded on your Training Contract, so they must
  match your identification (your legal details). If they're pre-filled they were provided
  by your employer; change them to match your ID."*
- **Apprenticeship details:** *"If these details have been provided, do not change or delete
  them. If not, complete them as best you can."* (See decision 4.)
- **Postal address:** *"e.g. PO Box 45"*. **Home street:** *"e.g. 21 Test Ave or 346/12 The Heights"*.
- **Prior work started / ended:** *"When did you start/finish with the business?"*
- **Workplace:** *"The workplace can differ from the business's head office, e.g. a depot or
  workshop."*
- **Under 18:** *"A parent or guardian will need to co-sign your Training Contract."*
- **Completed qualification:** *"Not your school qualification, e.g. Cert II in Business
  (TAFE NSW) or Diploma of Nursing."*
- **Visa:** *"Current visa number, subclass and expiry date."*

## G. No change needed
Questions 1, 6, 8–15, 17–22, 25, 29, 30, 34, 38, 40, 41, 43, 46–48, 51, 52, 54–58, 60–62
already match in field, type and rule. Some labels differ slightly, but the meaning is the same.

## Decisions needed
1. **USI permission (Q7):** allow "No", as the MS Form does, or keep it compulsory?
2. **No USI (Q5 = No):**
   - Option 1 (closest to the form's intent: *"create a USI and then return and add your
     new USI"*): show the usi.gov.au link and still require the USI before submitting.
   - Option 2 (current): let them submit without one.
3. **Gender:** match the form's 3 options? National VET reporting also has an *X / other*
   category, if the business wants it.
4. **Pre-filled apprenticeship details (Q35–38):** the form says *"do not change or delete"*.
   Lock them (read-only) when staff pre-filled them, or leave them editable with that
   instruction?
