import r2Client from "@/config/s3";
import Candidate from "@/models/Candidate";
import Organization from "@/models/Organization";
import Posting from "@/models/Posting";
import logger from "@/utils/logger";
import { sendError, sendSuccess } from "@/utils/sendResponse";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { AuditLog } from "@shared-types/Organization";
import { Context } from "hono";
import { PDFExtract } from "pdf.js-extract";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppliedPosting from "@/models/AppliedPosting";
import AppliedDrive from "@/models/AppliedDrive";
import DriveModel from "@/models/Drive";
import Institute from "@/models/Institute";
import Drive from "@/models/Drive";
import userDirectory from "@/services/userDirectory";
import PlacementGroup from "@/models/PlacementGroup";
import mongoose from "mongoose";
import getCampusUsersWithPermission from "@/utils/getUserWithPermission";
import { sendNotificationToCampus } from "@/utils/sendNotification";

// Maximum resume file size (5MB)
const MAX_RESUME_SIZE = 5 * 1024 * 1024;
// Allowed resume MIME types
const ALLOWED_RESUME_MIME_TYPES = ["application/pdf"];

/**
 * Validates candidate data
 * @param data The candidate data to validate
 * @returns Validation result with errors if any
 */
const validateCandidate = (data: any) => {
  const errors = [];

  // Required fields
  if (data.name && typeof data.name !== "string") {
    errors.push("Name must be a string");
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Invalid email format");
  }

  if (data.phoneNumber && !/^\+?[0-9]{10,15}$/.test(data.phoneNumber)) {
    errors.push("Invalid phone number format");
  }

  // Education validation if present
  if (data.education && !Array.isArray(data.education)) {
    errors.push("Education must be an array");
  } else if (data.education) {
    data.education.forEach((edu: any, index: number) => {
      if (!edu.degree)
        errors.push(`Education ${index + 1}: Degree is required`);
    });
  }

  // Skills validation if present
  if (data.skills && !Array.isArray(data.skills)) {
    errors.push("Skills must be an array of strings");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Basic input sanitization
 * @param input The input data to sanitize
 * @returns Sanitized data
 */
const sanitizeInput = (input: any): any => {
  // Deep copy the input
  const sanitized = JSON.parse(JSON.stringify(input));

  // Recursive function to sanitize strings in an object
  const sanitizeObject = (obj: any) => {
    if (!obj || typeof obj !== "object") return;

    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "string") {
        // Sanitize string (remove HTML tags, trim)
        obj[key] = obj[key].replace(/<[^>]*>?/gm, "").trim();
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach((item: any) => {
          if (typeof item === "object") sanitizeObject(item);
          if (typeof item === "string")
            item = item.replace(/<[^>]*>?/gm, "").trim();
        });
      } else if (typeof obj[key] === "object") {
        sanitizeObject(obj[key]);
      }
    });
  };

  sanitizeObject(sanitized);
  return sanitized;
};

/**
 * Gets the authenticated candidate's profile
 */
