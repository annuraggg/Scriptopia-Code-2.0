import AppliedDrive from "@/models/AppliedDrive";
import Candidate from "@/models/Candidate";
import Company from "@/models/Company";
import Drive from "@/models/Drive";
import Institute from "@/models/Institute";
import PlacementGroup from "@/models/PlacementGroup";
import User from "@/models/User";
import generateSampleInstituteData from "@/utils/generateSampleInstituteData";

export const getMockDataStatus = async (instituteId: string) => {
  const institute = await Institute.findById(instituteId).select("mockData").lean();
  if (!institute) throw new Error("Institute not found");
  return institute.mockData || { status: "none", recordCounts: {} };
};

export const generateMockData = async (instituteId: string) => {
  const status = await getMockDataStatus(instituteId);
  if (status.status === "generating" || status.status === "removing") {
    throw new Error("Mock data operation already in progress");
  }
  if (status.status === "ready") throw new Error("Remove existing mock data before generating it again");
  return generateSampleInstituteData(instituteId);
};

export const removeMockData = async (instituteId: string) => {
  const institute = await Institute.findById(instituteId);
  if (!institute) throw new Error("Institute not found");
  await Institute.updateOne({ _id: instituteId }, { $set: { "mockData.status": "removing" } });

  const candidateIds = await Candidate.find({ institute: instituteId, isSample: true }).distinct("_id");
  const placementGroupIds = await PlacementGroup.find({ institute: instituteId, isSample: true }).distinct("_id");
  const companyIds = institute.companies.filter((id: any) => id).map((id: any) => id.toString());
  const sampleCompanyIds = await Company.find({ _id: { $in: companyIds }, isSample: true }).distinct("_id");
  const driveIds = institute.drives.filter((id: any) => id).map((id: any) => id.toString());
  const sampleDriveIds = await Drive.find({ _id: { $in: driveIds }, isSample: true }).distinct("_id");

  await AppliedDrive.deleteMany({ drive: { $in: sampleDriveIds }, isSample: true });
  await Drive.deleteMany({ _id: { $in: sampleDriveIds }, isSample: true });
  await PlacementGroup.deleteMany({ _id: { $in: placementGroupIds }, isSample: true });
  await Company.deleteMany({ _id: { $in: sampleCompanyIds }, isSample: true });
  await Candidate.deleteMany({ _id: { $in: candidateIds }, institute: instituteId, isSample: true });
  await User.deleteMany({ sampleInstituteId: instituteId, isSample: true });

  await Institute.updateOne(
    { _id: instituteId },
    {
      $pull: {
        departments: { isSample: true },
        candidates: { $in: candidateIds },
        placementGroups: { $in: placementGroupIds },
        companies: { $in: sampleCompanyIds },
        drives: { $in: sampleDriveIds },
      },
      $set: {
        mockData: {
          status: "none",
          recordCounts: {
            departments: 0, students: 0, faculty: 0, companies: 0,
            placementGroups: 0, drives: 0, applications: 0,
            assessments: 0, interviews: 0, placementResults: 0,
          },
        },
      },
      $push: {
        auditLogs: {
          action: "Removed generated mock data",
          user: "System",
          userId: "system",
          type: "info",
        },
      },
    }
  );

  return { removed: true };
};
