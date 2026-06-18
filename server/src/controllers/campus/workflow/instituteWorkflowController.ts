import { Context } from "hono";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import loops from "@/config/loops";
import userDirectory from "@/services/userDirectory";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import { z } from "zod";

import Drive from "../../../models/Drive";
import Institute from "../../../models/Institute";
import CandidateModel from "../../../models/Candidate";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import checkPermission from "../../../middlewares/checkInstitutePermission";
import { Assessment, Assignment } from "@shared-types/Drive";
import User from "@/models/User";
import Meet from "@/models/Meet";
import AppliedDrive from "@/models/AppliedDrive";
import getCampusUsersWithPermission from "@/utils/getUserWithPermission";
import { sendNotificationToCampus } from "@/utils/sendNotification";

const REGION = "ap-south-1";

// Input validation schema for request body
const RequestSchema = z.object({
  _id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId format"),
});

/**
 * Advances a drive's workflow to the next step
 */
const advanceWorkflow = async (c: Context) => {
  try {
    // Input validation
    const bodyResult = RequestSchema.safeParse(await c.req.json());
    if (!bodyResult.success) {
      return sendError(c, 400, "Invalid request data", bodyResult.error);
    }

    const { _id } = bodyResult.data;

    // Authorization check
    const perms = await checkPermission.all(c, ["manage_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized to manage drives");
    }

    // Fetch the required user data upfront to avoid repeated queries
    const authUserId = c.get("auth")?._id;
    if (!authUserId) {
      return sendError(c, 401, "Authentication required");
    }

    const user = await User.findById(authUserId);
    if (!user) {
      return sendError(c, 404, "User not found");
    }

    // Start a database transaction to ensure consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find drive and verify ownership
      const drive = await Drive.findById(_id)
        .populate("candidates")
        .session(session);
      if (!drive) {
        await session.abortTransaction();
        session.endSession();
        return sendError(c, 404, "Drive not found");
      }

      // Verify institute ownership
      if (
        drive.institute &&
        perms.data?.institute?._id &&
        drive.institute.toString() !== perms.data.institute._id.toString()
      ) {
        await session.abortTransaction();
        session.endSession();
        return sendError(c, 403, "Not authorized to manage this drive");
      }

      const workflow = drive?.workflow;
      if (
        !workflow ||
        !Array.isArray(workflow.steps) ||
        workflow.steps.length === 0
      ) {
        await session.abortTransaction();
        session.endSession();
        return sendError(c, 400, "Invalid workflow configuration");
      }

      const currentStepIndex = workflow.steps.findIndex(
        (step) => step.status === "in-progress"
      );

      // Check if workflow is already completed
      if (
        currentStepIndex === -1 &&
        workflow.steps.every((step) => step.status === "completed")
      ) {
        await session.abortTransaction();
        session.endSession();
        return sendError(c, 400, "Workflow already completed");
      }

      // Update workflow status
      if (currentStepIndex === -1) {
        // First step
        workflow.steps[0].status = "in-progress";
        workflow.steps[0].schedule = {
          ...workflow.steps[0].schedule,
          startTime: new Date(),
        };
        workflow.steps[0].startedBy = authUserId;
      } else {
        // Complete current step and move to next
        workflow.steps[currentStepIndex].status = "completed";
        workflow.steps[currentStepIndex].schedule = {
          ...workflow.steps[currentStepIndex].schedule,
          actualCompletionTime: new Date(),
        };

        // Check if there's a next step before accessing it
        if (currentStepIndex + 1 < workflow.steps.length) {
          workflow.steps[currentStepIndex + 1].status = "in-progress";
          workflow.steps[currentStepIndex + 1].schedule = {
            ...workflow.steps[currentStepIndex + 1].schedule,
            startTime: new Date(),
          };
          workflow.steps[currentStepIndex + 1].startedBy = authUserId;
        } else {
          // This was the last step, mark the workflow as completed
          drive.set("status", "completed");
        }
      }

      // Determine which step to operate on
      const nextStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex + 1;

      // Only proceed if we have a valid next step
      if (nextStepIndex < workflow.steps.length) {
        const currentStep = workflow.steps[nextStepIndex];

        // Process the step based on its type
        try {
          switch (currentStep.type) {
            case "RESUME_SCREENING":
              await handleResumeScreening(
                drive,
                perms.data!.institute?._id,
                session
              );
              break;
            case "ASSIGNMENT":
              await handleAssignmentRound(drive, currentStep as any, session);
              break;
            case "CODING_ASSESSMENT":
            case "MCQ_ASSESSMENT":
              await handleAssessmentRound(drive, currentStep as any, session);
              break;
            case "INTERVIEW":
              await handleInterviewRound(
                drive,
                currentStep as any,
                session,
                authUserId
              );
              break;
            case "CUSTOM":
              await handleCustomRound(drive, session);
              break;
            default:
              console.warn(`Unhandled step type: ${currentStep.type}`);
          }
        } catch (stepError: unknown) {
          const errorMessage =
            stepError instanceof Error ? stepError.message : "Unknown error";
          console.error(
            `Error handling step type ${currentStep.type}:`,
            stepError
          );
          await session.abortTransaction();
          session.endSession();
          return sendError(
            c,
            500,
            `Error processing workflow step: ${errorMessage}`
          );
        }
      }

      // Save drive changes
      await drive.save({ session });

      // Log the workflow advancement
      await logWorkflowAdvance(c, drive, perms, session);

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Fetch updated drive with populated fields
      const updatedDrive = await Drive.findById(_id)
        .populate("candidates")
        .populate("institute");

      const institute = await Institute.findById(drive.institute);
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
          title: "Drive Workflow Advanced",
          message: `The workflow for drive "${drive.title}" has been advanced to the next step.`,
        });
      }

      return sendSuccess(
        c,
        200,
        "Workflow advanced successfully",
        updatedDrive
      );
    } catch (txError: unknown) {
      // Rollback the transaction on error
      await session.abortTransaction();
      session.endSession();
      throw txError;
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Workflow advancement error:", error);
    return sendError(c, 500, "Internal Server Error", {
      message: errorMessage,
    });
  }
};

