import { faker } from "@faker-js/faker";
import Institute from "@/models/Institute";
import userDirectory from "@/services/userDirectory";
import { generate } from "generate-passphrase";
import User from "@/models/User";
import Candidate from "@/models/Candidate";
import PlacementGroup from "@/models/PlacementGroup";
import Company from "@/models/Company";
import Drive from "@/models/Drive";
import sampleDepartments from "@/data/samples/institute/departments";
import { Types } from "mongoose";
import { PlacementGroup as IPlacementGroup } from "@shared-types/PlacementGroup";
import { Company as ICompany } from "@shared-types/Company";
import AppliedDrive from "@/models/AppliedDrive";

const CANDIDATES_LIMIT = 20;
const PLACEMENT_GROUPS_MIN = 3;
const PLACEMENT_GROUPS_MAX = 10;
const COMPANIES_MIN = 5;
const COMPANIES_MAX = 15;
const DRIVES_MIN = 7;
const DRIVES_MAX = 20;

const StepStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  FAILED: "failed",
};

// const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const generateSampleInstituteData = async (instituteId: string) => {
  const institute = await Institute.findById(instituteId);
  if (!institute) {
    throw new Error("Institute not found");
  }

  const generationId = crypto.randomUUID();
  await Institute.updateOne(
    { _id: instituteId },
    { $set: { "mockData.status": "generating", "mockData.generationId": generationId }, $unset: { "mockData.lastError": 1 } }
  );
  try {
    await generateSampleInstituteDepartments(instituteId);
    await generateSampleInstituteCandidates(instituteId);
    await generateSamplePlacementGroups(instituteId, institute.createdBy?.toString());
    await generateSampleCompanies(instituteId);
    await generateSampleDrives(instituteId);
    await generateSampleAppliedDrives(instituteId);

    const refreshed = await Institute.findById(instituteId).lean();
    const driveIds = refreshed?.drives || [];
    const counts = {
      departments: refreshed?.departments?.filter((item: any) => item.isSample).length || 0,
      students: await Candidate.countDocuments({ institute: instituteId, isSample: true }),
      faculty: 0,
      companies: await Company.countDocuments({ _id: { $in: refreshed?.companies || [] }, isSample: true }),
      placementGroups: await PlacementGroup.countDocuments({ institute: instituteId, isSample: true }),
      drives: await Drive.countDocuments({ _id: { $in: driveIds }, isSample: true }),
      applications: await AppliedDrive.countDocuments({ drive: { $in: driveIds }, isSample: true }),
      assessments: 0,
      interviews: 0,
      placementResults: await AppliedDrive.countDocuments({ drive: { $in: driveIds }, isSample: true, status: "hired" }),
    };
    await Institute.updateOne(
      { _id: instituteId },
      { $set: { "mockData.status": "ready", "mockData.generatedAt": new Date(), "mockData.recordCounts": counts } }
    );
    return counts;
  } catch (error) {
    await Institute.updateOne(
      { _id: instituteId },
      { $set: { "mockData.status": "failed", "mockData.lastError": error instanceof Error ? error.message : "Generation failed" } }
    );
    throw error;
  }
};

const generateSampleInstituteDepartments = async (instituteId: string) => {
  await Institute.updateOne(
    { _id: instituteId },
    { $push: { departments: { $each: sampleDepartments.map((department) => ({ ...department, isSample: true })) } } }
  );

  await Institute.updateOne(
    { _id: instituteId },
    {
      $push: {
        auditLogs: {
          action: "Added sample departments",
          user: "System",
          userId: "system",
          type: "info",
        },
      },
    }
  );
};

const generateRandomCandidate = () => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet
    .email({ firstName, lastName, provider: "example.com" })
    .toLowerCase();

  let username = faker.internet.username({ firstName, lastName }).toLowerCase();
  username = username.replace(/[^a-z0-9_-]/g, "_");

  return {
    firstName,
    lastName,
    email,
    username,
    gender: faker.helpers.arrayElement(["Male", "Female", "Other"]),
    dob: faker.date.birthdate({ min: 18, max: 30, mode: "age" }).toISOString(),
  };
};

