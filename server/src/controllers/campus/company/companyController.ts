import Company from "../../../models/Company";
import Institute from "../../../models/Institute";
import checkPermission from "../../../middlewares/checkInstitutePermission";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import logger from "../../../utils/logger";
import { Context } from "hono";
import userDirectory from "@/services/userDirectory";
import { AuditLog } from "@shared-types/Institute";
import mongoose from "mongoose";
import Drive from "@/models/Drive";
import Candidate from "@/models/Candidate";
import AppliedDrive from "@/models/AppliedDrive";

const createAuditLog = async (
  c: Context,
  instituteId: mongoose.Types.ObjectId,
  action: string,
  type: "info" | "warning" | "error" = "info"
): Promise<void> => {
  try {
    const authData = c.get("auth");
    if (!authData || !authData.userId) {
      logger.error("Missing auth data for audit log");
      return;
    }

    const accountUser = await userDirectory.users.getUser(authData.userId);
    const auditLog: AuditLog = {
      user: `${accountUser.firstName || ""} ${accountUser.lastName || ""}`.trim(),
      userId: accountUser.id,
      action,
      type,
    };

    await Institute.findByIdAndUpdate(instituteId, {
      $push: { auditLogs: auditLog },
    });

    logger.info(`Audit log created: ${action}`);
  } catch (error) {
    logger.error(
      `Failed to create audit log: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const getCompanies = async (c: Context) => {
  try {
    const authData = c.get("auth");
    if (!authData) {
      return sendError(c, 401, "Authentication data missing");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      logger.warn(
        `Unauthorized access attempt to view companies by user ${authData.userId}`
      );
      return sendError(c, 403, "You don't have permission to view companies");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const pageSize = Math.min(
      100, // MAX_PAGE_SIZE
      Math.max(1, parseInt(c.req.query("pageSize") || "20", 10))
    );
    const skipCount = (page - 1) * pageSize;

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    // Get total count for pagination metadata
    const totalCount = await Company.countDocuments({
      _id: { $in: institute.companies },
      deleted: { $ne: true }, // Using softDelete plugin
    });

    // Fetch companies with pagination
    const companies = await Company.find({
      _id: { $in: institute.companies },
      deleted: { $ne: true }, // Using softDelete plugin
    })
      .skip(skipCount)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Format company data to avoid exposing sensitive information
    const formattedCompanies = companies.map((company) => ({
      _id: company._id?.toString(),
      name: company.name,
      description: company.description,
      generalInfo: company.generalInfo,
      hrContact: company.hrContact,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      isArchived: company.isArchived || false,
    }));

    return sendSuccess(c, 200, "Companies fetched successfully", {
      companies: formattedCompanies,
      pagination: {
        page,
        pageSize,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: page * pageSize < totalCount,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching companies: ${errorMessage}`);
    return sendError(c, 500, "Something went wrong while fetching companies");
  }
};