const getCandidate = async (c: Context) => {
  try {
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await Candidate.findOne({ userId: auth._id })
      .populate({
        path: "appliedPostings",
        populate: {
          path: "posting",
          model: "Posting",
          populate: {
            path: "organizationId",
            model: "Organization",
            select: "name logo",
          },
          select: "title description applicationRange status",
        },
      })
      .populate({
        path: "appliedDrives",
        populate: {
          path: "drive",
          model: "Drive",
          select: "title description applicationRange status",
        },
      })
      .populate("userId", "email");

    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }

    // Sanitize sensitive information from response
    const sanitizedCandidate = {
      ...candidate.toObject(),
      resumeExtract: undefined, // Don't expose the full text extraction
    };

    return sendSuccess(
      c,
      200,
      "Candidate profile retrieved",
      sanitizedCandidate
    );
  } catch (error) {
    logger.error(
      `Error in getCandidate: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while retrieving candidate profile"
    );
  }
};

/**
 * Gets a candidate profile by ID (restricted by authorization)
 */
const getCandidateById = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const candidateId = c.req.param("id");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return sendError(c, 400, "Invalid candidate ID format");
    }

    // First check if this is the user's own profile or if they have admin rights
    const requestingCandidate = await Candidate.findOne({ userId: auth._id });
    const isOwnProfile =
      requestingCandidate && requestingCandidate._id.toString() === candidateId;
    const isAdmin = auth.role === "admin";

    // Check if user has organization permission (recruiters can view applied candidates)
    const hasOrgPermission =
      auth.organizationId &&
      (await AppliedPosting.exists({
        user: candidateId,
        posting: {
          $in: await Posting.find({
            organizationId: auth.organizationId,
          }).distinct("_id"),
        },
      }));

    // Check if user has institute permission
    const hasInstitutePermission =
      auth.instituteId &&
      (await AppliedDrive.exists({
        user: candidateId,
        drive: {
          $in: await Drive.find({ institute: auth.instituteId }).distinct(
            "_id"
          ),
        },
      }));

    if (
      !isOwnProfile &&
      !isAdmin &&
      !hasOrgPermission &&
      !hasInstitutePermission
    ) {
      return sendError(
        c,
        403,
        "You don't have permission to view this candidate profile"
      );
    }

    const candidate = await Candidate.findOne({ _id: candidateId })
      .populate({
        path: "appliedPostings",
        populate: {
          path: "posting",
          model: "Posting",
          populate: {
            path: "organizationId",
            model: "Organization",
            select: "name logo",
          },
          select: "title description applicationRange status",
        },
      })
      .populate("userId", "email");

    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    // Determine how much data to expose based on requesting user's role
    const sanitizedCandidate = {
      ...candidate.toObject(),
      // Only include sensitive info for admins or self
      resumeExtract:
        isAdmin || isOwnProfile ? candidate.resumeExtract : undefined,
    };

    return sendSuccess(
      c,
      200,
      "Candidate profile retrieved",
      sanitizedCandidate
    );
  } catch (error) {
    logger.error(
      `Error in getCandidateById: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while retrieving candidate profile"
    );
  }
};

/**
 * Creates a new candidate profile
 */
const createCandidate = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const body = await c.req.json();

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    // Check if candidate already exists
    const existingCandidate = await Candidate.findOne({ userId: auth._id });
    if (existingCandidate) {
      return sendError(c, 409, "Candidate profile already exists");
    }

    // Fetch user data from identity provider
    let accountUser;
    try {
      accountUser = await userDirectory.users.getUser(auth.userId);
    } catch (identityProviderError) {
      logger.error(
        `identity provider API error: ${
          identityProviderError instanceof Error ? identityProviderError.message : String(identityProviderError)
        }`
      );
      return sendError(c, 500, "Unable to verify user information");
    }

    if (!accountUser) {
      return sendError(c, 404, "User not found in authentication provider");
    }

    // Validate and sanitize input
    const sanitizedData = sanitizeInput(body);
    const validationResult = validateCandidate(sanitizedData);
    if (!validationResult.isValid) {
      return sendError(
        c,
        400,
        `Invalid candidate data: ${validationResult.errors.join(", ")}`
      );
    }

    // Create new candidate with sanitized data
    const newCandidate = new Candidate({
      ...sanitizedData,
      name: accountUser.fullName,
      userId: auth._id,
    });

    await newCandidate.save();

    // Don't return the full candidate object with sensitive data
    const sanitizedResponse = {
      _id: newCandidate._id,
      name: newCandidate.name,
      createdAt: newCandidate.createdAt,
    };

    return sendSuccess(
      c,
      201,
      "Candidate profile created successfully",
      sanitizedResponse
    );
  } catch (error) {
    logger.error(
      `Error in createCandidate: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while creating candidate profile"
    );
  }
};

/**
 * Updates candidate profile information
 */
const updateCandidate = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const body = await c.req.json();

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await Candidate.findOne({ userId: auth._id });
    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }

    // Validate and sanitize input
    const sanitizedData = sanitizeInput(body);
    const validationResult = validateCandidate(sanitizedData);
    if (!validationResult.isValid) {
      return sendError(
        c,
        400,
        `Invalid candidate data: ${validationResult.errors.join(", ")}`
      );
    }

    // Prevent overriding critical fields
    delete sanitizedData.userId;
    delete sanitizedData.resumeUrl;
    delete sanitizedData.resumeExtract;
    delete sanitizedData.appliedPostings;
    delete sanitizedData.appliedDrives;

    const updatedCandidate = await Candidate.findOneAndUpdate(
      { userId: auth._id },
      { $set: sanitizedData },
      { new: true, runValidators: true }
    );

    return sendSuccess(
      c,
      200,
      "Candidate profile updated successfully",
      updatedCandidate
    );
  } catch (error) {
    logger.error(
      `Error in updateCandidate: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while updating candidate profile"
    );
  }
};

