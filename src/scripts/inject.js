(async () => {try{
const hostname = "vt.navigate.eab.com";
if (location.hostname != hostname) return window.open("https://" + hostname);

let req = await fetch(`https:/${hostname}/api/v1/reg/dashboard/courses/`);
if (!req.ok)
    return alert("Failed to fetch schedule. Are you logged in?");
let res = await req.json();
let courses = {};
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
            days: {} // 1-7: [{start:x, end:x, location:x}, ...]
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

// from https://stackoverflow.com/a/2117523
function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}
// from https://stackoverflow.com/a/8831937
function hashCode(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

// from https://stackoverflow.com/a/18197341
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

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
    1: "SU",
    2: "MO",
    3: "TU",
    4: "WE",
    5: "TH",
    6: "FR",
    7: "SA"
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
function estDate(dateString) {
    const tempdate = Temporal.PlainDate.from(dateString).toZonedDateTime({
        timeZone: 'America/New_York',
        plainTime: '00:00'
    });
    return new Date(tempdate.epochMilliseconds);
}

// adapted from https://stackoverflow.com/a/9640384
function toSeconds(hms) {
    let a = hms.split(':'); // split it at the colons
    // minutes are worth 60 seconds. Hours are worth 60 minutes.
    let seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
    return seconds;
}

function addSeconds(date, secondsString) {
    // not worrying about overflow hopefully
    const seconds = Number(secondsString);
    if (!Number.isFinite(seconds)) return null;
    return new Date(date.getTime() + seconds * 1000);
}

function meetingHash(meeting) {
    if (meeting == null) return null;
    const data = ("" + toSeconds(meeting.start) + "$$" + toSeconds(meeting.end) + "$$" + meeting.location).replaceAll(" ", "");
    const hash = hashCode(data);
    return hash;
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
        // loop through all meeting times for the course, group by alike start/ending times and locations
        // then create a VEVENT for all of those groups.
        // this current impl is wrong
        let similarMeetings = {};
        for (const [day, meetings] of Object.entries(course.days)) {
            meetings.forEach(meeting => {
                let meetingHashString = meetingHash(meeting);
                if (similarMeetings[meetingHashString] == null) {
                    similarMeetings[meetingHashString] = {
                        days: [day],
                        info: meeting
                    }
                } else
                    similarMeetings[meetingHashString].days.push(day);
            })
        }

        Object.values(similarMeetings).forEach(meeting => {
            let now = new Date();
            let semesterStart = estDate(course.start);
            let semesterEnd = estDate(course.end);
            let meetingDays = meeting.days;
            let startTime = addSeconds(semesterStart, toSeconds(meeting.info.start));
            let endTime = addSeconds(semesterStart, toSeconds(meeting.info.end));
            ics += `BEGIN:VEVENT
CLASS:PUBLIC
CREATED:${YYYYMMDDTHHMMSSZ(now)}
DTEND;TZID="Eastern Standard Time":${YYYYMMDDTHHMMSS(endTime)}
DTSTAMP:${YYYYMMDDTHHMMSSZ(now)}
DTSTART;TZID="Eastern Standard Time":${YYYYMMDDTHHMMSS(startTime)}
LAST-MODIFIED:${YYYYMMDDTHHMMSSZ(now)}
LOCATION:${meeting.info.location}
PRIORITY:5
RRULE:FREQ=WEEKLY;COUNT=${numMeetings(semesterStart, semesterEnd, meetingDays)};BYDAY=${meetingDaysToString(meetingDays)}
SEQUENCE:0
SUMMARY;LANGUAGE=en-us:${course.code}
TRANSP:OPAQUE
UID:${uuidv4()}
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

    });


    return ics + "END:VCALENDAR";
}

//console.log(courses);
//console.log(buildICS(courses));
download("schedule.ics", buildICS(courses));

}catch(e){alert("An error ocurred:\n\n"+e)}})();