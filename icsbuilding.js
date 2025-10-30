var req = await fetch("https://vt.navigate.eab.com/api/v1/reg/dashboard/courses/");
var res = await req.json();
var courses = {};
// iterate the meeting times
Object.values(res.section_time).forEach(sectionTime => {
    // first create the course object
    let crn = sectionTime.section;
    if (courses[crn] == null) {
        // info shown in the calendar
        courses[crn] = {
            name: res.section[crn].title,
            code: res.course[res.section[crn].course].cd,
            instructor: res.section[crn].instructor_name,
            start: res.section[crn].class_start_dt,
            end: res.section[crn].class_end_dt,
            days: {}
        };
    }
    // now gathering the meeting times for the course
    let day = sectionTime.day_of_week;
    if (courses[crn].days[day] == null)
        // holding an array in case some class meets multiple times a day
        courses[crn].days[day] = [];
    courses[crn].days[day].push({
        start: sectionTime.from_tm,
        end: sectionTime.to_tm,
        location: res.location[sectionTime.location].name // building abbreviation
    });
});

// adapted from https://jsfiddle.net/felipekm/MYpQ9/
function pad2(n) { // always returns a string
    return (n < 10 ? '0' : '') + n;
}
function YYYYMMDDTHHMMSS(date) {
    return date.getFullYear() +
        pad2(date.getMonth() + 1) +
        pad2(date.getDate()) +
        "T" +
        pad2(date.getHours()) +
        pad2(date.getMinutes()) +
        pad2(date.getSeconds());
}
function YYYYMMDDTHHMMSSZ(date) {
    return date.getUTCFullYear() +
        pad2(date.getUTCMonth() + 1) +
        pad2(date.getUTCDate()) +
        "T" +
        pad2(date.getUTCHours()) +
        pad2(date.getUTCMinutes()) +
        pad2(date.getUTCSeconds()) +
        "Z";
}

// adapted from https://stackoverflow.com/a/37069277
function numMeetings(startDate, endDate, meetingDays) {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        if (meetingDays.includes("" + (dayOfWeek + 1))) // navigate seems to be 1-indexing 
            count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}

let dayAbbrvs = {
    1: "SU", 2: "MO", 3: "TU", 4: "WE", 5: "TH", 6: "FR", 7: "SA"
}
function meetingDaysToString(meetingDays) {
    let ret = "";
    meetingDays.forEach(day => {
        ret += dayAbbrvs[day] + ",";
    })
    if (ret != "")
        ret = ret.substring(0, ret.length - 1);
    return ret;
}

// we need this because the local date returned by
// navigate will be behind by 1 if we just feed it into UTC.
// TODO: probably generalize this to work with any tz
// and make it better than a string manipulation hack
function estDate(dateString) {
    let components = dateString.split('-');
    let year = parseInt(components[0]);
    let month = parseInt(components[1]);
    let day = parseInt(components[2]);
    return new Date(Date.UTC(year, month - 1, day) + 5 * 60 * 60 * 1000); // daylight savings might mess with this but we really just need the day to be right
}

function buildICS(courses) {
    let ics = `BEGIN:VCALENDAR
PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN
VERSION:2.0
METHOD:PUBLISH
X-MS-OLK-FORCEINSPECTOROPEN:TRUE
BEGIN:VTIMEZONE
TZID:Eastern Standard Time
BEGIN:STANDARD
DTSTART:16011104T020000
RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010311T020000
RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
END:VTIMEZONE
`;
    Object.values(courses).forEach(course => {
        // TODO: rewrite this because i forgot about multiple classes in a day.
        // loop through all meeting times for the course, group by alike start/ending times
        // then create a VEVENT for all of those groups.
        // this current impl is wrong
        let now = new Date();
        let start = estDate(course.start);
        let end = estDate(course.end);
        let meetingDays = Object.keys(course.days);
        ics += `BEGIN:VEVENT
CLASS:PUBLIC
CREATED:${YYYYMMDDTHHMMSSZ(now)}
DTEND;TZID="Eastern Standard Time":${YYYYMMDDTHHMMSS(now)}
DTSTAMP:${YYYYMMDDTHHMMSSZ(now)}
DTSTART;TZID="Eastern Standard Time":${YYYYMMDDTHHMMSS(now)}
LAST-MODIFIED:${YYYYMMDDTHHMMSSZ(now)}
LOCATION:${course.location}
PRIORITY:5
RRULE:FREQ=WEEKLY;COUNT=${numMeetings(start, end, meetingDays)};BYDAY=${meetingDaysToString(meetingDays)}
SEQUENCE:0
SUMMARY;LANGUAGE=en-us:${course.code}
TRANSP:OPAQUE
UID:${crypto.randomUUID()}
X-ALT-DESC;FMTTYPE=text/html:${course.name + " with " + course.instructor}
X-MICROSOFT-CDO-BUSYSTATUS:BUSY
X-MICROSOFT-CDO-IMPORTANCE:1
X-MICROSOFT-DISALLOW-COUNTER:FALSE
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
`;
    });
    

    return ics + "END:VCALENDAR";
}

console.log(courses);
console.log(buildICS(courses));