/**
 * Uploads and processes a candidate's resume
 */
const updateResume = async (c: Context) => {
  try {
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await Candidate.findOne({ userId: auth._id });
    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }

    const formData = await c.req.formData();
    const resume = formData.get("resume") as File | null;

    if (!resume) {
      return sendError(c, 400, "No resume file provided");
    }

    // Validate file size
    if (resume.size > MAX_RESUME_SIZE) {
      return sendError(c, 400, "Resume file exceeds maximum size limit of 5MB");
    }

    // Validate file type
    if (!ALLOWED_RESUME_MIME_TYPES.includes(resume.type)) {
      return sendError(c, 400, "Only PDF files are accepted for resumes");
    }

    // Unique filename based on candidate ID and timestamp to prevent overwriting
    const fileKey = `${candidate._id}_${Date.now()}.pdf`;

    const uploadParams = {
      Bucket: process.env.R2_S3_RESUME_BUCKET!,
      Key: fileKey,
      Body: Buffer.from(await resume.arrayBuffer()),
      ContentType: resume.type,
    };

    try {
      const upload = new Upload({
        client: r2Client,
        params: uploadParams,
      });

      await upload.done();

      // Extract text asynchronously - don't block the response
      extractTextFromResume(resume, candidate._id.toString()).catch((err) =>
        logger.error(`Resume text extraction failed: ${err}`)
      );

      // Build proper S3 URL
      const bucketName = process.env.R2_S3_RESUME_BUCKET!;
      const cdnUrl =
        process.env.R2_CDN_URL ||
        `https://${bucketName}.r2.cloudflarestorage.com`;
      const resumeUrl = `${cdnUrl}/${fileKey}`;

      // Update candidate record with new resume URL
      await Candidate.findByIdAndUpdate(candidate._id, {
        resumeUrl,
        // Track resume history if needed
        $push: {
          resumeHistory: { url: candidate.resumeUrl, replacedAt: new Date() },
        },
      });

      return sendSuccess(c, 200, "Resume uploaded successfully", {
        url: resumeUrl,
      });
    } catch (uploadError) {
      logger.error(
        `S3 upload error: ${
          uploadError instanceof Error
            ? uploadError.message
            : String(uploadError)
        }`
      );
      return sendError(c, 500, "Failed to upload resume");
    }
  } catch (error) {
    logger.error(
      `Error in updateResume: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(c, 500, "An error occurred while updating resume");
  }
};

/**
 * Gets a temporary signed URL for the candidate's resume
 */
const getResume = async (c: Context) => {
  try {
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    // First determine if the user has permission to access this resume
    // If candidateId is provided, check permissions to view that candidate's resume
    const candidateId = c.req.query("candidateId");

    let targetCandidateId;

    if (candidateId) {
      // Validate input
      if (!mongoose.Types.ObjectId.isValid(candidateId)) {
        return sendError(c, 400, "Invalid candidate ID format");
      }

      // Check permissions
      const requestingCandidate = await Candidate.findOne({ userId: auth._id });
      const isOwnResume =
        requestingCandidate &&
        requestingCandidate._id.toString() === candidateId;
      const isAdmin = auth.role === "admin";

      // Check if user has organization permission (recruiters can view applied candidates)
      const hasOrgPermission =
        auth.organizationId &&
        (await AppliedPosting.exists({
          user: candidateId,
          posting: {
            $in: await Posting.find({
              organizationId: auth.organizationId,
            }).distinct("_id"),
          },
        }));

      if (!isOwnResume && !isAdmin && !hasOrgPermission) {
        return sendError(
          c,
          403,
          "You don't have permission to access this resume"
        );
      }

      targetCandidateId = candidateId;
    } else {
      // Get the requesting user's own candidate ID
      const candidate = await Candidate.findOne({ userId: auth._id });
      if (!candidate) {
        return sendError(c, 404, "Candidate profile not found");
      }
      targetCandidateId = candidate._id.toString();
    }

    // Retrieve the candidate to get the resume URL
    const candidate = await Candidate.findById(targetCandidateId);
    if (!candidate || !candidate.resumeUrl) {
      return sendError(c, 404, "Resume not found");
    }

    // Extract key from URL
    const urlParts = candidate.resumeUrl.split("/");
    const fileKey = urlParts[urlParts.length - 1];

    // Generate signed URL with short expiration
    const command = new GetObjectCommand({
      Bucket: process.env.R2_S3_RESUME_BUCKET!,
      Key: fileKey,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 600 });

    return sendSuccess(c, 200, "Resume URL generated", { url });
  } catch (error) {
    logger.error(
      `Error in getResume: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(c, 500, "An error occurred while retrieving resume");
  }
};

