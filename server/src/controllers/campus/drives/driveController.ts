import Drive from "../../../models/Drive";
import checkPermission from "../../../middlewares/checkInstitutePermission";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import logger from "../../../utils/logger";
import { Context } from "hono";
import Institute from "@/models/Institute";
import mongoose from "mongoose";
import userDirectory from "@/services/userDirectory";
import { AuditLog } from "@shared-types/Institute";
import AssignmentSubmission from "@/models/AssignmentSubmission";
import { Upload } from "@aws-sdk/lib-storage";
import r2Client from "@/config/s3";
import loops from "@/config/loops";
import Candidate from "@/models/Candidate";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppliedDrive from "@/models/AppliedDrive";
import {
  sendNotificationToCampus,
  sendNotificationToCandidate,
} from "@/utils/sendNotification";
import PlacementGroup from "@/models/PlacementGroup";
import { Institute as IInstitute } from "@shared-types/Institute";
import { Candidate as ICandidate } from "@shared-types/Candidate";
import { Company as ICompany } from "@shared-types/Company";
import crypto from "crypto";
import { z } from "zod";
import getCampusUsersWithPermission from "@/utils/getUserWithPermission";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".zip"]);

const ObjectIdSchema = z
  .string()
  .refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "Invalid ObjectId format",
  });

const validateObjectId = (id: string): boolean => {
  try {
    return ObjectIdSchema.parse(id) ? true : false;
  } catch (error) {
    return false;
  }
};

const validateFileUpload = (
  file: File | null
): { valid: boolean; message?: string } => {
  if (!file) {
    return { valid: false, message: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `File size exceeds maximum limit of ${
        MAX_FILE_SIZE / (1024 * 1024)
      }MB`,
    };
  }

  const fileName = file.name || "";
  const fileExt = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(fileExt)) {
    return { valid: false, message: "File type not allowed" };
  }

  return { valid: true };
};

const generateSecureUrlSlug = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

const createAuditLog = async (
  c: Context,
  instituteId: mongoose.Types.ObjectId,
  action: string
): Promise<void> => {
  try {
    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: `${accountUser.firstName || ""} ${accountUser.lastName || ""}`.trim(),
      userId: accountUser.id,
      action,
      type: "info",
    };

    await Institute.findByIdAndUpdate(instituteId, {
      $push: { auditLogs: auditLog },
    });
  } catch (error) {
    logger.warn(`Failed to create audit log: ${error}`);
  }
};

// const processBatch = async <T, R>(
//   items: T[],
//   batchSize: number,
//   processFn: (batch: T[]) => Promise<R[]>
// ): Promise<R[]> => {
//   const results: R[] = [];

//   for (let i = 0; i < items.length; i += batchSize) {
//     const batch = items.slice(i, i + batchSize);
//     const batchResults = await processFn(batch);
//     results.push(...batchResults);
//   }

//   return results;
// };