/**
 * Handles the resume screening step of the workflow
 */
const handleResumeScreening = async (
  drive: any,
  orgId?: string,
  session?: any
) => {
  if (!orgId) {
    throw new Error("Organization ID is required for resume screening");
  }

  // Update drive ATS status
  await Drive.findByIdAndUpdate(
    drive._id,
    { "ats.status": "processing" },
    { session }
  );

  // Get candidate resume data
  const resumes = await Promise.all(
    drive.candidates.map(async (candidateId: string) => {
      const candidate = await CandidateModel.findById(candidateId).session(
        session
      );
      if (!candidate || !candidate.resumeExtract) {
        return null;
      }
      return {
        candidateId: candidate._id.toString(),
        resume: candidate.resumeExtract,
      };
    })
  );

  const validResumes = resumes.filter(Boolean);
  if (validResumes.length === 0) {
    throw new Error("No valid resumes found for screening");
  }

  // Get institute and user information
  const org = await Institute.findById(orgId)
    .populate("members.user")
    .session(session);
  if (!org) {
    throw new Error("Institute not found");
  }

  const step = drive.workflow.steps.find(
    (step: any) => step.type === "RESUME_SCREENING"
  );

  if (!step || !step.startedBy) {
    throw new Error("Resume screening step not properly initialized");
  }

  const member = org.members.find(
    (member: any) =>
      member.user && member.user._id.toString() === step.startedBy.toString()
  );

  if (!member) {
    throw new Error("Step initiator not found in institute members");
  }

  const dbUser = await User.findById(member.user?._id).session(session);
  if (!dbUser || !dbUser._id.toString()) {
    throw new Error("User data incomplete for resume screening notification");
  }

  // Get user details from identity provider
  const accountUser = await userDirectory.users.getUser(dbUser._id.toString());

  // Create deterministic request ID for idempotency
  const requestId = uuidv4();

  // Prepare event data for Lambda
  const event = {
    requestId,
    driveDescription: drive.description || "",
    skills: Array.isArray(drive.skills) ? drive.skills.join(",") : "",
    negativePrompts: Array.isArray(drive.ats?.negativePrompts)
      ? drive.ats.negativePrompts.join(",")
      : "",
    positivePrompts: Array.isArray(drive.ats?.positivePrompts)
      ? drive.ats.positivePrompts.join(",")
      : "",
    driveId: drive._id.toString(),
    resumes: validResumes,
    mailData: {
      name:
        `${accountUser.firstName || ""} ${accountUser.lastName || ""}`.trim() ||
        "User",
      email: member.email || dbUser.email,
      drive: drive.title,
      resumeScreenUrl: `${process.env.ENTERPRISE_FRONTEND_URL}/drives/${drive.url}/ats`,
    },
  };

  // Use AWS SDK with minimal permissions
  try {
    const lambdaClient = new LambdaClient({
      region: REGION,
      // Best practice: Use IAM roles instead of hard-coded credentials
      // If credentials must be used, they should be fetched from a secure service
      credentials: {
        accessKeyId: process.env.AWS_LAMBDA_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_LAMBDA_SECRET_ACCESS_KEY!,
      },
    });

    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: "resume-screener",
        Payload: JSON.stringify(event),
        ClientContext: JSON.stringify({
          requestId,
          source: "workflow-engine",
          driveId: drive._id.toString(),
        }),
      })
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Lambda invocation error:", error);
    throw new Error(`Failed to initiate resume screening: ${errorMessage}`);
  }
};

