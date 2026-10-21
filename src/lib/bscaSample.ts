import { emptyData, entities, type Data } from "./model";
import { checkData } from "./storage";

export const BSCA_CURRICULUM_ID = "bsca-prospectus-2018-curriculum";
export const BSCA_SOURCE =
  "BSCA prospectus · BOR Resolution No. 129, Series of 2018";
export type BscaCourse = {
  code: string;
  title: string;
  units: number;
  lectureHours: number;
  labHours: number;
  yearLevel: number;
  semester: number;
  page: number;
  prerequisites: string;
  corequisites: string;
  track?: string;
  unitNotation?: string;
};
type CourseRow = [
  code: string,
  title: string,
  units: number,
  lecture: number,
  lab: number,
  prerequisites?: string,
];
function semester(
  yearLevel: number,
  term: number,
  page: number,
  rows: CourseRow[],
): BscaCourse[] {
  return rows.map(
    ([code, title, units, lectureHours, labHours, prerequisites = "None"]) => ({
      code,
      title,
      units,
      lectureHours,
      labHours,
      yearLevel,
      semester: term,
      page,
      prerequisites,
      corequisites: code.startsWith("Elective")
        ? "As the course requires"
        : "None",
      ...(code.startsWith("NST") ? { unitNotation: "(3)" } : {}),
    }),
  );
}
// Transcribed from the course rows, not reconstructed from inconsistent printed totals.
export const bscaCourses: BscaCourse[] = [
  ...semester(1, 1, 1, [
    ["GEC101", "Understanding The Self", 3, 3, 0],
    ["GEC104", "Mathematics in the Modern World", 3, 3, 0],
    ["MAT051", "Calculus 1", 5, 5, 0],
    ["BCA111", "Fundamentals of Computer Applications 1", 3, 2, 3],
    ["CCC100", "Fundamentals of Computing", 3, 2, 3],
    ["CCC101", "Computer Programming 1", 3, 2, 3],
    ["PED001", "Exercise Prescription and Management", 2, 2, 0],
    ["NST001", "National Service Training Program 1", 3, 3, 0],
  ]),
  ...semester(1, 2, 1, [
    ["GEC102", "Purposive Communication", 3, 3, 0],
    ["MAT061", "Calculus 2", 5, 5, 0, "MAT051"],
    ["BCA121", "Fundamentals of Computer Applications 2", 3, 2, 3],
    ["BCA122", "Digital Techniques Fundamentals", 3, 2, 3],
    ["BCA123", "Basic Computer Instrumentation and Measurement", 3, 2, 3],
    ["CCC102", "Computer Programming 2", 3, 2, 3, "CCC101"],
    ["PED002", "Dance/Martial Arts", 2, 2, 0, "PED001"],
    ["NST002", "National Service Training Program 2", 3, 3, 0, "NST001"],
  ]),
  ...semester(2, 1, 2, [
    ["FIL101", "Wika at Kultura sa Mapayapang Lipunan", 3, 3, 0],
    ["MAT071", "Calculus 3", 5, 5, 0, "MAT061"],
    ["BCA131", "Advanced Computer Circuits", 3, 2, 3, "BCA121"],
    ["BCA132", "Advanced Digital Techniques", 3, 2, 3, "BCA122"],
    ["BCA133", "Data Communication", 3, 2, 3, "BCA122"],
    ["CCC121", "Computer Structures and Algorithms", 3, 2, 3, "CCC102"],
    [
      "PED003",
      "Individual/Dual Sports/Traditional/Recreational Games",
      2,
      2,
      0,
      "PED001",
    ],
  ]),
  ...semester(2, 2, 2, [
    ["FPE101", "Fundamentals of Peace Education", 3, 3, 0],
    ["BCA141", "Computer Organization and Architecture", 4, 3, 3, "BCA122"],
    ["MAT103", "Discrete Mathematics", 3, 3, 0],
    ["BCA143", "Firmware Programming", 3, 2, 3, "CCC101"],
    ["BCA144", "Introduction to Internet of Things", 3, 2, 3, "CCC102"],
    ["CCC151", "Information Management", 3, 2, 3],
    ["PED004", "Team Sports", 2, 2, 0, "PED001"],
  ]),
  ...semester(3, 1, 3, [
    ["FIL102", "Ekokritisismo at Pagpapahalaga sa Kalikasan", 3, 3, 0],
    ["GEC106", "Art Appreciation", 3, 3, 0],
    ["Elective 1", "(Technical Elective 1)", 3, 2, 3, "As the course requires"],
    ["BCA151", "Introduction to Operating Systems", 3, 2, 3, "BCA141"],
    ["BCA152", "Microcontrollers", 3, 2, 3, "CCC102"],
    ["BCA153", "Computer Applications in Industry", 3, 2, 3, "BCA122"],
    ["CCC181", "Application Development and Emerging Technologies", 3, 3, 0],
  ]),
  ...semester(3, 2, 3, [
    ["GEC103", "The Contemporary World", 3, 3, 0],
    ["GEC107", "Ethics", 3, 3, 0],
    ["GEC109", "Life and Works of Rizal", 3, 3, 0],
    [
      "BCA161",
      "Numerical Methods for Computer Applications",
      3,
      3,
      0,
      "MAT071",
    ],
    [
      "HIS003",
      "History of Filipino Muslims and Indigenous People of MINSUPALA",
      3,
      3,
      0,
    ],
    ["Elective 2", "(Technical Elective 2)", 3, 2, 3, "As the course requires"],
    ["BCA198", "Research Methods", 3, 3, 0, "CCC181"],
  ]),
  ...semester(4, 1, 4, [
    ["GEC108", "Science, Technology and Society", 3, 3, 0],
    ["GEC105", "Readings in Philippine History", 3, 3, 0],
    ["BCA172", "Technopreneurship", 3, 3, 0],
    ["Elective 3", "(Technical Elective 3)", 3, 2, 3, "As the course requires"],
    ["Elective 4", "(Technical Elective 4)", 3, 2, 3, "As the course requires"],
    ["BCA199", "Undergraduate Thesis", 3, 3, 0, "BCA198"],
  ]),
  ...semester(4, 2, 4, [["BCA197", "On-The-Job-Training", 6, 0, 40, "BCA198"]]),
];
export const bscaElectives: BscaCourse[] = [
  ...semester(0, 0, 5, [
    ["BCA180", "Introduction of Computer Vision", 3, 2, 3, "CCC102"],
    ["BCA181", "HDL Programming", 3, 2, 3, "CCC102"],
    ["BCA182", "Embedded Systems Programming", 3, 2, 3, "CCC102"],
    ["BCA183", "Digital Signal Processing", 3, 2, 3, "CCC102"],
  ]).map((c) => ({ ...c, track: "Embedded System Track" })),
  ...semester(0, 0, 5, [
    ["BCA188", "Programming For Internet of Things", 3, 2, 3, "CCC102"],
    ["BCA189", "Applied Internet of Things", 3, 2, 3, "BCA144"],
    [
      "BCA190",
      "Artificial Intelligence in Internet of Things",
      3,
      2,
      3,
      "BCA144",
    ],
    ["BCA191", "Fundamentals of Robotics Systems", 3, 2, 3, "BCA144"],
  ]).map((c) => ({ ...c, track: "Internet of Things (IoT) Track" })),
];
export const bscaSourceNotes = [
  "The source is the supplied BSCA prospectus (BOR Resolution No. 129, Series of 2018), not a claim about the current approved curriculum.",
  "Individual course rows are authoritative for this transcription. Printed semester totals and the grand total 147(153) are inconsistent with those rows. The 51 curriculum rows sum to 159 units including the two NST courses (153 excluding them). No totals were used to change course values.",
  "NST001 and NST002 show (3) units. They are stored numerically as 3; the original notation is retained in this preview. NST001 lists lecture 3, lab 0, but total 30; the sample uses the separate lecture/lab columns.",
  "BCA197 lists 6 units, lecture 0, lab 40 hours/week and a total of 700hrs. These are retained as source data, not interpreted as 40 credited teaching-load units or a campus laboratory booking. Leave internship, NST and thesis faculty assignments pending until the department confirms its loading policy.",
  "Elective 1–4 are curriculum slots requiring an actual elective choice. The eight suggested technical electives are catalog options only; they are not additional mandatory offerings. Replace a slot offering with your selected elective before assigning or scheduling it.",
  "Prerequisites, corequisites and track labels are reference information shown here; the scheduler does not enforce student enrollment prerequisites.",
  "The sample planning year, two planning semesters and four blocks of 30 students are illustrative. No faculty, rooms, teaching assignments or meetings are invented. Existing workload and scheduling rules are preserved.",
];
const subjectId = (code: string) =>
  `bsca-2018-subject-${code.toLowerCase().replaceAll(" ", "-")}`;