/**
 * Apply for a job posting
 */
const apply = async (c: Context) => {
  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { postingId } = await c.req.json();
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    // Validate input
    if (!postingId || !mongoose.Types.ObjectId.isValid(postingId)) {
      return sendError(c, 400, "Invalid posting ID");
    }

    const candidate = await Candidate.findOne({ userId: auth._id });
    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }
    const candId = candidate._id;

    const posting = await Posting.findById(postingId);
    if (!posting) {
      return sendError(c, 404, "Job posting not found");
    }

    // Check if application period is open
    const today = new Date();
    const startDate = posting.applicationRange?.start;
    const endDate = posting.applicationRange?.end;

    if (!startDate || !endDate) {
      return sendError(c, 400, "Job posting has no valid application period");
    }

    if (today < startDate || today > endDate) {
      return sendError(
        c,
        400,
        "Job posting is not open for applications at this time"
      );
    }

    // Check if candidate already applied
    const existingApplication = await AppliedPosting.findOne({
      posting: postingId,
      user: candId,
    });

    if (existingApplication) {
      return sendError(c, 409, "You have already applied to this position");
    }

    // Check if candidate has required resume
    if (!candidate.resumeUrl) {
      return sendError(c, 400, "You must upload a resume before applying");
    }

    // Create application record
    const newApply = await AppliedPosting.create(
      [
        {
          posting: postingId,
          user: candId,
          appliedAt: new Date(),
        },
      ],
      { session }
    );

    // Update posting with new candidate
    await Posting.findByIdAndUpdate(
      postingId,
      { $addToSet: { candidates: candId } },
      { session, new: true }
    );

    // Add audit log to organization
    const auditLog: AuditLog = {
      user: candidate.name || "Candidate",
      userId: candidate._id.toString(),
      action: `Applied for "${posting.title}"`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(
      posting.organizationId,
      { $push: { auditLogs: auditLog } },
      { session }
    );

    // Update candidate with new application
    await Candidate.findByIdAndUpdate(
      candId,
      { $addToSet: { appliedPostings: newApply[0]._id } },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    return sendSuccess(c, 200, "Application submitted successfully");
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    logger.error(
      `Error in apply: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while processing your application"
    );
  } finally {
    session.endSession();
  }
};

/**
 * Apply for a placement drive
 */
const applyToDrive = async (c: Context) => {
  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { driveId } = await c.req.json();
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    // Validate input
    if (!driveId || !mongoose.Types.ObjectId.isValid(driveId)) {
      return sendError(c, 400, "Invalid drive ID");
    }

    const candidate = await Candidate.findOne({ userId: auth._id });
    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }
    const candId = candidate._id;

    const drive = await Drive.findById(driveId);
    if (!drive) {
      return sendError(c, 404, "Placement drive not found");
    }

    // Check if application period is open
    const today = new Date();
    const startDate = drive.applicationRange?.start;
    const endDate = drive.applicationRange?.end;

    if (!startDate || !endDate) {
      return sendError(
        c,
        400,
        "Placement drive has no valid application period"
      );
    }

    if (today < startDate || today > endDate) {
      return sendError(
        c,
        400,
        "Placement drive is not open for applications at this time"
      );
    }

    // Check if candidate already applied
    const existingApplication = await AppliedDrive.findOne({
      drive: driveId,
      user: candId,
    });

    if (existingApplication) {
      return sendError(c, 409, "You have already applied to this drive");
    }

    // Check if candidate has required resume
    if (!candidate.resumeUrl) {
      return sendError(c, 400, "You must upload a resume before applying");
    }

    // Check eligibility through placement groups
    const placementGroups = await PlacementGroup.find({
      candidates: { $in: [candId] },
    });

    if (placementGroups.length === 0) {
      return sendError(
        c,
        400,
        "You are not part of any eligible placement group"
      );
    }

    const allowed = placementGroups
      .map((group) => group._id)
      .some(
        (groupId) => drive.placementGroup?.toString() === groupId.toString()
      );

    if (!allowed) {
      return sendError(c, 403, "You are not eligible for this placement drive");
    }

    // Create application record
    const newApply = await AppliedDrive.create(
      [
        {
          drive: driveId,
          user: candId,
          appliedAt: new Date(),
        },
      ],
      { session }
    );

    // Update drive with new candidate
    await DriveModel.findByIdAndUpdate(
      driveId,
      { $addToSet: { candidates: candId } },
      { session }
    );

    // Add audit log to institute
    const auditLog: AuditLog = {
      user: candidate.name || "Candidate",
      userId: candidate._id.toString(),
      action: `Applied for drive "${drive.title}"`,
      type: "info",
    };

    await Institute.findByIdAndUpdate(
      drive.institute,
      { $push: { auditLogs: auditLog } },
      { session }
    );

    // Update candidate with new application
    await Candidate.findByIdAndUpdate(
      candId,
      { $addToSet: { appliedDrives: newApply[0]._id } },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    const institute = await Institute.findById(drive.institute);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const notifyingUser = await getCampusUsersWithPermission({
      institute: institute,
      permissions: ["manage_drive"],
    });

    if (notifyingUser.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUser,
        title: `New Application for Drive "${drive.title}"`,
        message: `${candidate.name} has applied for the drive "${drive.title}".`,
      });
    }

    return sendSuccess(c, 200, "Application to drive submitted successfully");
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    logger.error(
      `Error in applyToDrive: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while processing your application"
    );
  } finally {
    session.endSession();
  }
};

