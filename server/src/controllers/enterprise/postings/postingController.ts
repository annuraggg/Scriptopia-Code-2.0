import Posting from "../../../models/Posting";
import checkPermission from "../../../middlewares/checkOrganizationPermission";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import logger from "../../../utils/logger";
import { Context } from "hono";
import Organization from "@/models/Organization";
import mongoose from "mongoose";
import userDirectory from "@/services/userDirectory";
import { AuditLog } from "@shared-types/Organization";
import Meet from "@/models/Meet";
import AssignmentSubmission from "@/models/AssignmentSubmission";
import { Upload } from "@aws-sdk/lib-storage";
import r2Client from "@/config/s3";
import loops from "@/config/loops";
import Candidate from "@/models/Candidate";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppliedPosting from "@/models/AppliedPosting";

const getPostings = async (c: Context) => {
  try {
    const perms = await checkPermission.all(c, ["view_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.find({
      organizationId: perms.data?.organization?._id,
    });

    const organization = await Organization.findById(
      perms.data?.organization?._id
    );

    return sendSuccess(c, 200, "Posting fetched successfully", {
      postings: posting,
      departments: organization?.departments,
    });
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const getPosting = async (c: Context) => {
  try {
    const perms = await checkPermission.all(c, ["view_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(c.req.param("id"))
      .populate("mcqAssessments.assessmentId")
      .populate("codeAssessments.assessmentId")
      .populate("candidates")
      .populate({
        path: "candidates",
        populate: {
          path: "appliedPostings",
          model: "AppliedPosting",
        },
      })
      .populate("organizationId")
      .populate("assignments.submissions")
      .populate("interviews.interview");

    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    return sendSuccess(c, 200, "job fetched successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const getPostingBySlug = async (c: Context) => {
  try {
    const posting = await Posting.findOne({ url: c.req.param("slug") })
      .populate("mcqAssessments.assessmentId")
      .populate("codeAssessments.assessmentId")
      .populate("candidates")
      .populate("organizationId")
      .populate("assignments.submissions");

    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    return sendSuccess(c, 200, "job fetched successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const createPosting = async (c: Context) => {
  try {
    const posting = await c.req.json();

    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    if (posting.additionalDetails) {
      Object.entries(posting.additionalDetails).forEach(
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
    }

    const newPosting = new Posting({
      ...posting,
      organizationId: perms.data?.organization?._id,
    });

    await newPosting.save();

    const newPostingFetched = await Posting.findById(newPosting._id);
    if (!newPostingFetched) {
      return sendError(c, 500, "Error creating posting");
    }

    const interviews = newPostingFetched?.workflow?.steps.filter(
      (step) => step.type === "INTERVIEW"
    );

    interviews?.forEach(async (step) => {
      const firstHalf = Math.random().toString(36).substring(7);
      const secondHalf = Math.random().toString(36).substring(7);
      const thirdHalf = Math.random().toString(36).substring(7);

      console.log(step);

      const meeting = new Meet({
        candidates: [],
        interviewers: [],
        code: `${firstHalf}-${secondHalf}-${thirdHalf}`,
      });

      newPostingFetched.interviews.push({
        interview: meeting._id,
        workflowId: step._id,
      });
      await meeting.save();
    });

    await newPostingFetched.save();

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: accountUser.firstName + " " + accountUser.lastName,
      userId: accountUser.id,
      action: `Created New Job Posting: ${posting.title}`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $push: {
        auditLogs: auditLog,
        postings: newPosting._id,
      },
    });

    return sendSuccess(c, 200, "job created successfully", newPosting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, `Error creating posting: ${e.message}`);
  }
};

const createWorkflow = async (c: Context) => {
  try {
    const { formattedData, _id } = await c.req.json();
    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }
    const posting = await Posting.findById(_id);
    if (!posting) {
      return sendError(c, 404, "Posting not found");
    }

    posting.workflow = formattedData;
    await posting.save();

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: accountUser.firstName + " " + accountUser.lastName,
      userId: accountUser.id,
      action: `Created New Workflow for Job Posting: ${posting.title}`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $push: { auditLogs: auditLog },
    });

    return sendSuccess(c, 201, "Workflow created successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const updateAts = async (c: Context) => {
  try {
    const { minimumScore, negativePrompts, positivePrompts, _id } =
      await c.req.json();

    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(_id);
    if (!posting) {
      return sendError(c, 404, "Posting not found");
    }
    if (!posting.ats) {
      posting.ats = {
        _id: new mongoose.Types.ObjectId(),
        minimumScore: minimumScore,
        negativePrompts: negativePrompts,
        positivePrompts: positivePrompts,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      posting.ats.minimumScore = minimumScore;
      posting.ats.negativePrompts = negativePrompts;
      posting.ats.positivePrompts = positivePrompts;
    }

    if (!posting.workflow) {
      return sendError(c, 400, "Workflow not found");
    }

    if (!posting.ats) {
      return sendError(c, 400, "ATS not found");
    }

    const atsStep = posting.workflow.steps.filter(
      (step) => step.type === "RESUME_SCREENING"
    );
    if (posting.ats && posting.ats._id) {
      atsStep[0]._id = new mongoose.Types.ObjectId(posting.ats._id.toString());
    }

    await posting.save();

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: accountUser.firstName + " " + accountUser.lastName,
      userId: accountUser.id,
      action: `Updated ATS for Job Posting: ${posting.title}`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $push: { auditLogs: auditLog },
    });

    return sendSuccess(c, 201, "ATS updated successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const updateAssignment = async (c: Context) => {
  try {
    const { name, description, postingId, step, submissionType } =
      await c.req.json();

    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(postingId);
    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    if (!posting.workflow) {
      return sendError(c, 400, "Workflow not found");
    }

    const _id = new mongoose.Types.ObjectId();
    const workflowId = posting.workflow.steps[step]._id;

    posting.assignments.push({
      _id,
      name,
      description,
      workflowId,
      submissionType,
    });
    await posting.save();

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: accountUser.firstName + " " + accountUser.lastName,
      userId: accountUser.id,
      action: `Created New Assignment for Job Posting: ${posting.title}`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $push: { auditLogs: auditLog },
    });

    return sendSuccess(c, 201, "Assignment created successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const updateInterview = async (c: Context) => {
  try {
    const { postingId, step } = await c.req.json();

    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(postingId);
    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    if (!posting.workflow) {
      return sendError(c, 400, "Workflow not found");
    }

    const _id = new mongoose.Types.ObjectId();
    // @ts-expect-error - Object has no properties common
    posting.workflow.steps[step].stepId = _id;

    await posting.save();

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: accountUser.firstName + " " + accountUser.lastName,
      userId: accountUser.id,
      action: `Created New Interview for Job Posting: ${posting.title}`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $push: { auditLogs: auditLog },
    });

    return sendSuccess(c, 201, "Interview created successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const publishPosting = async (c: Context) => {
  try {
    const { id } = await c.req.json();

    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(id);
    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    posting.published = true;
    posting.publishedOn = new Date();

    const urlSlug = Math.random().toString(36).substring(7);
    posting.url = urlSlug;
    await posting.save();

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: accountUser.firstName + " " + accountUser.lastName,
      userId: accountUser.id,
      action: `Published Job Posting: ${posting.title}`,
      type: "info",
    };

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $push: { auditLogs: auditLog },
    });

    return sendSuccess(c, 201, "Posting published successfully", posting);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const deletePosting = async (c: Context) => {
  try {
    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findByIdAndDelete(c.req.param("id"));
    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    await Organization.findByIdAndUpdate(perms.data?.organization?._id, {
      $pull: { postings: posting._id },
    });

    return sendSuccess(c, 200, "job deleted successfully");
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const getAssignment = async (c: Context) => {
  try {
    const { id, aid } = c.req.param();
    const posting = await Posting.findById(id);
    if (!posting) {
      return sendError(c, 404, "job not found");
    }

    const assignment = posting.assignments.find(
      (a) => a._id?.toString() === aid
    );
    if (!assignment) {
      return sendError(c, 404, "assignment not found");
    }

    return sendSuccess(c, 200, "job fetched successfully", assignment);
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

const saveAssignmentSubmission = async (c: Context) => {
  try {
    const { id, aid } = c.req.param();

    // Parse request body only once
    let textSubmission, linkSubmission;

    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      textSubmission = body.textSubmission;
      linkSubmission = body.linkSubmission;
    }

    // Validate parameters
    if (!id || !aid) {
      return sendError(c, 400, "Missing required parameters");
    }

    // Get the posting
    const posting = await Posting.findById(id);
    if (!posting) {
      return sendError(c, 404, "Job posting not found");
    }

    // Find the assignment
    const assignment = posting.assignments.find(
      (a) => a._id?.toString() === aid
    );

    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    // Check user
    const userId = c.get("auth")._id;
    if (!userId) {
      return sendError(c, 401, "Unauthorized");
    }

    const user = await Candidate.findOne({ userId });
    if (!user) {
      return sendError(c, 404, "User not found");
    }

    // Check if submission deadline has passed
    const postingStep = posting.workflow?.steps.find(
      (step) => step._id?.toString() === assignment.workflowId?.toString()
    );
    if (!postingStep || postingStep.status !== "in-progress") {
      return sendError(c, 400, "Submission deadline has passed");
    }

    // Check if submission already exists
    const existingSubmission = await AssignmentSubmission.findOne({
      assignmentId: assignment._id,
      candidateId: userId,
    });

    if (existingSubmission) {
      return sendError(c, 409, "You have already submitted this assignment");
    }

    // Handle file upload if needed
    if (assignment.submissionType === "file") {
      const formData = await c.req.formData();
      const file = formData.get("file");

      if (!file) {
        return sendError(c, 400, "File is required for this assignment");
      }

      try {
        const uploadParams = {
          Bucket: process.env.R2_S3_ASSIGNMENT_BUCKET!,
          Key: `${aid}/${c.get("auth")._id}.zip`,
          Body: file, // @ts-expect-error - Type 'File' is not assignable to type 'Body'
          ContentType: file.type,
        };

        const upload = new Upload({
          client: r2Client,
          params: uploadParams,
        });

        await upload.done();
      } catch (uploadError) {
        logger.error("File upload failed");
        return sendError(c, 500, "Failed to upload file");
      }
    }

    // Create submission
    const submission = new AssignmentSubmission({
      assignmentId: assignment._id,
      postingId: posting._id,
      candidateId: userId,
      textSubmission,
      linkSubmission,
      submittedAt: new Date(),
    });

    // Add submission to assignment
    assignment.submissions.push(submission._id);

    // Send confirmation email
    try {
      await loops.sendTransactionalEmail({
        transactionalId: "cm13tu50l02mc80gpi76joqvy",
        email: user.email as string,
        dataVariables: {
          // @ts-expect-error - Type 'string' is not assignable to type 'DataVariables'
          organization: posting?.organizationId?.name || "the company",
        },
      });
    } catch (emailError) {
      logger.warn("Failed to send confirmation email");
      // Continue with submission process even if email fails
    }

    // Save changes
    await Promise.all([posting.save(), submission.save()]);

    return sendSuccess(c, 201, "Submission saved successfully", submission);
  } catch (e: any) {
    logger.error("Error saving assignment submission");
    return sendError(
      c,
      500,
      "Something went wrong while processing your submission"
    );
  }
};

const gradeAssignment = async (c: Context) => {
  try {
    const { id, aid } = c.req.param();
    const { grade, cid } = await c.req.json();

    console.log(grade, cid);

    // Get the posting
    const posting = await Posting.findById(id);
    if (!posting) {
      return sendError(c, 404, "Job posting not found");
    }

    // Find the assignment
    const assignment = posting.assignments.find(
      (a) => a._id?.toString() === aid
    );

    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    // Get the submission
    console.log(assignment._id, cid);
    const submission = await AssignmentSubmission.findOne({
      assignmentId: assignment._id,
      candidateId: cid,
    });

    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    // Update the grade
    submission.grade = grade;
    console.log(submission);
    await submission.save();

    return sendSuccess(c, 200, "Grade saved successfully", submission);
  } catch (e: any) {
    logger.error("Error grading assignment submission");
    return sendError(
      c,
      500,
      "Something went wrong while processing your submission"
    );
  }
};

const getAssignmentSubmission = async (c: Context) => {
  try {
    const { id, aid, sid } = c.req.param();

    // Get the posting
    const posting = await Posting.findById(id);
    if (!posting) {
      return sendError(c, 404, "Job posting not found");
    }

    // Find the assignment
    const assignment = posting.assignments.find(
      (a) => a._id?.toString() === aid
    );

    if (!assignment) {
      return sendError(c, 404, "Assignment not found");
    }

    console.log(aid, sid);
    // Get the submission file
    const command = new GetObjectCommand({
      Bucket: process.env.R2_S3_ASSIGNMENT_BUCKET!,
      Key: `${aid}/${sid}.zip`,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 600 });

    return sendSuccess(c, 200, "File URL", { url });
  } catch (e: any) {
    logger.error("Error getting assignment submission");
    return sendError(
      c,
      500,
      "Something went wrong while processing your submission"
    );
  }
};

const getAppliedPostings = async (c: Context) => {
  try {
    const perms = await checkPermission.all(c, ["view_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const postings = await AppliedPosting.find({
      posting: c.req.param("id"),
    })
      .populate("posting")
      .populate("user");

    return sendSuccess(
      c,
      200,
      "Applied postings fetched successfully",
      postings
    );
  } catch (e: any) {
    logger.error(e);
    return sendError(c, 500, "Something went wrong");
  }
};

export default {
  getPostings,
  getPosting,
  createPosting,
  createWorkflow,
  updateAts,
  updateAssignment,
  updateInterview,
  publishPosting,
  deletePosting,
  getPostingBySlug,
  getAssignment,
  saveAssignmentSubmission,
  gradeAssignment,
  getAssignmentSubmission,
  getAppliedPostings,
};