export function bscaSampleData(): Data {
  const data = emptyData();
  data.academicYears = [
    { id: "bsca-2018-sample-year", name: "BSCA sample planning year" },
  ];
  data.semesters = [1, 2].map((n) => ({
    id: `bsca-2018-semester-${n}`,
    name: `BSCA sample · ${n === 1 ? "First" : "Second"} semester`,
    academicYearId: data.academicYears[0].id,
    finalized: false,
  }));
  data.programs = [
    {
      id: "bsca-2018-program",
      code: "BSCA",
      name: "Bachelor of Science in Computer Applications",
    },
  ];
  data.curricula = [
    {
      id: BSCA_CURRICULUM_ID,
      name: BSCA_SOURCE,
      programId: data.programs[0].id,
    },
  ];
  data.subjects = [...bscaCourses, ...bscaElectives].map((c) => ({
    id: subjectId(c.code),
    code: c.code,
    name: c.title,
    curriculumId: BSCA_CURRICULUM_ID,
    courseUnits: c.units,
    lectureHours: c.lectureHours,
    labHours: c.labHours,
    equipment: "",
  }));
  data.sections = [1, 2, 3, 4].map((yearLevel) => ({
    id: `bsca-2018-section-${yearLevel}`,
    name: `BSCA ${yearLevel}A (sample)`,
    programId: data.programs[0].id,
    yearLevel,
    size: 30,
  }));
  data.offerings = bscaCourses.map((c) => ({
    id: `bsca-2018-offering-${c.code.toLowerCase().replaceAll(" ", "-")}`,
    subjectId: subjectId(c.code),
    sectionId: `bsca-2018-section-${c.yearLevel}`,
    semesterId: `bsca-2018-semester-${c.semester}`,
  }));
  return checkData(data);
}
export function addBscaSample(existing: Data): Data {
  if (existing.curricula.some((c) => c.id === BSCA_CURRICULUM_ID))
    throw new Error(
      "The BSCA prospectus sample has already been added. Existing records were not changed.",
    );
  const sample = bscaSampleData(),
    next = structuredClone(existing);
  const existingProgram = existing.programs.find(
    (p) => p.code.toUpperCase() === "BSCA",
  );
  if (existingProgram) {
    sample.curricula[0].programId = existingProgram.id;
    sample.sections.forEach((s) => (s.programId = existingProgram.id));
    sample.programs = [];
  }
  for (const s of sample.subjects) {
    const match = existing.subjects.find(
      (row) => row.code.toLowerCase() === s.code.toLowerCase(),
    );
    if (!match) continue;
    const curriculum = existing.curricula.find(
      (c) => c.id === match.curriculumId,
    );
    if (
      curriculum?.programId !== sample.curricula[0].programId ||
      match.name !== s.name ||
      match.courseUnits !== s.courseUnits ||
      match.lectureHours !== s.lectureHours ||
      match.labHours !== s.labHours ||
      match.equipment !== s.equipment
    )
      throw new Error(
        `${s.code} already exists with different curriculum data. No sample records were added. Use a separate browser profile to explore the sample without modifying your catalog.`,
      );
    sample.offerings.forEach((o) => {
      if (o.subjectId === s.id) o.subjectId = match.id;
    });
  }
  sample.subjects = sample.subjects.filter(
    (s) =>
      !existing.subjects.some(
        (row) => row.code.toLowerCase() === s.code.toLowerCase(),
      ),
  );
  for (const entity of entities.filter(
    (e) => !["workloadRules", "schedulingRules"].includes(e),
  )) {
    if (
      sample[entity].some((row) =>
        next[entity].some((current) => current.id === row.id),
      )
    )
      throw new Error(
        `A sample ID already exists in ${entity}. No records were added.`,
      );
    (next[entity] as unknown[]).push(...sample[entity]);
  }
  return checkData(next);
}
