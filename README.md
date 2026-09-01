## MedleaPlus: 1Med / MedLea Redesign Extension

Hi! I'm Kay, Y4 medic at Manchester University. MedLea works, but it looks like it was built in 2006 and the useful bits end up buried in grey tables. So I've made a Google Chrome extension that completely reskins the 1Med suite — timetable, submissions, attendance, profile — into a dark console, and does the small sums your own results pages otherwise leave you to do by hand.

## Installation

1. Download this extension as a folder by clicking https://github.com/kay-liechtenstein/MedleaPlus/archive/refs/heads/main.zip.
2. Unzip it and place the folder somewhere permanent (*e.g*. your desktop). Do not move, rename or delete it afterwards — Chrome loads it from that exact location and it will silently switch itself off if the folder disappears.
3. Open Google Chrome, locate the extension icon (puzzle piece-like icon, usually in the top right).
4. Go to "Manage Extensions".
5. Turn on "Developer mode" (toggle on the top right). This is what makes the next button appear.
6. Click on "Load Unpacked" on the top left.
7. Select this entire folder.
8. Go to MedLea and refresh the page.

## General Instruction

There is nothing to click and nothing to set up. Log into MedLea as normal and every page is already redesigned.

**Timetable.** Event cards keep the site's own colour coding, expand when you hover over a clipped one, and the header carries a live UK clock (it follows GMT/BST, not your laptop's clock). The day starts at 6am rather than 8am, so early ward rounds are not jammed against the top edge — and if anything is ever timetabled earlier than that, the grid stretches to fit it instead of hiding it.

**Progress test feedback.** Every score becomes a chip coloured against the cohort mean, so you can see at a glance where you sat relative to the year. More usefully, a progress test is two papers on two different days — questions 1–125 are day 1, anything after that is day 2 — but the site only ever reports one combined mark. The extension counts them separately and shows you Day 1, Day 2 and Overall, so you can actually tell which paper went badly.

**CCA / OSCE feedback.** Each station becomes a card, and the cohort bar chart already printed next to each judgement is restated in words: the same chart, just read out as "you were above X% of the year", per station and averaged across the exam. For summative sittings, the outcome grid is redrawn with your own cell marked and the distance to the next band spelled out ("Honours starts at 14 passed — 2 more stations").

**1Med Learn.** The Learn site is covered too, top to bottom: the year's component grid, each block, each case, and the case pages themselves — including your learning notes, My Learn and search. Its header is replaced with the same bar the timetable has, so the burger menu, the clock and your name are in the same place on every 1Med site; the Learn site's own section links (Learning, My Learn, My Notes, and the rest) move to a slim strip just underneath, so nothing is lost.

**Everywhere else.** Submissions, the task inbox, attendance, people and groups, and the 1Med home portal all get the same treatment.

## Caveat

This works only on Google Chrome, meaning that you cannot use this on Safari, Firefox, or any other browser. This is due to their security restrictions. Furthermore, iOS and Android do not allow for any extension loading, so this is a laptop-only affair.

The extension only changes how pages look on your own screen. The one thing Chrome will ask you to allow is access to the 1Med sites themselves, which is unavoidable for something that restyles them; there is no account, no sign-up and no server of mine involved. Nothing is ever sent anywhere — your marks and your timetable never leave your browser.

It keeps exactly one thing between page loads, in Chrome's own extension storage on your machine: the name the timetable header prints for you. Only the timetable shows your title ("Mr", "Ms", "Dr"); the Learn site and your profile print your name without it, so the header would otherwise read one word short of the bar it is copying. Remembering it is the only way to make them match, it is never used unless it clearly names the same person the page is already naming, and it goes when you remove the extension.

Equally, it cannot change anything on MedLea itself: it is a coat of paint, so if a page is broken underneath, it will still be broken.

To be clear about what this is not: it does not unlock, reveal or retrieve anything. Everything it shows is worked out from the page already open in front of you — your own results, your own timetable — and it never reaches any part of MedLea you could not simply click to yourself. The day split is a count of the question rows the page is already showing you; the cohort figures are the values behind the bar chart the page is already drawing. It just does the arithmetic and writes the answer down.

The sums are done locally, and the extension cross-checks its own arithmetic against the mark MedLea printed — but it is a study aid I wrote for myself, not an official source. Treat the numbers accordingly.

MedLea occasionally changes its own markup, which can make bits of the skin look wrong until I catch up. If a page looks broken, disabling the extension in "Manage Extensions" restores the original site instantly.

If you have any question, could you please re-read the instructions.

## Update Information

Last updated: 1st Sep 2026.