const getDrives = async (c: Context) => {
  try {
    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    const skip = (page - 1) * limit;

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return sendError(c, 400, "Invalid pagination parameters");
    }

    const totalDrives = await Drive.countDocuments({
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    const drives = await Drive.find({
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    })
      .select(
        "title url published publishedOn company applicationRange hasEnded"
      )
      .populate("company", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const institute = await Institute.findById(
      perms.data?.institute?._id
    ).select("departments");

    return sendSuccess(c, 200, "Drives fetched successfully", {
      drives,
      departments: institute?.departments || [],
      pagination: {
        total: totalDrives,
        page,
        pages: Math.ceil(totalDrives / limit),
        limit,
      },
    });
  } catch (e: any) {
    logger.error(`Error in getDrives: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getDrive = async (c: Context) => {
  try {
    const driveId = c.req.param("id");

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    })
      .populate("mcqAssessments.assessmentId")
      .populate("codeAssessments.assessmentId")
      .populate("candidates")
      .populate({
        path: "candidates",
        populate: {
          path: "appliedDrives",
          model: "AppliedDrive",
        },
      })
      .populate("institute", "name departments")
      .populate("company", "name")
      .populate({
        path: "assignments.submissions",
        select: "-textSubmission",
      })
      .populate("interviews.interview")
      .populate("hiredCandidates")
      .populate("placementGroup", "name");

    if (!drive) {
      return sendError(c, 404, "Drive not found");
    }

    return sendSuccess(c, 200, "Drive fetched successfully", drive);
  } catch (e: any) {
    logger.error(`Error in getDrive: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getDriveBySlug = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    if (!slug || slug.length < 8) {
      return sendError(c, 400, "Invalid drive URL");
    }

    const authData = c.get("auth");
    const userId = authData?._id;

    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    const drive = await Drive.findOne({ url: slug })
      .select("-ats.negativePrompts -ats.positivePrompts")
      .populate("mcqAssessments.assessmentId", "title")
      .populate("codeAssessments.assessmentId", "title")
      .populate("candidates", "name email")
      .populate("institute", "name")
      .populate({
        path: "assignments.submissions",
        match: { candidateId: userId },
        select: "_id submittedAt grade",
      });

    if (!drive) {
      return sendError(c, 404, "Drive not found");
    }

    const instituteUser = await Institute.findOne({
      _id: drive.institute?._id,
      "members.userId": userId,
    });

    const isCandidate = await Candidate.exists({
      userId,
      institute: drive.institute?._id,
    });

    if (!instituteUser && !isCandidate) {
      return sendError(c, 403, "You don't have permission to view this drive");
    }

    return sendSuccess(c, 200, "Drive fetched successfully", drive);
  } catch (e: any) {
    logger.error(`Error in getDriveBySlug: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const createDrive = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const drive = await c.req.json();

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      logger.warn("Unauthorized access attempt to create drive");
      return sendError(c, 401, "Unauthorized");
    }

    if (!drive.placementGroup || !validateObjectId(drive.placementGroup)) {
      return sendError(c, 400, "Valid placement group ID is required");
    }

    if (
      !drive.title ||
      typeof drive.title !== "string" ||
      drive.title.length < 3
    ) {
      return sendError(
        c,
        400,
        "Valid title is required (minimum 3 characters)"
      );
    }

    if (drive.additionalDetails) {
      try {
        Object.entries(drive.additionalDetails).forEach(
          ([category, fields]) => {
            Object.entries(fields as { [key: string]: any }).forEach(
              ([field, config]: [string, any]) => {
                if (
                  typeof config.required !== "boolean" ||
                  typeof config.allowEmpty !== "boolean"
                ) {
                  throw new Error(
                    `Invalid configuration for ${category}.${field}`
                  );
                }
              }
            );
          }
        );
      } catch (error) {
        return sendError(
          c,
          400,
          `Invalid additionalDetails structure: ${error}`
        );
      }
    }

    const placementGroup = await PlacementGroup.findById(drive.placementGroup);
    if (!placementGroup) {
      return sendError(c, 404, "Placement group not found");
    }

    const newDrive = new Drive({
      ...drive,
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    await newDrive.save();

    await Institute.findByIdAndUpdate(
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      {
        $push: { drives: newDrive._id },
      }
    );

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(
        new mongoose.Types.ObjectId(perms.data?.institute?._id)
      ),
      `Created New Drive: ${drive.title}`
    );

    const institute = await Institute.findById(perms.data?.institute?._id);

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const notifyingUsers = await getCampusUsersWithPermission({
      institute: institute!,
      permissions: ["manage_drive"],
    });

    console.log("Notifying users:", notifyingUsers);

    if (notifyingUsers.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUsers,
        title: "New Drive Created",
        message: `A new drive has been created for the position ${drive.title} at ${drive.company?.name}.`,
      });
    }

    return sendSuccess(c, 201, "Drive created successfully", newDrive);
  } catch (e: any) {
    logger.error(`Error creating drive: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const createWorkflow = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { formattedData, _id } = await c.req.json();

    if (!formattedData || !_id || !validateObjectId(_id)) {
      return sendError(c, 400, "Invalid request parameters");
    }

    if (!Array.isArray(formattedData.steps)) {
      return sendError(c, 400, "Invalid workflow format");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(_id),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    drive.workflow = formattedData;
    await drive.save();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Created New Workflow for Drive: ${drive.title}`
    );

    return sendSuccess(c, 201, "Workflow created successfully", drive);
  } catch (e: any) {
    logger.error(`Error in createWorkflow: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const updateAts = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { minimumScore, negativePrompts, positivePrompts, _id } =
      await c.req.json();

    if (!validateObjectId(_id)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    if (
      typeof minimumScore !== "number" ||
      minimumScore < 0 ||
      minimumScore > 100
    ) {
      return sendError(
        c,
        400,
        "Minimum score must be a number between 0 and 100"
      );
    }

    if (!Array.isArray(positivePrompts) || !Array.isArray(negativePrompts)) {
      return sendError(c, 400, "Prompts must be arrays");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(_id),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    if (!drive.ats) {
      drive.ats = {
        _id: new mongoose.Types.ObjectId(),
        minimumScore,
        negativePrompts,
        positivePrompts,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      drive.ats.minimumScore = minimumScore;
      drive.ats.negativePrompts = negativePrompts;
      drive.ats.positivePrompts = positivePrompts;
      drive.ats.updatedAt = new Date();
    }

    if (!drive.workflow) {
      return sendError(c, 400, "Workflow not found, create workflow first");
    }

    const atsStepIndex = drive.workflow.steps.findIndex(
      (step) => step.type === "RESUME_SCREENING"
    );
    if (atsStepIndex >= 0 && drive.ats && drive.ats._id) {
      drive.workflow.steps[atsStepIndex]._id = new mongoose.Types.ObjectId(
        drive.ats._id.toString()
      );
    }

    await drive.save();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Updated ATS for Drive: ${drive.title}`
    );

    const sanitizedDrive = JSON.parse(JSON.stringify(drive.toObject()));
    if (sanitizedDrive.ats) {
      sanitizedDrive.ats.positivePrompts = [];
      sanitizedDrive.ats.negativePrompts = [];
    }

    return sendSuccess(c, 200, "ATS updated successfully", sanitizedDrive);
  } catch (e: any) {
    logger.error(`Error in updateAts: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const updateAssignment = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { name, description, driveId, step, submissionType } =
      await c.req.json();

    if (
      !name ||
      typeof name !== "string" ||
      !description ||
      typeof description !== "string"
    ) {
      return sendError(c, 400, "Name and description are required");
    }

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    if (typeof step !== "number" || step < 0) {
      return sendError(c, 400, "Invalid step index");
    }

    if (!submissionType || !["text", "file", "link"].includes(submissionType)) {
      return sendError(
        c,
        400,
        "Valid submissionType required (text, file, or link)"
      );
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    if (!drive.workflow) {
      return sendError(c, 400, "Workflow not found, create workflow first");
    }

    if (!drive.workflow.steps || step >= drive.workflow.steps.length) {
      return sendError(c, 400, "Invalid workflow step");
    }

    const _id = new mongoose.Types.ObjectId();
    const workflowId = drive.workflow.steps[step]._id;

    drive.assignments.push({
      _id,
      name,
      description,
      workflowId,
      submissionType,
    });

    await drive.save();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Created New Assignment "${name}" for Drive: ${drive.title}`
    );

    return sendSuccess(c, 201, "Assignment created successfully", drive);
  } catch (e: any) {
    logger.error(`Error in updateAssignment: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const updateInterview = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { driveId, step } = await c.req.json();

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    if (typeof step !== "number" || step < 0) {
      return sendError(c, 400, "Invalid step index");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    if (!drive.workflow) {
      return sendError(c, 400, "Workflow not found, create workflow first");
    }

    if (!drive.workflow.steps || step >= drive.workflow.steps.length) {
      return sendError(c, 400, "Invalid workflow step");
    }

    const _id = new mongoose.Types.ObjectId();

    if (drive.workflow.steps[step]) {
      const workflowStep = drive.workflow.steps[step];
      workflowStep._id = _id;
    } else {
      return sendError(c, 400, "Invalid step index");
    }

    await drive.save();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Created New Interview for Drive: ${drive.title}`
    );

    return sendSuccess(c, 201, "Interview created successfully", drive);
  } catch (e: any) {
    logger.error(`Error in updateInterview: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const publishDrive = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { id } = await c.req.json();

    if (!validateObjectId(id)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(id),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    })
      .populate<{ institute: IInstitute }>("institute", "name")
      .populate<{ company: ICompany }>("company", "name");

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    if (
      !drive.workflow ||
      !drive.workflow.steps ||
      drive.workflow.steps.length === 0
    ) {
      return sendError(c, 400, "Cannot publish drive without workflow");
    }

    const placementGroup = await PlacementGroup.findById(
      drive.placementGroup
    ).populate<{ candidates: ICandidate[] }>("candidates");

    if (!placementGroup) {
      return sendError(c, 404, "Placement group not found");
    }

    if (!placementGroup.candidates || placementGroup.candidates.length === 0) {
      return sendError(
        c,
        400,
        "Cannot publish drive with empty placement group"
      );
    }

    drive.published = true;
    drive.publishedOn = new Date();

    let urlSlug;
    let isUnique = false;

    while (!isUnique) {
      urlSlug = generateSecureUrlSlug();

      const existingDrive = await Drive.findOne({ url: urlSlug });
      isUnique = !existingDrive;
    }

    drive.url = urlSlug;
    await drive.save();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Published Drive: ${drive.title}`
    );

    if (!drive.applicationRange || !drive.applicationRange.end) {
      return sendError(c, 400, "Application deadline is required");
    }

    // const deadline = new Date(drive.applicationRange.end).toDateString();

    // const BATCH_SIZE = 10;
    // const candidateEmails = placementGroup.candidates.filter((c) => c.email);

    // await processBatch(candidateEmails, BATCH_SIZE, async (batch) => {
    //   const promises = batch.map((candidate) =>
    //     loops.sendTransactionalEmail({
    //       transactionalId: "cm9feh6fq4cyu12lzhwg5a3vy",
    //       email: candidate?.email || "",
    //       dataVariables: {
    //         candidateName: candidate?.name || "Candidate",
    //         drivePosition: drive.title,
    //         company: drive.company?.name || "the company",
    //         driveDeadline: deadline,
    //         driveLink: `${process.env.CAMPUS_FRONTEND_URL}/campus/drives/${drive?._id}`,
    //         institute: drive?.institute?.name || "your institute",
    //       },
    //     })
    //   );

    //   return Promise.all(promises);
    // });

    if (placementGroup.candidates.length > 0) {
      const candidateIds = placementGroup.candidates.map((c) =>
        c._id?.toString()
      );

      const candidates = await Candidate.find({
        _id: { $in: candidateIds },
      });

      await sendNotificationToCandidate({
        candidateIds: candidates.map((c) => c.userId?.toString()),
        title: "New Drive Added",
        message: `A new drive has been created for the position ${
          drive.title
        } at ${
          drive.company?.name || "a company"
        }. Please check your campus drives dashboard for more details.`,
      });
    }

    const institute = await Institute.findById(perms.data?.institute?._id);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const notifyingUsers = await getCampusUsersWithPermission({
      institute: institute,
      permissions: ["manage_drive"],
    });

    if (notifyingUsers.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUsers,
        title: "New Drive Published",
        message: `A new drive has been published for the position ${drive.title} at ${drive.company?.name}.`,
      });
    }

    return sendSuccess(c, 200, "Drive published successfully", drive);
  } catch (e: any) {
    logger.error(`Error in publishDrive: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const deleteDrive = async (c: Context) => {
  try {
    const driveId = c.req.param("id");

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    }).populate<{ company: ICompany }>("company", "name");

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Deleted Drive: ${drive.title}`
    );

    await Institute.findByIdAndUpdate(
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      {
        $pull: { drives: drive._id },
      }
    );

    await Drive.findByIdAndDelete(driveId);

    await AssignmentSubmission.deleteMany({
      driveId: new mongoose.Types.ObjectId(driveId),
    });
    await AppliedDrive.deleteMany({
      drive: new mongoose.Types.ObjectId(driveId),
    });

    const institute = await Institute.findById(perms.data?.institute?._id);

    const notifyingUsers = await getCampusUsersWithPermission({
      institute: institute,
      permissions: ["manage_drive"],
    });

    if (notifyingUsers.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUsers,
        title: "Drive Deleted",
        message: `The drive for the position ${drive.title} at ${drive.company?.name} has been deleted.`,
      });
    }

    return sendSuccess(c, 200, "Drive deleted successfully");
  } catch (e: any) {
    logger.error(`Error in deleteDrive: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getAssignment = async (c: Context) => {
  try {
    const { id, aid } = c.req.param();

    if (!validateObjectId(id) || !validateObjectId(aid)) {
      return sendError(c, 400, "Invalid ID format");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);

    let drive;

    if (perms.allowed) {
      drive = await Drive.findOne({
        _id: new mongoose.Types.ObjectId(id),
        institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
      });
    } else {
      const authData = c.get("auth");
      const userId = authData?._id;

      if (!userId) {
        return sendError(c, 401, "Authentication required");
      }

      const candidate = await Candidate.findOne({ userId });

      if (!candidate) {
        return sendError(c, 404, "Candidate not found");
      }

      drive = await Drive.findOne({
        _id: new mongoose.Types.ObjectId(id),
        institute: candidate.institute,
        published: true,
      });
    }

    if (!drive) {
      return sendError(c, 404, "Drive not found or access denied");
    }

    const assignment = drive.assignments.find((a) => a._id?.toString() === aid);
    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    return sendSuccess(c, 200, "Assignment fetched successfully", assignment);
  } catch (e: any) {
    logger.error(`Error in getAssignment: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const saveAssignmentSubmission = async (c: Context) => {
  try {
    const { id, aid } = c.req.param();

    if (!validateObjectId(id) || !validateObjectId(aid)) {
      return sendError(c, 400, "Invalid ID format");
    }

    const authData = c.get("auth");
    const userId = authData?._id;
    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    const user = await Candidate.findOne({ userId });
    if (!user) {
      return sendError(c, 404, "User not found");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(id),
      published: true,
      institute: user.institute,
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or not published");
    }

    const assignment = drive.assignments.find((a) => a._id?.toString() === aid);
    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    const driveStep = drive.workflow?.steps.find(
      (step) => step._id?.toString() === assignment.workflowId?.toString()
    );

    if (!driveStep || driveStep.status !== "in-progress") {
      return sendError(
        c,
        400,
        "Submission deadline has passed or step not active"
      );
    }

    const existingSubmission = await AssignmentSubmission.findOne({
      assignmentId: assignment._id,
      candidateId: userId,
    });

    if (existingSubmission) {
      return sendError(c, 409, "You have already submitted this assignment");
    }

    let textSubmission, linkSubmission;

    if (assignment.submissionType === "file") {
      if (!c.req.header("content-type")?.includes("multipart/form-data")) {
        return sendError(c, 415, "File upload requires multipart/form-data");
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;

      const fileValidation = validateFileUpload(file);
      if (!fileValidation.valid) {
        return sendError(c, 400, fileValidation.message || "Invalid file");
      }

      try {
        const fileKey = `${aid}/${userId}_${Date.now()}.zip`;

        const uploadParams = {
          Bucket: process.env.R2_S3_ASSIGNMENT_BUCKET!,
          Key: fileKey,
          Body: file as any,
          ContentType: file?.type || "application/zip",
        };

        const upload = new Upload({
          client: r2Client,
          params: uploadParams,
        });

        await upload.done();
      } catch (uploadError) {
        logger.error(`File upload failed: ${uploadError}`);
        return sendError(c, 500, "Failed to upload file");
      }
    } else if (
      assignment.submissionType === "text" ||
      assignment.submissionType === "link"
    ) {
      if (!c.req.header("content-type")?.includes("application/json")) {
        return sendError(c, 415, "Text/link submissions require JSON");
      }

      const body = await c.req.json();

      if (assignment.submissionType === "text") {
        if (!body.textSubmission || typeof body.textSubmission !== "string") {
          return sendError(c, 400, "Text submission is required");
        }
        textSubmission = body.textSubmission;
      } else {
        if (
          !body.linkSubmission ||
          typeof body.linkSubmission !== "string" ||
          !body.linkSubmission.match(/^https?:\/\/.+/)
        ) {
          return sendError(c, 400, "Valid URL submission is required");
        }
        linkSubmission = body.linkSubmission;
      }
    }

    const submission = new AssignmentSubmission({
      driveId: drive._id,
      candidateId: userId,
      textSubmission,
      linkSubmission,
      submittedAt: new Date(),
    });

    assignment.submissions.push(submission._id);

    try {
      await loops.sendTransactionalEmail({
        transactionalId: "cm13tu50l02mc80gpi76joqvy",
        email: user.email as string,
        dataVariables: {
          institute: drive?.institute?.toString() || "the institute",
          assignmentName: assignment.name || "the assignment",
          driveName: drive.title || "the drive",
        },
      });
    } catch (emailError) {
      logger.warn(`Failed to send confirmation email: ${emailError}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await submission.save({ session });
      await drive.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return sendSuccess(c, 201, "Submission saved successfully", {
      submissionId: submission._id,
      submittedAt: submission.createdAt,
    });
  } catch (e: any) {
    logger.error(`Error in saveAssignmentSubmission: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const gradeAssignment = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { id, aid } = c.req.param();
    const { grade, cid } = await c.req.json();

    if (
      !validateObjectId(id) ||
      !validateObjectId(aid) ||
      !validateObjectId(cid)
    ) {
      return sendError(c, 400, "Invalid ID format");
    }

    if (typeof grade !== "number" || grade < 0 || grade > 100) {
      return sendError(c, 400, "Grade must be a number between 0 and 100");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(id),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    const assignment = drive.assignments.find((a) => a._id?.toString() === aid);
    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    const submission = await AssignmentSubmission.findOne({
      assignmentId: assignment._id,
      candidateId: new mongoose.Types.ObjectId(cid),
    });

    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    submission.grade = grade;
    await submission.save();

    await createAuditLog(
      c,
      new mongoose.Types.ObjectId(perms.data?.institute?._id),
      `Graded assignment submission for Drive: ${drive.title}`
    );

    return sendSuccess(c, 200, "Grade saved successfully", {
      submissionId: submission._id,
      grade: grade,
    });
  } catch (e: any) {
    logger.error(`Error in gradeAssignment: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getAssignmentSubmission = async (c: Context) => {
  try {
    const { id, aid, sid } = c.req.param();

    if (!validateObjectId(id) || !validateObjectId(aid) || !sid) {
      return sendError(c, 400, "Invalid parameters");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(id),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    const assignment = drive.assignments.find((a) => a._id?.toString() === aid);
    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(sid)) {
        return sendError(c, 400, "Invalid submission ID format");
      }

      const command = new GetObjectCommand({
        Bucket: process.env.R2_S3_ASSIGNMENT_BUCKET!,
        Key: `${aid}/${sid}.zip`,
      });

      const url = await getSignedUrl(r2Client, command, { expiresIn: 300 });

      return sendSuccess(c, 200, "File URL generated", { url });
    } catch (e) {
      logger.error(`Failed to generate signed URL: ${e}`);
      return sendError(c, 500, "Failed to generate file access URL");
    }
  } catch (e: any) {
    logger.error(`Error in getAssignmentSubmission: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getAppliedDrives = async (c: Context) => {
  try {
    const driveId = c.req.param("id");

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    const skip = (page - 1) * limit;

    const totalApplications = await AppliedDrive.countDocuments({
      drive: new mongoose.Types.ObjectId(driveId),
    });

    const appliedDrives = await AppliedDrive.find({
      drive: new mongoose.Types.ObjectId(driveId),
    })
      .populate({
        path: "drive",
        select: "title company",
      })
      .populate({
        path: "user",
        select: "name email profileImage",
      })
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendSuccess(c, 200, "Applied drives fetched successfully", {
      applications: appliedDrives,
      pagination: {
        total: totalApplications,
        page,
        pages: Math.ceil(totalApplications / limit),
        limit,
      },
    });
  } catch (e: any) {
    logger.error(`Error in getAppliedDrives: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getCandidatesForDrive = async (c: Context) => {
  try {
    const driveId = c.req.param("id");

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const perms = await checkPermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    // Fetch drive with populated candidates
    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    })
      .populate(
        "candidates",
        "name email department phone instituteUid resumeUrl status"
      )
      .lean();

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    if (!drive.candidates || !Array.isArray(drive.candidates)) {
      return sendError(c, 404, "No candidates found for this drive");
    }

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "10", 10), 200);
    // const skip = (page - 1) * limit;

    // Get search query parameter
    const searchQuery = c.req.query("search");

    // Filter candidates based on search query
    let filteredCandidates = drive.candidates;

    if (searchQuery && searchQuery.trim()) {
      const searchRegex = new RegExp(searchQuery, "i");
      filteredCandidates = filteredCandidates.filter((candidate: any) => {
        return (
          searchRegex.test(candidate.name) ||
          searchRegex.test(candidate.email) ||
          searchRegex.test(candidate.instituteUid) ||
          searchRegex.test(candidate.phone) ||
          searchRegex.test(candidate.department)
        );
      });
    }

    // Apply pagination
    const total = filteredCandidates.length;
    const paginatedCandidates = filteredCandidates;

    const candidates = [];

    for (const candidate of paginatedCandidates) {
      const appliedPosting = await AppliedDrive.findOne({
        user: candidate._id,
        drive: new mongoose.Types.ObjectId(driveId),
      });

      if (appliedPosting) {
        candidates.push({
          ...candidate,
          appliedPostingId: appliedPosting._id,
          status: appliedPosting.status,
        });
      }
    }

    const lastUpdated = new Date().toISOString();
    const updatedBy = c.get("user")?.login || "system";

    return sendSuccess(c, 200, "Candidates fetched successfully", {
      candidates,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
      meta: {
        lastUpdated,
        updatedBy,
      },
    });
  } catch (e: any) {
    logger.error(`Error in getCandidatesForDrive: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const endDrive = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("application/json")) {
      return sendError(c, 415, "Unsupported Media Type: Expecting JSON");
    }

    const { driveId } = await c.req.json();

    if (!validateObjectId(driveId)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(driveId),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    })
      .populate<{ institute: IInstitute }>("institute", "name")
      .populate<{ company: ICompany }>("company", "name");

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    if (drive.hasEnded) {
      return sendError(c, 400, "Drive has already ended");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      drive.hasEnded = true;

      if (drive.workflow?.steps) {
        drive.workflow.steps.forEach((step) => {
          step.status = "completed";
        });
      }

      const appliedDrives = await AppliedDrive.find({
        drive: new mongoose.Types.ObjectId(driveId),
        status: { $in: ["applied", "inprogress", "hired"] },
      }).session(session);

      const candidateIds = appliedDrives.map((applied) =>
        applied.user.toString()
      );

      if (appliedDrives.length > 0) {
        await Promise.all(
          appliedDrives.map(async (applied) => {
            applied.status = "hired";
            drive.hiredCandidates.push(applied.user);
            return applied.save({ session });
          })
        );
      }

      await drive.save({ session });

      await session.commitTransaction();

      if (candidateIds.length > 0) {
        const candidates = await Candidate.find({
          _id: {
            $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        });

        // await processBatch(candidates, 10, async (batch) => {
        //   return Promise.all(
        //     batch.map((candidate) =>
        //       loops.sendTransactionalEmail({
        //         transactionalId: "cm9fqj8tg4yitq1s5hbgx3cux",
        //         email: candidate?.email || "",
        //         dataVariables: {
        //           candidateName: candidate?.name || "Candidate",
        //           company: drive.company?.name || "the company",
        //           drivePosition: drive.title || "the position",
        //           uploadUrl: `${process.env.CAMPUS_FRONTEND_URL}/campus/drives/${drive?._id}`,
        //           institute: drive?.institute?.name || "your institute",
        //         },
        //       })
        //     )
        //   );
        // });

        await sendNotificationToCandidate({
          candidateIds: candidates.map((c) => c.userId?.toString()),
          title: "Upload Offer Letter",
          message: `Congratulations for being selected as ${drive.title} at ${
            drive.company?.name || "the company"
          }. Please upload your offer letter as soon as possible via the drive dashboard.`,
        });
      }

      await createAuditLog(
        c,
        new mongoose.Types.ObjectId(perms.data?.institute?._id),
        `Ended Drive: ${drive.title} with ${drive.hiredCandidates.length} hired candidates`
      );

      const institute = await Institute.findById(perms.data?.institute?._id);
      if (!institute) {
        return sendError(c, 404, "Institute not found");
      }

      const notifyingUsers = await getCampusUsersWithPermission({
        institute: institute,
        permissions: ["manage_drive"],
      });

      if (notifyingUsers.length > 0) {
        await sendNotificationToCampus({
          userIds: notifyingUsers,
          title: "Drive Ended",
          message: `The drive for the position ${drive.title} at ${drive.company?.name} has ended.`,
        });
      }

      return sendSuccess(c, 200, "Drive ended successfully", {
        driveId: drive._id,
        hiredCount: drive.hiredCandidates.length,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (e: any) {
    logger.error(`Error in endDrive: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const uploadOfferLetter = async (c: Context) => {
  try {
    if (!c.req.header("content-type")?.includes("multipart/form-data")) {
      return sendError(
        c,
        415,
        "Unsupported Media Type: Expecting multipart/form-data"
      );
    }

    const authData = c.get("auth");
    const userId = authData?._id;
    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const id = formData.get("driveId")?.toString();
    const ctc = formData.get("ctc")?.toString();

    if (!file || !id || !ctc) {
      return sendError(c, 400, "Missing required fields (file, driveId, ctc)");
    }

    if (!validateObjectId(id)) {
      return sendError(c, 400, "Invalid drive ID format");
    }

    const ctcNumber = Number(ctc);
    if (isNaN(ctcNumber) || ctcNumber <= 0) {
      return sendError(c, 400, "CTC must be a positive number");
    }

    const fileValidation = validateFileUpload(file);
    if (!fileValidation.valid) {
      return sendError(c, 400, fileValidation.message || "Invalid file");
    }

    const candidate = await Candidate.findOne({ userId });
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const drive = await Drive.findById(id);
    if (!drive) {
      return sendError(c, 404, "Drive not found");
    }

    if (!drive.hasEnded) {
      return sendError(c, 400, "Drive has not ended yet");
    }

    const appliedDrive = await AppliedDrive.findOne({
      user: candidate._id,
      drive: new mongoose.Types.ObjectId(id),
    });

    if (!appliedDrive) {
      return sendError(c, 404, "You haven't applied to this drive");
    }

    if (appliedDrive.status !== "hired") {
      return sendError(
        c,
        400,
        "Only hired candidates can upload offer letters"
      );
    }

    appliedDrive.salary = ctcNumber;

    const fileKey = `${id}/${candidate._id}_${Date.now()}`;

    try {
      const uploadParams = {
        Bucket: process.env.R2_S3_OFFERLETTER_BUCKET!,
        Key: fileKey,
        Body: file as any,
        ContentType: file.type || "application/pdf",
      };

      const upload = new Upload({
        client: r2Client,
        params: uploadParams,
      });

      await upload.done();
    } catch (uploadError) {
      logger.error(`File upload failed: ${uploadError}`);
      return sendError(c, 500, "Failed to upload offer letter");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!drive.offerLetters) {
        drive.offerLetters = [candidate._id];
      } else if (!drive.offerLetters.includes(candidate._id)) {
        drive.offerLetters.push(candidate._id);
      }

      appliedDrive.offerLetterKey = fileKey;
      appliedDrive.offerLetterUploadedAt = new Date();

      await drive.save({ session });
      await appliedDrive.save({ session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return sendSuccess(c, 200, "Offer letter uploaded successfully", {
      uploadedAt: appliedDrive.offerLetterUploadedAt,
    });
  } catch (e: any) {
    logger.error(`Error in uploadOfferLetter: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

const getOfferLetter = async (c: Context) => {
  try {
    const { did, id } = c.req.param();

    if (!validateObjectId(did) || !validateObjectId(id)) {
      return sendError(c, 400, "Invalid ID format");
    }

    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findOne({
      _id: new mongoose.Types.ObjectId(did),
      institute: new mongoose.Types.ObjectId(perms.data?.institute?._id),
    });

    if (!drive) {
      return sendError(c, 404, "Drive not found or you don't have permission");
    }

    const candidate = await Candidate.findOne({ _id: id });
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    if (!drive.offerLetters?.includes(candidate._id)) {
      return sendError(
        c,
        404,
        "Candidate has not uploaded an offer letter yet"
      );
    }

    const appliedDrive = await AppliedDrive.findOne({
      drive: new mongoose.Types.ObjectId(did),
      user: new mongoose.Types.ObjectId(id),
    });

    if (
      !appliedDrive ||
      (!appliedDrive.offerLetterKey && !candidate.isSample)
    ) {
      return sendError(c, 404, "Offer letter record not found");
    }

    try {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_S3_OFFERLETTER_BUCKET!,
        Key: appliedDrive.offerLetterKey || "",
      });

      const url = candidate?.isSample
        ? "https://www.peoplebox.ai//wp-content/uploads/2024/09/Job-offer-letter-sample.webp"
        : await getSignedUrl(r2Client, command, { expiresIn: 300 });

      return sendSuccess(c, 200, "File URL generated", {
        url,
        uploadedAt: appliedDrive.offerLetterUploadedAt,
        salary: appliedDrive.salary,
      });
    } catch (e) {
      logger.error(`Failed to generate signed URL: ${e}`);
      return sendError(c, 500, "Failed to generate file access URL");
    }
  } catch (e: any) {
    logger.error(`Error in getOfferLetter: ${e.message}`);
    return sendError(c, 500, "Internal server error");
  }
};

export default {
  getDrives,
  getDrive,
  createDrive,
  createWorkflow,
  updateAts,
  updateAssignment,
  updateInterview,
  publishDrive,
  deleteDrive,
  getDriveBySlug,
  getAssignment,
  saveAssignmentSubmission,
  gradeAssignment,
  getAssignmentSubmission,
  getAppliedDrives,
  getCandidatesForDrive,
  endDrive,
  uploadOfferLetter,
  getOfferLetter,
};
