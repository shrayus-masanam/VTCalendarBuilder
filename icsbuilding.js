var req = await fetch("https://vt.navigate.eab.com/api/v1/reg/dashboard/courses/");
var res = await req.json();
var courses = {};
Object.values(res.section_time).forEach(sectionTime => {
    let crn = sectionTime.section;
    if (courses[crn] == null) {
        courses[crn] = {
            name: res.section[crn].title,
            code: res.course[res.section[crn].course].cd,
            instructor: res.section[crn].instructor_name,
            start: res.section[crn].class_start_dt,
            end: res.section[crn].class_end_dt,
            days: {}
        };
    }
    let day = sectionTime.day_of_week;
    if (courses[crn].days[day] == null)
        courses[crn].days[day] = [];
    courses[crn].days[day].push({
        start: sectionTime.from_tm,
        end: sectionTime.to_tm,
        location: res.location[sectionTime.location].name
    });
});
console.log(courses); 