const getCompany = async (c: Context) => {
  try {
    const authData = c.get("auth");
    if (!authData) {
      return sendError(c, 401, "Authentication data missing");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      logger.warn(
        `Unauthorized access attempt to view company by user ${authData.userId}`
      );
      return sendError(c, 403, "You don't have permission to view companies");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const companyId = c.req.param("id");
    if (!companyId) {
      return sendError(c, 400, "Company ID is required");
    }

    // Check if institute exists and contains the company
    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    // Check if company belongs to institute
    const isCompanyInInstitute = institute.companies.some(
      (id) => id.toString() === companyId
    );

    if (!isCompanyInInstitute) {
      return sendError(c, 404, "Company not found in this institute");
    }

    // Fetch company details
    const company = await Company.findOne({
      _id: companyId,
      deleted: { $ne: true }, // Using softDelete plugin
    })
      .lean()
      .exec();

    if (!company) {
      return sendError(c, 404, "Company not found");
    }

    // Format company data to avoid exposing sensitive information
    const formattedCompany = {
      _id: company._id?.toString(),
      name: company.name,
      description: company.description,
      generalInfo: company.generalInfo,
      hrContact: company.hrContact,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      isArchived: company.isArchived || false,
    };

    const companyDrives = await Drive.find({
      company: companyId,
      deleted: { $ne: true }, // Using softDelete plugin
    });

    const candidateIds = companyDrives.map((drive) => drive.candidates).flat();
    const companyAppliedDrives = await AppliedDrive.find({
      drive: { $in: companyDrives.map((drive) => drive._id) },
    });

    const hiredCandidateIds = companyAppliedDrives
      .filter((appliedDrive) => appliedDrive.status === "hired")
      .map((appliedDrive) => appliedDrive.user);

    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
    }).select("userId name email instituteUid institute instituteDepartment");

    const finalCandidates = candidates.map((candidate) => ({
      _id: candidate._id?.toString(),
      name: candidate.name,
      email: candidate.email,
      uid: candidate.instituteUid,
      department: candidate.instituteDepartment,
      placed: hiredCandidateIds.includes(candidate._id),
    }));

    return sendSuccess(c, 200, "Company fetched successfully", {
      company: formattedCompany,
      candidates: finalCandidates,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching company: ${errorMessage}`);
    return sendError(c, 500, "Something went wrong while fetching the company");
  }
};

const createCompany = async (c: Context) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authData = c.get("auth");
    if (!authData) {
      return sendError(c, 401, "Authentication data missing");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      logger.warn(
        `Unauthorized access attempt to create company by user ${authData.userId}`
      );
      return sendError(c, 403, "You don't have permission to create companies");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    // Validate request body
    const companyData = await c.req.json().catch(() => ({}));
    console.log(companyData)

    // Validate required fields
    const {
      name,
      description = "",
      generalInfo = {},
      hrContact = {},
    } = companyData;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      await session.abortTransaction();
      return sendError(
        c,
        400,
        "Company name is required and must be a non-empty string"
      );
    }

    // Validate generalInfo
    if (!generalInfo || typeof generalInfo !== "object") {
      await session.abortTransaction();
      return sendError(c, 400, "generalInfo must be an object");
    }

    // Create a valid yearStats array that matches MongoDB document expectations
    let yearStatsArray: Array<{
      year: string;
      hired: number;
      highest: number;
      average: number;
    }> = [];

    // Add yearStats if provided
    if (generalInfo.yearStats && Array.isArray(generalInfo.yearStats)) {
      // Validate each yearStat
      for (const yearStat of generalInfo.yearStats) {
        if (
          !yearStat.year ||
          !yearStat.hired ||
          !yearStat.highest ||
          !yearStat.average
        ) {
          await session.abortTransaction();
          return sendError(
            c,
            400,
            "Each yearStat must include year, hired, highest, and average values"
          );
        }

        // Validate numeric values
        const hiredNum = Number(yearStat.hired);
        const highestNum = Number(yearStat.highest);
        const averageNum = Number(yearStat.average);

        if (isNaN(hiredNum) || hiredNum < 0) {
          await session.abortTransaction();
          return sendError(c, 400, "hired must be a non-negative number");
        }

        if (isNaN(highestNum) || highestNum < 0) {
          await session.abortTransaction();
          return sendError(c, 400, "highest must be a non-negative number");
        }

        if (isNaN(averageNum) || averageNum < 0) {
          await session.abortTransaction();
          return sendError(c, 400, "average must be a non-negative number");
        }

        yearStatsArray.push({
          year: yearStat.year,
          hired: hiredNum,
          highest: highestNum,
          average: averageNum,
        });
      }
    }
    // For backward compatibility - convert old format to new if needed
    else if (
      generalInfo.studentsHired !== undefined ||
      generalInfo.averagePackage !== undefined ||
      generalInfo.highestPackage !== undefined
    ) {
      const currentYear = new Date().getFullYear().toString();
      const studentsHiredNum = Number(generalInfo.studentsHired || 0);
      const averagePackageNum = Number(generalInfo.averagePackage || 0);
      const highestPackageNum = Number(generalInfo.highestPackage || 0);

      if (isNaN(studentsHiredNum) || studentsHiredNum < 0) {
        await session.abortTransaction();
        return sendError(c, 400, "studentsHired must be a non-negative number");
      }

      if (isNaN(averagePackageNum) || averagePackageNum < 0) {
        await session.abortTransaction();
        return sendError(
          c,
          400,
          "averagePackage must be a non-negative number"
        );
      }

      if (isNaN(highestPackageNum) || highestPackageNum < 0) {
        await session.abortTransaction();
        return sendError(
          c,
          400,
          "highestPackage must be a non-negative number"
        );
      }

      yearStatsArray.push({
        year: currentYear,
        hired: studentsHiredNum,
        highest: highestPackageNum,
        average: averagePackageNum,
      });
    }

    // Initialize default generalInfo structure
    const processedGeneralInfo = {
      industry: Array.isArray(generalInfo.industry) ? generalInfo.industry : [],
      yearStats: yearStatsArray,
      rolesOffered: Array.isArray(generalInfo.rolesOffered)
        ? generalInfo.rolesOffered
        : [],
    };

    // Validate hrContact
    const processedHrContact = {
      name: hrContact.name || "",
      phone: hrContact.phone || "",
      email: hrContact.email || "",
      website: hrContact.website || "",
    };

    // Check if institute exists
    const institute = await Institute.findById(instituteId).session(session);
    if (!institute) {
      await session.abortTransaction();
      return sendError(c, 404, "Institute not found");
    }

    // Check for duplicate company name (case-insensitive)
    const existingCompany = await Company.findOne({
      name: {
        $regex: new RegExp(
          `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
      deleted: { $ne: true }, // Using softDelete plugin
    }).session(session);

    if (existingCompany) {
      await session.abortTransaction();
      return sendError(c, 409, "A company with this name already exists");
    }

    // Create company with validated and sanitized data
    const newCompany = new Company({
      name: name.trim(),
      description: description ? description.trim() : "",
      generalInfo: processedGeneralInfo,
      hrContact: processedHrContact,
      isArchived: false,
    });

    await newCompany.save({ session });

    // Update institute with new company ID
    await Institute.findByIdAndUpdate(
      new mongoose.Types.ObjectId(instituteId),
      { $push: { companies: newCompany._id } },
      { session }
    );

    await session.commitTransaction();

    // Create audit log
    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(instituteId),
      `Created new company profile: ${name}`
    );

    return sendSuccess(c, 201, "Company created successfully", {
      _id: newCompany._id,
      name: newCompany.name,
      description: newCompany.description,
      generalInfo: newCompany.generalInfo,
      hrContact: newCompany.hrContact,
      isArchived: newCompany.isArchived,
      createdAt: newCompany.createdAt,
      updatedAt: newCompany.updatedAt,
    });
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error creating company: ${errorMessage}`);
    return sendError(c, 500, "Something went wrong while creating the company");
  } finally {
    session.endSession();
  }
};

const updateCompany = async (c: Context) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authData = c.get("auth");
    if (!authData) {
      return sendError(c, 401, "Authentication data missing");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      logger.warn(
        `Unauthorized access attempt to update company by user ${authData.userId}`
      );
      return sendError(c, 403, "You don't have permission to update companies");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const companyData = await c.req.json().catch(() => ({}));
    const { _id, name, description, generalInfo, hrContact } = companyData;

    // Validate company ID
    if (!_id) {
      await session.abortTransaction();
      return sendError(c, 400, "Company ID is required");
    }

    // Check if institute exists and contains the company
    const institute = await Institute.findById(instituteId).session(session);
    if (!institute) {
      await session.abortTransaction();
      return sendError(c, 404, "Institute not found");
    }

    // Check if company belongs to institute
    const isCompanyInInstitute = institute.companies.some(
      (companyId) => companyId.toString() === _id.toString()
    );

    if (!isCompanyInInstitute) {
      await session.abortTransaction();
      return sendError(c, 404, "Company not found in this institute");
    }

    // Find company
    const company = await Company.findOne({
      _id: new mongoose.Types.ObjectId(_id),
      deleted: { $ne: true }, // Using softDelete plugin
    }).session(session);

    if (!company) {
      await session.abortTransaction();
      return sendError(c, 404, "Company not found");
    }

    // Check if the company is archived (using archiveProtection plugin)
    if (company.isArchived) {
      await session.abortTransaction();
      return sendError(c, 403, "Archived companies cannot be modified");
    }

    // Check for duplicate name if name is being changed
    if (name && name !== company.name) {
      const existingCompany = await Company.findOne({
        _id: { $ne: _id },
        name: {
          $regex: new RegExp(
            `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        },
        deleted: { $ne: true }, // Using softDelete plugin
      }).session(session);

      if (existingCompany) {
        await session.abortTransaction();
        return sendError(c, 409, "A company with this name already exists");
      }
    }

    // Update company fields if provided
    if (name) company.name = name.trim();
    if (description !== undefined) company.description = description.trim();

    // Validate and update generalInfo
    if (generalInfo) {
      if (typeof generalInfo !== "object") {
        await session.abortTransaction();
        return sendError(c, 400, "generalInfo must be an object");
      }

      // Initialize generalInfo if it doesn't exist
      if (!company.generalInfo) {
        company.generalInfo = {
          industry: [],
          rolesOffered: [],
        };
      }

      // Update industry if provided
      if (generalInfo.industry !== undefined) {
        if (!Array.isArray(generalInfo.industry)) {
          await session.abortTransaction();
          return sendError(c, 400, "industry must be an array");
        }
        company.generalInfo.industry = generalInfo.industry;
      }

      // Update rolesOffered if provided
      if (generalInfo.rolesOffered !== undefined) {
        if (!Array.isArray(generalInfo.rolesOffered)) {
          await session.abortTransaction();
          return sendError(c, 400, "rolesOffered must be an array");
        }
        company.generalInfo.rolesOffered = generalInfo.rolesOffered;
      }

      // Update yearStats if provided
      if (generalInfo.yearStats !== undefined) {
        if (!Array.isArray(generalInfo.yearStats)) {
          await session.abortTransaction();
          return sendError(c, 400, "yearStats must be an array");
        }

        const updatedYearStats: Array<{
          year: string;
          hired: number;
          highest: number;
          average: number;
        }> = [];

        // Validate each yearStat
        for (const yearStat of generalInfo.yearStats) {
          if (
            !yearStat.year ||
            yearStat.hired === undefined ||
            yearStat.highest === undefined ||
            yearStat.average === undefined
          ) {
            await session.abortTransaction();
            return sendError(
              c,
              400,
              "Each yearStat must include year, hired, highest, and average values"
            );
          }

          // Validate numeric values
          const hiredNum = Number(yearStat.hired);
          const highestNum = Number(yearStat.highest);
          const averageNum = Number(yearStat.average);

          if (isNaN(hiredNum) || hiredNum < 0) {
            await session.abortTransaction();
            return sendError(c, 400, "hired must be a non-negative number");
          }

          if (isNaN(highestNum) || highestNum < 0) {
            await session.abortTransaction();
            return sendError(c, 400, "highest must be a non-negative number");
          }

          if (isNaN(averageNum) || averageNum < 0) {
            await session.abortTransaction();
            return sendError(c, 400, "average must be a non-negative number");
          }

          updatedYearStats.push({
            year: yearStat.year,
            hired: hiredNum,
            highest: highestNum,
            average: averageNum,
          });
        }

        // @ts-expect-error // Mongoose document array type issue
        company.generalInfo.yearStats = updatedYearStats;
      }

      // For backward compatibility - handle old fields if present
      if (
        generalInfo.studentsHired !== undefined ||
        generalInfo.averagePackage !== undefined ||
        generalInfo.highestPackage !== undefined
      ) {
        const currentYear = new Date().getFullYear().toString();
        const studentsHiredNum = Number(generalInfo.studentsHired || 0);
        const averagePackageNum = Number(generalInfo.averagePackage || 0);
        const highestPackageNum = Number(generalInfo.highestPackage || 0);

        if (isNaN(studentsHiredNum) || studentsHiredNum < 0) {
          await session.abortTransaction();
          return sendError(
            c,
            400,
            "studentsHired must be a non-negative number"
          );
        }

        if (isNaN(averagePackageNum) || averagePackageNum < 0) {
          await session.abortTransaction();
          return sendError(
            c,
            400,
            "averagePackage must be a non-negative number"
          );
        }

        if (isNaN(highestPackageNum) || highestPackageNum < 0) {
          await session.abortTransaction();
          return sendError(
            c,
            400,
            "highestPackage must be a non-negative number"
          );
        }

        // Convert existing yearStats to a plain array if it's a Mongoose document array
        const yearStats = Array.isArray(company.generalInfo.yearStats)
          ? [...company.generalInfo.yearStats]
          : [];

        // Check if we already have a stat for the current year
        const existingYearIndex = yearStats.findIndex(
          (stat) => stat.year === currentYear
        );

        if (existingYearIndex >= 0) {
          // @ts-expect-error
          yearStats[existingYearIndex] = {
            year: currentYear,
            hired: studentsHiredNum,
            highest: highestPackageNum,
            average: averagePackageNum,
          };
        } else {
          // @ts-expect-error
          yearStats.push({
            year: currentYear,
            hired: studentsHiredNum,
            highest: highestPackageNum,
            average: averagePackageNum,
          });
        }

        // @ts-expect-error
        company.generalInfo.yearStats = yearStats;
      }
    }

    // Update hrContact
    if (hrContact !== undefined) {
      if (typeof hrContact !== "object") {
        await session.abortTransaction();
        return sendError(c, 400, "hrContact must be an object");
      }

      company.hrContact = {
        name: hrContact.name || company.hrContact?.name || "",
        phone: hrContact.phone || company.hrContact?.phone || "",
        email: hrContact.email || company.hrContact?.email || "",
        website: hrContact.website || company.hrContact?.website || "",
      };
    }

    await company.save({ session });
    await session.commitTransaction();

    // Create audit log
    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(instituteId),
      `Updated company profile: ${company.name}`
    );

    return sendSuccess(c, 200, "Company updated successfully", {
      _id: company._id,
      name: company.name,
      description: company.description,
      generalInfo: company.generalInfo,
      hrContact: company.hrContact,
      isArchived: company.isArchived,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    });
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error updating company: ${errorMessage}`);
    return sendError(c, 500, "Something went wrong while updating the company");
  } finally {
    session.endSession();
  }
};

const archiveCompany = async (c: Context) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authData = c.get("auth");
    if (!authData) {
      return sendError(c, 401, "Authentication data missing");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      logger.warn(
        `Unauthorized access attempt to archive company by user ${authData.userId}`
      );
      return sendError(
        c,
        403,
        "You don't have permission to archive/unarchive companies"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const reqData = await c.req.json().catch(() => ({}));
    const { id } = reqData;

    // Validate company ID
    if (!id) {
      await session.abortTransaction();
      return sendError(c, 400, "Company ID is required");
    }

    // Check if institute exists and contains the company
    const institute = await Institute.findById(instituteId).session(session);
    if (!institute) {
      await session.abortTransaction();
      return sendError(c, 404, "Institute not found");
    }

    // Check if company belongs to institute
    const isCompanyInInstitute = institute.companies.some(
      (companyId) => companyId.toString() === id.toString()
    );

    if (!isCompanyInInstitute) {
      await session.abortTransaction();
      return sendError(c, 404, "Company not found in this institute");
    }

    // Find and toggle archive status
    const company = await Company.findOne({
      _id: new mongoose.Types.ObjectId(id),
      deleted: { $ne: true }, // Using softDelete plugin
    }).session(session);

    if (!company) {
      await session.abortTransaction();
      return sendError(c, 404, "Company not found");
    }

    company.isArchived = !company.isArchived;
    await company.save({ session });

    // Create audit log
    const status = company.isArchived ? "Archived" : "Unarchived";
    await session.commitTransaction();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(instituteId),
      `${status} company: ${company.name}`
    );

    return sendSuccess(c, 200, `Company ${status.toLowerCase()} successfully`, {
      _id: company._id,
      name: company.name,
      isArchived: company.isArchived,
    });
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error archiving company: ${errorMessage}`);
    return sendError(
      c,
      500,
      "Something went wrong while changing company archive status"
    );
  } finally {
    session.endSession();
  }
};