const generateSampleInstituteCandidates = async (instituteId: string) => {
  const institute = await Institute.findById(instituteId);
  if (!institute) {
    throw new Error("Institute not found");
  }

  const passphrase = generate({
    fast: true,
    separator: "-",
    length: 3,
    numbers: false,
  });

  const candidates = Array.from({ length: CANDIDATES_LIMIT }).map(() =>
    generateRandomCandidate()
  );

  for (const candidate of candidates) {
    await userDirectory.users.createUser({
      skipPasswordChecks: true,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      password: passphrase,
      emailAddress: [candidate.email],
      privateMetadata: { isSample: true, sampleInstituteId: instituteId },
    });

    console.log("Created user:", candidate.username);
  }

  const dbUsers = await User.find({
    isSample: true,
    sampleInstituteId: instituteId,
  }).lean();

  console.log("DB Users", dbUsers);

  for (const user of dbUsers) {
    const accountUser = await userDirectory.users.getUser(user._id.toString());

    const newCandidate = new Candidate({
      userId: user._id,
      name: `${accountUser.firstName} ${accountUser.lastName}`,
      dob: faker.date.birthdate({ min: 18, max: 30, mode: "age" }),
      gender: faker.helpers.arrayElement(["Male", "Female", "Other"]),
      email: user.email,
      phone: faker.phone.number(),
      address: faker.location.streetAddress(true),
      summary: faker.lorem.paragraph(),
      profileImage: faker.image.avatar(),
      isSample: true,

      socialLinks: Array.from({
        length: faker.number.int({ min: 1, max: 3 }),
      }).map(() => ({
        platform: faker.helpers.arrayElement([
          "linkedin",
          "github",
          "twitter",
          "facebook",
          "instagram",
          "portfolio",
        ]),
        url: faker.internet.url(),
      })),

      education: Array.from({
        length: faker.number.int({ min: 1, max: 3 }),
      }).map(() => {
        const startYear = faker.number.int({ min: 2010, max: 2022 });
        const endYear = faker.datatype.boolean()
          ? startYear + faker.number.int({ min: 1, max: 4 })
          : null;
        const activeBacklogs = faker.number.int({ min: 0, max: 3 });
        const totalBacklogs =
          activeBacklogs +
          faker.number.int({ min: activeBacklogs, max: activeBacklogs + 10 });

        return {
          school: faker.company.name() + " University",
          degree: faker.helpers.arrayElement([
            "Bachelor of Science",
            "Bachelor of Arts",
            "Master of Science",
            "PhD",
            "Diploma",
            "Bachelor of Engineering",
          ]),
          board: faker.helpers.arrayElement([
            "University Board",
            "State Board of Education",
            "National Board",
            "International Board",
            "MSBTE",
            "Mumbai University",
          ]),
          branch: faker.helpers.arrayElement([
            "Computer Science",
            "Information Technology",
            "Engineering",
            "Business",
            "Arts",
            "Science",
          ]),
          startYear,
          endYear,
          current: endYear === null,
          type: faker.helpers.arrayElement([
            "fulltime",
            "parttime",
            "distance",
          ]),
          percentage: faker.number.float({
            min: 60,
            max: 95,
            fractionDigits: 1,
          }),
          activeBacklogs,
          totalBacklogs,
          clearedBacklogs: totalBacklogs - activeBacklogs,
          backlogHistory: Array.from({
            length: totalBacklogs
              ? faker.number.int({ min: 0, max: totalBacklogs })
              : 0,
          }).map(() => ({
            subject: faker.helpers.arrayElement([
              "Advanced Algorithms",
              "Compiler Design",
              "Database Systems",
              "Computer Networks",
            ]),
            semester: faker.number.int({ min: 1, max: 8 }),
            cleared: faker.datatype.boolean(),
            attemptCount: faker.number.int({ min: 1, max: 3 }),
            clearedDate: faker.date.recent(),
          })),
          createdAt: faker.date.recent(),
        };
      }),

      workExperience: Array.from({
        length: faker.number.int({ min: 0, max: 2 }),
      }).map(() => {
        const startDate = faker.date.past({ years: 3 });
        const endDate = faker.datatype.boolean()
          ? faker.date.between({ from: startDate, to: new Date() })
          : null;

        return {
          company: faker.company.name(),
          sector: faker.helpers.arrayElement([
            "Technology",
            "Finance",
            "Healthcare",
            "Education",
            "Retail",
          ]),
          title: faker.person.jobTitle(),
          location: `${faker.location.city()}, ${faker.location.state()}`,
          type: faker.helpers.arrayElement([
            "fulltime",
            "parttime",
            "internship",
            "contract",
            "freelance",
          ]),
          jobFunction: faker.helpers.arrayElement([
            "Development",
            "Design",
            "Data Analysis",
            "Marketing",
            "Sales",
          ]),
          startDate,
          endDate,
          current: endDate === null,
          description: faker.lorem.paragraph(),
          createdAt: faker.date.recent(),
        };
      }),

      technicalSkills: Array.from({
        length: faker.number.int({ min: 3, max: 8 }),
      }).map(() => ({
        skill: faker.helpers.arrayElement([
          "JavaScript",
          "Python",
          "Java",
          "C++",
          "React",
          "Node.js",
          "MongoDB",
          "SQL",
          "Machine Learning",
        ]),
        proficiency: faker.number.int({ min: 5, max: 10 }),
        createdAt: faker.date.recent(),
      })),

      languages: Array.from({
        length: faker.number.int({ min: 1, max: 3 }),
      }).map(() => ({
        language: faker.helpers.arrayElement([
          "English",
          "Spanish",
          "French",
          "German",
          "Chinese",
          "Japanese",
        ]),
        proficiency: faker.number.int({ min: 5, max: 10 }),
        createdAt: faker.date.recent(),
      })),

      subjects: Array.from({
        length: faker.number.int({ min: 2, max: 5 }),
      }).map(() => ({
        subject: faker.helpers.arrayElement([
          "Database Systems",
          "Artificial Intelligence",
          "Computer Networks",
          "Data Structures",
        ]),
        proficiency: faker.number.int({ min: 5, max: 10 }),
        createdAt: faker.date.recent(),
      })),

      projects: Array.from({
        length: faker.number.int({ min: 1, max: 3 }),
      }).map(() => {
        const startDate = faker.date.past({ years: 2 });
        const endDate = faker.datatype.boolean()
          ? faker.date.between({ from: startDate, to: new Date() })
          : null;

        return {
          title: faker.helpers.arrayElement([
            "Smart Home Automation System",
            "Machine Learning Stock Predictor",
            "E-commerce Platform",
            "Social Media Dashboard",
            "Personal Finance Tracker",
          ]),
          domain: faker.helpers.arrayElement([
            "Web Development",
            "Mobile Development",
            "Machine Learning",
            "IoT",
            "Cloud Computing",
          ]),
          startDate,
          endDate,
          current: endDate === null,
          associatedWith: faker.helpers.arrayElement([
            "personal",
            "academic",
            "professional",
          ]),
          description: faker.lorem.paragraph(),
          url: faker.internet.url(),
          createdAt: faker.date.recent(),
        };
      }),

      certificates: Array.from({
        length: faker.number.int({ min: 0, max: 2 }),
      }).map(() => {
        const issueDate = faker.date.past({ years: 2 });
        const doesExpire = faker.datatype.boolean();
        const hasScore = faker.datatype.boolean();

        return {
          title: faker.helpers.arrayElement([
            "AWS Certified Solutions Architect",
            "Google Cloud Professional",
            "Microsoft Certified: Azure Developer",
            "Certified Data Scientist",
            "Full Stack Web Development",
          ]),
          issuer: faker.company.name(),
          url: faker.internet.url(),
          licenseNumber: faker.datatype.boolean()
            ? faker.string.alphanumeric(10)
            : null,
          issueDate,
          doesExpire,
          expiryDate: doesExpire
            ? faker.date.future({ years: 3, refDate: issueDate })
            : null,
          hasScore,
          score: hasScore ? faker.number.int({ min: 700, max: 990 }) : null,
          description: faker.lorem.sentence(),
          createdAt: faker.date.recent(),
        };
      }),

      resumeUrl: "scriptopia-resumes/sample.pdf",
      institute: instituteId,
      instituteUid: faker.string.alphanumeric(10),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newCandidate.save();
    institute.candidates.push(newCandidate._id);
  }

  await institute.save();

  await Institute.updateOne(
    { _id: instituteId },
    {
      $push: {
        auditLogs: {
          action: `Added ${CANDIDATES_LIMIT} sample candidates`,
          user: "System",
          userId: "system",
          type: "info",
        },
      },
    }
  );
};

const generateSamplePlacementGroups = async (
  instituteId: string,
  createdBy: string
) => {
  try {
    const institute = await Institute.findById(instituteId);
    if (!institute) {
      throw new Error("Institute not found");
    }

    const candidates = await Candidate.find({
      institute: instituteId,
      isSample: true,
    });

    if (candidates.length === 0) {
      console.log("No sample candidates found to create placement groups");
      return;
    }

    const groupCount = faker.number.int({
      min: PLACEMENT_GROUPS_MIN,
      max: PLACEMENT_GROUPS_MAX,
    });

    console.log(`Creating ${groupCount} sample placement groups`);

    const placementGroupIds = [];

    for (let i = 0; i < groupCount; i++) {
      const startYear = faker.number.int({ min: 2019, max: 2024 });
      const endYear = startYear + 1;

      const departmentCount = faker.number.int({
        min: 1,
        max: Math.min(3, institute.departments.length),
      });

      const selectedDepartments = faker.helpers
        .shuffle(institute.departments)
        .slice(0, departmentCount)
        .map((dept) => dept._id);

      const candidateCount = faker.number.int({
        min: 1,
        max: Math.min(candidates.length, 20),
      });

      const selectedCandidates = faker.helpers
        .shuffle([...candidates])
        .slice(0, candidateCount)
        .map((candidate) => candidate._id);

      const placementGroup = new PlacementGroup({
        name: `${faker.company.name()} ${startYear}-${endYear} Placement Drive`,
        institute: instituteId,
        academicYear: {
          start: startYear.toString(),
          end: endYear.toString(),
        },
        departments: selectedDepartments,
        purpose: faker.helpers.arrayElement([
          "Campus recruitment drive",
          "Internship opportunity",
          "Summer placement",
          "Industrial training",
          "Pre-placement offer selection",
        ]),
        expiryDate: faker.date.between({
          from: new Date(`${endYear}-01-01`),
          to: new Date(`${endYear}-12-31`),
        }),
        candidates: selectedCandidates,
        pendingCandidates: [],
        createdBy,
        isSample: true,
        archived: faker.datatype.boolean(0.2),
      });

      const savedPlacementGroup = await placementGroup.save();
      placementGroupIds.push(savedPlacementGroup._id);

      console.log(`Created placement group: ${placementGroup.name}`);
    }

    await Institute.updateOne(
      { _id: instituteId },
      {
        $push: {
          placementGroups: { $each: placementGroupIds },
          auditLogs: {
            action: `Added ${groupCount} sample placement groups`,
            user: "System",
            userId: "system",
            type: "info",
          },
        },
      }
    );

    console.log(
      `Added ${groupCount} placement groups to institute ${instituteId}`
    );
  } catch (error) {
    console.error("Error generating placement groups:", error);
    throw error;
  }
};

/**
 * Generate sample companies and associate them with the institute
 */
const generateSampleCompanies = async (instituteId: string) => {
  try {
    const companyCount = faker.number.int({
      min: COMPANIES_MIN,
      max: COMPANIES_MAX,
    });

    console.log(`Creating ${companyCount} sample companies`);

    const companyIds = [];

    const industries = [
      "Technology",
      "Finance",
      "Healthcare",
      "Manufacturing",
      "Retail",
      "Consulting",
      "Education",
      "Telecommunications",
      "Energy",
      "Media",
      "Real Estate",
      "Automotive",
      "Aerospace",
      "Pharmaceuticals",
      "Transportation",
      "Food & Beverage",
      "Entertainment",
    ];

    const roles = [
      "Software Engineer",
      "Data Scientist",
      "Product Manager",
      "Business Analyst",
      "UX Designer",
      "Marketing Specialist",
      "Sales Representative",
      "Financial Analyst",
      "HR Specialist",
      "Operations Manager",
      "Network Administrator",
      "DevOps Engineer",
      "Quality Assurance Analyst",
      "Research Scientist",
      "Customer Success Manager",
      "Project Manager",
      "Technical Writer",
    ];

    for (let i = 0; i < companyCount; i++) {
      const industryCount = faker.number.int({ min: 1, max: 3 });
      const companyIndustries = faker.helpers.arrayElements(
        industries,
        industryCount
      );

      const rolesCount = faker.number.int({ min: 2, max: 5 });
      const companyRoles = faker.helpers.arrayElements(roles, rolesCount);

      const currentYear = new Date().getFullYear();
      const yearStats = Array.from({ length: 3 }).map((_, index) => {
        const year = (currentYear - index).toString();
        const hired = faker.number.int({ min: 5, max: 50 });
        const highest = faker.number.int({ min: 1200000, max: 3000000 });
        const average = faker.number.int({ min: 600000, max: highest });

        return {
          year,
          hired,
          highest,
          average,
        };
      });

      const company = new Company({
        name: faker.company.name(),
        description:
          faker.company.catchPhrase() + ". " + faker.lorem.paragraph(2),
        generalInfo: {
          industry: companyIndustries,
          yearStats,
          rolesOffered: companyRoles,
        },
        hrContact: {
          name: faker.person.fullName(),
          phone: faker.phone.number(),
          email: faker.internet.email(),
          website: faker.internet.url(),
        },
        isArchived: faker.datatype.boolean(0.15),
        isSample: true,
        createdAt: faker.date.past({ years: 2 }),
        updatedAt: faker.date.recent(),
      });

      const savedCompany = await company.save();
      companyIds.push(savedCompany._id);

      console.log(`Created company: ${company.name}`);
    }

    await Institute.updateOne(
      { _id: instituteId },
      {
        $push: {
          companies: { $each: companyIds },
          auditLogs: {
            action: `Added ${companyCount} sample companies`,
            user: "System",
            userId: "system",
            type: "info",
          },
        },
      }
    );

    console.log(`Added ${companyCount} companies to institute ${instituteId}`);

    return companyIds;
  } catch (error) {
    console.error("Error generating companies:", error);
    throw error;
  }
};

/**
 * Generate sample drives for the institute
 */
const generateSampleDrives = async (instituteId: string) => {
  try {
    const institute = await Institute.findById(instituteId)
      .populate<{ placementGroups: IPlacementGroup[] }>("placementGroups")
      .populate<{ companies: ICompany[] }>("companies");

    if (!institute) {
      throw new Error("Institute not found");
    }

    if (!institute.placementGroups || institute.placementGroups.length === 0) {
      console.log("No placement groups found, cannot create drives");
      return;
    }

    if (!institute.companies || institute.companies.length === 0) {
      console.log("No companies found, cannot create drives");
      return;
    }

    const driveCount = faker.number.int({
      min: DRIVES_MIN,
      max: DRIVES_MAX,
    });

    console.log(`Creating ${driveCount} sample drives`);

    const customStepNames = [
      ["Resume Shortlisting", "Technical Interview", "HR Interview"],
      [
        "Application Screening",
        "Aptitude Test",
        "Technical Round",
        "Final Interview",
      ],
      [
        "Profile Review",
        "Coding Challenge",
        "Technical Discussion",
        "Culture Fit",
        "Offer Discussion",
      ],
      [
        "Resume Evaluation",
        "Group Discussion",
        "Technical Skills Assessment",
        "Managerial Round",
      ],
      [
        "Initial Screening",
        "Technical Assessment",
        "Team Fit Interview",
        "HR & Compensation Discussion",
      ],
      [
        "Application Review",
        "Online Coding Test",
        "System Design Discussion",
        "Behavioral Interview",
      ],
    ];

    const techSkills = [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "Java",
      "C++",
      "SQL",
      "MongoDB",
      "AWS",
      "Docker",
      "Kubernetes",
      "Git",
      "Machine Learning",
      "Data Analysis",
      "System Design",
      "API Development",
      "Cloud Computing",
      "DevOps",
      "Agile Methodology",
      "UI/UX Design",
      "Mobile Development",
    ];

    const employmentTypes = [
      "full_time",
      "part_time",
      "internship",
      "contract",
      "temporary",
    ];

    const currencies = ["INR", "USD", "EUR", "GBP"];

    for (let i = 0; i < driveCount; i++) {
      const company = faker.helpers.arrayElement(institute.companies);

      const placementGroup = faker.helpers.arrayElement(
        institute.placementGroups
      );

      const placementGroupData = await PlacementGroup.findById(
        placementGroup._id
      );

      if (
        !placementGroupData ||
        !placementGroupData.candidates ||
        placementGroupData.candidates.length === 0
      ) {
        continue;
      }

      const isPublished = faker.datatype.boolean(0.8);

      const hasEnded = isPublished ? faker.datatype.boolean(0.5) : false;

      const now = new Date();
      const pastDate = faker.date.past({ years: 1 }); // 1 day in milliseconds
      const futureDate = faker.date.future({ years: 1 });

      let applicationStart, applicationEnd;
      const calculatedToDate = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      );
      if (hasEnded) {
        applicationStart = faker.date.between({
          from: pastDate < calculatedToDate ? pastDate : calculatedToDate,
          to: calculatedToDate,
        });
        applicationEnd = faker.date.between({
          from: applicationStart,
          to: now,
        });
      } else {
        if (faker.datatype.boolean()) {
          applicationStart = faker.date.recent({ days: 30 });
          applicationEnd = faker.date.soon({ days: 30 });
        } else {
          applicationStart = faker.date.soon({ days: 10 });
          applicationEnd = faker.date.between({
            from: applicationStart,
            to: futureDate,
          });
        }
      }

      let selectedCandidates: string | any[] = [];
      let hiredCandidates: string | any[] = [];
      let offerLetters: Types.ObjectId[] = [];

      if (isPublished) {
        const selectionPercentage = faker.number.float({ min: 0.8, max: 1.0 });
        selectedCandidates = faker.helpers
          .shuffle([...placementGroupData.candidates])
          .slice(
            0,
            Math.floor(
              placementGroupData.candidates.length * selectionPercentage
            )
          );

        if (hasEnded && selectedCandidates.length > 0) {
          const hirePercentage = faker.number.float({ min: 0.1, max: 0.5 });
          hiredCandidates = faker.helpers
            .shuffle([...selectedCandidates])
            .slice(0, Math.ceil(selectedCandidates.length * hirePercentage));

          const offerLetterPercentage = faker.number.float({
            min: 0.7,
            max: 1.0,
          });
          offerLetters = faker.helpers
            .shuffle([...hiredCandidates])
            .slice(
              0,
              Math.ceil(hiredCandidates.length * offerLetterPercentage)
            );
        }
      }

      const stepsTemplate = faker.helpers.arrayElement(customStepNames);
      const steps = stepsTemplate.map((stepName) => ({
        name: stepName,
        type: "CUSTOM",
        status: hasEnded
          ? StepStatus.COMPLETED
          : faker.helpers.arrayElement([
              StepStatus.PENDING,
              StepStatus.IN_PROGRESS,
            ]),
        schedule: {
          startTime: hasEnded
            ? faker.date.between({ from: applicationEnd, to: now })
            : null,
          endTime: hasEnded ? faker.date.recent() : null,
          actualCompletionTime: hasEnded ? faker.date.recent() : null,
        },
      }));

      const currencySelected = faker.helpers.arrayElement(currencies);
      const minSalary = faker.number.int({ min: 300000, max: 1000000 });
      const maxSalary = faker.number.int({
        min: minSalary * 1.2,
        max: minSalary * 2,
      });

      const selectedSkills = faker.helpers.arrayElements(
        techSkills,
        faker.number.int({ min: 3, max: 8 })
      );

      const drive = new Drive({
        institute: instituteId,
        title: `${company.name} ${faker.helpers.arrayElement([
          "Campus Recruitment",
          "Hiring Drive",
          "Career Fair",
          "Talent Hunt",
        ])} ${new Date().getFullYear()}`,
        link: faker.internet.url(),
        description: {
          blocks: [
            {
              key: faker.string.uuid(),
              text: faker.lorem.paragraphs(3),
              type: "unstyled",
              depth: 0,
              inlineStyleRanges: [],
              entityRanges: [],
              data: {},
            },
          ],
          entityMap: {},
        },
        company: company._id,
        location: faker.helpers.arrayElement([
          "Remote",
          "Hybrid",
          `${faker.location.city()}, ${faker.location.state()}`,
          `${faker.location.city()}`,
          "Multiple Locations",
        ]),
        type: faker.helpers.arrayElement(employmentTypes),
        url: faker.internet.url(),
        openings: faker.number.int({ min: 1, max: 20 }),
        salary: {
          min: minSalary,
          max: maxSalary,
          currency: currencySelected,
        },
        applicationRange: {
          start: applicationStart,
          end: applicationEnd,
        },
        skills: selectedSkills,
        workflow: {
          steps: steps,
        },
        assignments: [],
        mcqAssessments: [],
        codeAssessments: [],
        interviews: [],
        candidates: selectedCandidates,
        additionalDetails: {},
        placementGroup: placementGroup._id,
        published: isPublished,
        publishedOn: isPublished ? faker.date.recent({ days: 30 }) : null,
        hasEnded: hasEnded,
        hiredCandidates: hiredCandidates,
        offerLetters: offerLetters,
        isSample: true,
      });

      await drive.save();
      institute.drives.push(drive._id);
      console.log(
        `Created drive: ${drive.title} (${isPublished ? "Published" : "Draft"}${
          hasEnded ? ", Ended" : ""
        })`
      );
    }
    
    await institute.save();

    await Institute.updateOne(
      { _id: instituteId },
      {
        $push: {
          auditLogs: {
            action: `Added ${driveCount} sample drives`,
            user: "System",
            userId: "system",
            type: "info",
          },
        },
      }
    );

    console.log(
      `Added ${driveCount} sample drives for institute ${instituteId}`
    );
  } catch (error) {
    console.error("Error generating drives:", error);
    throw error;
  }
};

const generateSampleAppliedDrives = async (instituteId: string) => {
  try {
    const publishedDrives = await Drive.find({
      institute: instituteId,
      published: true,
    }).populate("placementGroup");

    if (!publishedDrives || publishedDrives.length === 0) {
      console.log("No published drives found for this institute.");
      return;
    }

    for (const drive of publishedDrives) {
      const placementGroup = await PlacementGroup.findById(
        drive.placementGroup
      ).populate("candidates");
      if (
        !placementGroup ||
        !placementGroup.candidates ||
        placementGroup.candidates.length === 0
      ) {
        console.log(
          `Skipping drive: ${drive.title} (No candidates in associated placement group)`
        );
        continue;
      }

      const totalCandidates = placementGroup.candidates.length;
      const appliedCount = Math.ceil(
        totalCandidates * faker.number.float({ min: 0.5, max: 1.0 })
      );

      console.log(
        `Generating ${appliedCount} applied drives for drive: ${drive.title}`
      );

      const appliedDrives = [];

      const selectedCandidates = faker.helpers
        .shuffle([...placementGroup.candidates])
        .slice(0, appliedCount);

      for (const candidateId of selectedCandidates) {
        const status = faker.helpers.arrayElement([
          "applied",
          "inprogress",
          "rejected",
          "hired",
        ]);

        let disqualifiedStage = null;
        let disqualifiedReason = null;
        if (status === "rejected") {
          const workflowSteps = drive.workflow?.steps || [];
          if (workflowSteps.length > 0) {
            const randomStep = faker.helpers.arrayElement(workflowSteps);
            disqualifiedStage = randomStep._id;
            disqualifiedReason = faker.helpers.arrayElement([
              "Failed technical round",
              "Did not meet minimum qualifications",
              "Missed interview",
              "Failed coding assessment",
            ]);
          }
        }

        let salary = null;
        let offerLetterKey = null;
        let offerLetterUploadedAt = null;
        if (
          status === "hired" &&
          drive.hasEnded &&
          drive.workflow?.steps?.slice(-1)[0]?.status === "completed"
        ) {
          salary = faker.number.int({
            min: drive.salary.min!,
            max: drive.salary.max!,
          });

          offerLetterKey = faker.string.uuid();
          offerLetterUploadedAt = faker.date.between({
            from: drive.publishedOn || new Date(),
            to: new Date(),
          });
        }

        const appliedDrive = {
          drive: drive._id,
          user: candidateId,
          disqualifiedStage,
          disqualifiedReason,
          scores: [],
          status,
          salary,
          offerLetterKey,
          offerLetterUploadedAt,
          isSample: true,
        };

        appliedDrives.push(appliedDrive);
      }

      await AppliedDrive.insertMany(appliedDrives);
      console.log(
        `Created ${appliedDrives.length} applied drives for drive: ${drive.title}`
      );
    }

    console.log("Sample applied drives generation complete.");
  } catch (error) {
    console.error("Error generating sample applied drives:", error);
    throw error;
  }
};

export default generateSampleInstituteData;