/**
 * Handles the assignment round step of the workflow
 */
const handleAssignmentRound = async (drive: any, step: any, session?: any) => {
  if (!step || !step.name) {
    throw new Error("Invalid assignment step configuration");
  }

  const assignment = drive.assignments?.find(
    (a: Assignment) => a.name === step.name
  );

  if (!assignment) {
    throw new Error(`Assignment "${step.name}" not found in drive`);
  }

  const institute = await Institute.findById(drive.institute).session(session);
  if (!institute) {
    throw new Error("Institute not found");
  }

  // Find eligible candidates (not rejected)
  const candidates = await CandidateModel.find({
    _id: { $in: drive.candidates },
    "appliedDrives.drive": drive._id,
    "appliedDrives.status": { $ne: "rejected" },
  }).session(session);

  if (candidates.length === 0) {
    console.warn(`No eligible candidates found for assignment "${step.name}"`);
    return;
  }

  // Update applied drive status
  await AppliedDrive.updateMany(
    {
      drive: drive._id,
      candidate: { $in: candidates.map((c) => c._id) },
      status: { $ne: "rejected" },
    },
    { $set: { status: "assignment" } },
    { session }
  );

  // Chunk candidate emails to avoid rate limits
  const BATCH_SIZE = 50;
  const candidateBatches = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    candidateBatches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  // Process each batch with delay to avoid email service rate limits
  for (const batch of candidateBatches) {
    try {
      await Promise.all(
        batch.map((candidate) =>
          loops
            .sendTransactionalEmail({
              transactionalId: "cm0zk1vd900966e8e6czepc4d",
              email: candidate.email,
              dataVariables: {
                name: candidate.name,
                driveName: drive.title,
                company: institute.name,
                assignmentLink: `${process.env.CANDIDATE_FRONTEND_URL}/drives/${drive._id}/assignments/${assignment._id}`,
              },
            })
            .catch((err) => {
              console.error(`Failed to send email to ${candidate.email}:`, err);
              // Continue with other emails even if one fails
            })
        )
      );

      // Small delay between batches to avoid overwhelming email service
      if (batch !== candidateBatches[candidateBatches.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error sending assignment emails:", error);
      throw new Error(`Failed to send assignment emails: ${errorMessage}`);
    }
  }
};

/**
 * Handles the assessment round step of the workflow
 */
const handleAssessmentRound = async (drive: any, step: any, session?: any) => {
  if (!step || !step._id) {
    throw new Error("Invalid assessment step configuration");
  }

  const isCodeAssessment = step.type === "CODING_ASSESSMENT";
  const assessmentType = isCodeAssessment
    ? "codeAssessments"
    : "mcqAssessments";

  // Find the assessment for this workflow step
  const assessment = drive[assessmentType]?.find(
    (a: Assessment) =>
      a.workflowId && a.workflowId.toString() === step._id.toString()
  );

  if (!assessment) {
    throw new Error(
      `${isCodeAssessment ? "Coding" : "MCQ"} assessment not found for step ${
        step.name
      }`
    );
  }

  // Verify assessment ID exists
  if (!assessment.assessmentId) {
    throw new Error(`Assessment ID is missing for ${step.name}`);
  }

  const institute = await Institute.findById(drive.institute).session(session);
  if (!institute) {
    throw new Error("Institute not found");
  }

  // Find eligible candidates (not rejected)
  const candidates = await CandidateModel.find({
    _id: { $in: drive.candidates },
    "appliedDrives.drive": drive._id,
    "appliedDrives.status": { $ne: "rejected" },
  }).session(session);

  if (candidates.length === 0) {
    console.warn(`No eligible candidates found for assessment "${step.name}"`);
    return;
  }

  // Update applied drive status
  await AppliedDrive.updateMany(
    {
      drive: drive._id,
      candidate: { $in: candidates.map((c) => c._id) },
      status: { $ne: "rejected" },
    },
    { $set: { status: "assessment" } },
    { session }
  );

  const assessmentDisplayType = isCodeAssessment ? "Coding" : "MCQ";
  const typeCode = isCodeAssessment ? "c" : "m";

  // Send emails in batches to avoid rate limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    try {
      await Promise.all(
        batch.map((candidate) =>
          loops
            .sendTransactionalEmail({
              transactionalId: "cm16lbamn012iyfq0agp9wl54",
              email: candidate.email,
              dataVariables: {
                name: candidate.name,
                postingName: drive.title,
                type: assessmentDisplayType,
                assessmentLink: `${process.env.SCRIPTOPIA_FRONTEND_URL}/assessments/${typeCode}/${assessment.assessmentId}`,
                company: institute.name,
              },
            })
            .catch((err) => {
              console.error(`Failed to send email to ${candidate.email}:`, err);
              // Continue with other emails even if one fails
            })
        )
      );

      // Small delay between batches
      if (i + BATCH_SIZE < candidates.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error sending assessment emails:", error);
      throw new Error(`Failed to send assessment emails: ${errorMessage}`);
    }
  }
};

/**
 * Handles the custom round step of the workflow
 */
const handleCustomRound = async (drive: any, session?: any) => {
  if (!drive._id) {
    throw new Error("Drive ID is required");
  }

  // Update the status of all non-rejected applications
  const result = await AppliedDrive.updateMany(
    {
      drive: drive._id,
      status: { $ne: "rejected" },
    },
    {
      $set: { status: "inprogress" },
    },
    { session }
  );

  if (result.modifiedCount === 0) {
    console.warn("No candidate applications were updated for the custom round");
  }

  return result;
};

/**
 * Handles the interview round step of the workflow
 */
const handleInterviewRound = async (
  drive: any,
  step: any,
  session?: any,
  userId?: string
) => {
  if (!step || !step._id) {
    throw new Error("Invalid interview step configuration");
  }

  // Find the interview for this workflow step
  const interviewConfig = drive.interviews?.find(
    (interview: any) =>
      interview.workflowId &&
      interview.workflowId.toString() === step._id.toString()
  );

  if (!interviewConfig) {
    throw new Error(
      `Interview configuration not found for step ${step.name || "unknown"}`
    );
  }

  if (!interviewConfig.interview) {
    throw new Error(
      `Interview ID is missing for step ${step.name || "unknown"}`
    );
  }

  const institute = await Institute.findById(drive.institute).session(session);
  if (!institute) {
    throw new Error("Institute not found");
  }

  // Find interview record
  const interview = await Meet.findById(interviewConfig.interview).session(
    session
  );
  if (!interview) {
    throw new Error(
      `Interview record not found with ID ${interviewConfig.interview}`
    );
  }

  // Find eligible candidates
  const candidates = await CandidateModel.find({
    _id: { $in: drive.candidates },
    "appliedDrives.drive": drive._id,
    "appliedDrives.status": { $ne: "rejected" },
  }).session(session);

  if (candidates.length === 0) {
    console.warn(
      `No eligible candidates found for interview "${step.name || "unknown"}"`
    );
    return;
  }

  // Update applied drive status
  await AppliedDrive.updateMany(
    {
      drive: drive._id,
      candidate: { $in: candidates.map((c) => c._id) },
      status: { $ne: "rejected" },
    },
    { $set: { status: "interview" } },
    { session }
  );

  // Add unique candidates to interview
  const existingCandidateIds = interview.candidates.map((id: any) =>
    id.toString()
  );
  for (const candidate of candidates) {
    if (!existingCandidateIds.includes(candidate._id.toString())) {
      interview.candidates.push(candidate._id);
    }
  }

  // Find suitable interviewer
  let interviewer;

  // First, try to use the specified hiring manager
  const hiringManager = institute.members.find(
    (member: any) => member.role === "hiring_manager" && member.user
  );

  // If no hiring manager, use the current user as interviewer
  if (hiringManager?.user) {
    interviewer = hiringManager.user;
  } else if (userId) {
    interviewer = userId;
  } else {
    // Fallback to any admin/owner
    const admin = institute.members.find(
      (member: any) =>
        (member.role === "admin" || member.role === "owner") && member.user
    );

    if (admin?.user) {
      interviewer = admin.user;
    }
  }

  if (interviewer) {
    if (
      !interview.interviewers.some(
        (id: any) => id.toString() === interviewer.toString()
      )
    ) {
      interview.interviewers.push(new mongoose.Types.ObjectId(interviewer));
    }
  }

  await interview.save({ session });

  // Send interview invitations in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    try {
      await Promise.all(
        batch.map((candidate) =>
          loops
            .sendTransactionalEmail({
              transactionalId: "cm84on6wm06v3e9gl6a2hm0j8",
              email: candidate.email,
              dataVariables: {
                name: candidate.name,
                driveName: drive.title,
                interviewLink: `${process.env.MEET_FRONTEND_URL}/v3/${interview.code}`,
                company: institute.name,
              },
            })
            .catch((err) => {
              console.error(
                `Failed to send interview invitation to ${candidate.email}:`,
                err
              );
            })
        )
      );

      // Small delay between batches
      if (i + BATCH_SIZE < candidates.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error sending interview invitations:", error);
      throw new Error(`Failed to send interview invitations: ${errorMessage}`);
    }
  }
};