const deleteCompany = async (c: Context) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  session.startTransaction();

  try {
    const authData = c.get("auth");
    if (!authData) {
      return sendError(c, 401, "Authentication data missing");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      logger.warn(
        `Unauthorized access attempt to delete company by user ${authData.userId}`
      );
      return sendError(c, 403, "You don't have permission to delete companies");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const companyId = c.req.param("id");
    if (!companyId) {
      await session.abortTransaction();
      return sendError(c, 400, "Company ID is required");
    }

    const institute = await Institute.findById(instituteId).session(session);
    if (!institute) {
      await session.abortTransaction();
      return sendError(c, 404, "Institute not found");
    }

    const isCompanyInInstitute = institute.companies.some(
      (id) => id.toString() === companyId
    );

    if (!isCompanyInInstitute) {
      await session.abortTransaction();
      return sendError(c, 404, "Company not found in this institute");
    }

    const company = await Company.findOne({
      _id: companyId,
      deleted: { $ne: true }, // Using softDelete plugin
    }).session(session);

    if (!company) {
      await session.abortTransaction();
      return sendError(c, 404, "Company not found");
    }

    const companyName = company.name;

    // Remove company from institute
    await Institute.findByIdAndUpdate(
      new mongoose.Types.ObjectId(instituteId),
      { $pull: { companies: companyId } },
      { session }
    );

    // Using soft delete instead of completely removing the document
    await company.deleteOne();
    await session.commitTransaction();
    transactionCommitted = true;

    // Create audit log
    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(instituteId),
      `Deleted company: ${companyName}`,
      "warning"
    );

    return sendSuccess(c, 200, "Company deleted successfully");
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error deleting company: ${errorMessage}`);
    return sendError(c, 500, "Something went wrong while deleting the company");
  } finally {
    session.endSession();
  }
};

export default {
  getCompanies,
  createCompany,
  updateCompany,
  archiveCompany,
  deleteCompany,
  getCompany,
};