/**
 * Process and extract text from a resume PDF
 */
const extractTextFromResume = async (
  resume: File,
  candidateId: string
): Promise<string> => {
  try {
    const resumeBuffer = Buffer.from(await resume.arrayBuffer());
    const pdfExtract = new PDFExtract();

    // Convert callback to Promise
    return new Promise((resolve, reject) => {
      pdfExtract.extractBuffer(resumeBuffer, {}, async (err, data) => {
        if (err) {
          logger.error(`PDF extraction error: ${err}`);
          reject(err);
          return;
        }

        if (!data) {
          logger.error("PDF extraction returned no data");
          reject(new Error("Could not extract text from PDF"));
          return;
        }

        let extractedText = "";
        try {
          // Process PDF pages
          for (const page of data.pages) {
            for (const content of page.content) {
              extractedText += content.str + " ";
            }
          }

          // Save extracted text to candidate profile
          await Candidate.findByIdAndUpdate(candidateId, {
            resumeExtract: extractedText.trim(),
          });

          resolve(extractedText);
        } catch (saveErr) {
          logger.error(`Error saving extracted text: ${saveErr}`);
          reject(saveErr);
        }
      });
    });
  } catch (error) {
    logger.error(
      `Error in extractTextFromResume: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
};

/**
 * Gets list of job postings the candidate has applied to
 */
const getAppliedPostings = async (c: Context) => {
  try {
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await Candidate.findOne({ userId: auth._id });
    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }

    const appliedPostings = await AppliedPosting.find({ user: candidate._id })
      .populate({
        path: "posting",
        select: "title description applicationRange status organizationId",
        populate: {
          path: "organizationId",
          select: "name logo",
          model: "Organization",
        },
      })
      .select("createdAt status feedback")
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(c, 200, "Applied postings retrieved", appliedPostings);
  } catch (error) {
    logger.error(
      `Error in getAppliedPostings: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while retrieving applied postings"
    );
  }
};

/**
 * Gets list of placement drives the candidate has applied to
 */
const getAppliedDrives = async (c: Context) => {
  try {
    const auth = c.get("auth");

    if (!auth || !auth._id) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await Candidate.findOne({ userId: auth._id });
    if (!candidate) {
      return sendError(c, 404, "Candidate profile not found");
    }

    const appliedDrives = await AppliedDrive.find({ user: candidate._id })
      .populate({
        path: "drive",
        select: "title description applicationRange status institute",
        populate: {
          path: "institute",
          select: "name logo",
          model: "Institute",
        },
      })
      .select("createdAt status feedback")
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(c, 200, "Applied drives retrieved", appliedDrives);
  } catch (error) {
    logger.error(
      `Error in getAppliedDrives: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return sendError(
      c,
      500,
      "An error occurred while retrieving applied drives"
    );
  }
};

export default {
  getCandidate,
  createCandidate,
  updateResume,
  updateCandidate,
  apply,
  getResume,
  getAppliedPostings,
  getCandidateById,
  applyToDrive,
  getAppliedDrives,
};