/**
 * Logs the workflow advancement action
 */
const logWorkflowAdvance = async (
  c: Context,
  drive: any,
  perms: any,
  session?: any
) => {
  if (!perms.data?.institute?._id) {
    console.warn("Missing institute data for logging");
    return;
  }

  try {
    const authUserId = c.get("auth").userId;
    if (!authUserId) {
      console.warn("Missing user ID for audit logging");
      return;
    }

    const accountUser = await userDirectory.users.getUser(authUserId);
    const institute = await Institute.findById(
      perms.data.institute._id
    ).session(session);
    if (!institute) {
      console.warn(
        `Institute not found for logging: ${perms.data.institute._id}`
      );
      return;
    }

    const userName =
      `${accountUser.firstName || ""} ${accountUser.lastName || ""}`.trim() ||
      "Unknown User";

    // Add audit log
    institute.auditLogs.push({
      action: `Advanced workflow for ${drive.title} to next step`,
      user: userName,
      userId: accountUser.id,
      type: "info",
      timestamp: new Date(),
    });

    // Create notification
    const notification = {
      title: "Workflow Advanced",
      description: `Workflow for ${drive.title} has been advanced to the next step`,
      date: new Date(),
      read: false,
      id: uuidv4(),
    };

    // Add notification to eligible members
    institute.members.forEach((member: any) => {
      if (
        member.role &&
        institute.roles.some(
          (r: any) =>
            r.slug === member.role &&
            Array.isArray(r.permissions) &&
            r.permissions.includes("manage_drive")
        )
      ) {
        // Initialize notifications array if it doesn't exist
        if (!Array.isArray(member.notifications)) {
          member.notifications = [];
        }

        member.notifications.push(notification);
      }
    });

    await institute.save({ session });
  } catch (error: unknown) {
    // Log error but don't throw it since this is a non-critical operation
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error logging workflow advancement:", errorMessage, error);
  }
};

export default { advanceWorkflow };
