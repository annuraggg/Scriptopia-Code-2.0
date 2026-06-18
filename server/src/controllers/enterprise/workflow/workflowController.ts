import { Context } from "hono";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import loops from "@/config/loops";
import userDirectory from "@/services/userDirectory";

import Posting from "../../../models/Posting";
import Organization from "../../../models/Organization";
import CandidateModel from "../../../models/Candidate";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import checkPermission from "../../../middlewares/checkOrganizationPermission";
import { Assessment, Assignment } from "@shared-types/Posting";
import User from "@/models/User";
import Meet from "@/models/Meet";

const REGION = "ap-south-1";

const advanceWorkflow = async (c: Context) => {
  try {
    const { _id } = await c.req.json();

    const perms = await checkPermission.all(c, ["manage_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(_id).populate("candidates");
    if (!posting) {
      return sendError(c, 404, "Posting not found");
    }

    const workflow = posting?.workflow;
    if (!workflow || workflow.steps.length === 0) {
      return sendError(c, 400, "Invalid workflow");
    }

    const currentStepIndex = workflow.steps.findIndex(
      (step) => step.status === "in-progress"
    );

    if (
      currentStepIndex === -1 &&
      workflow.steps.every((step) => step.status === "completed")
    ) {
      return sendError(c, 400, "Workflow already completed");
    }

    if (currentStepIndex === -1) {
      workflow.steps[0].status = "in-progress";
      workflow.steps[0].schedule = {
        ...workflow.steps[0].schedule,
      };
      workflow.steps[0].startedBy = c.get("auth")._id;
    } else {
      workflow.steps[currentStepIndex].status = "completed";
      workflow.steps[currentStepIndex + 1].status = "in-progress";
      workflow.steps[currentStepIndex].schedule = {
        ...workflow.steps[currentStepIndex].schedule,
        actualCompletionTime: new Date(),
      };
      workflow.steps[0].startedBy = c.get("auth")._id;
    }

    const currentStep =
      workflow.steps[currentStepIndex === -1 ? 0 : currentStepIndex + 1];

    switch (currentStep.type) {
      case "RESUME_SCREENING":
        handleResumeScreening(posting, perms.data!.organization?._id);
        break;
      case "ASSIGNMENT":
        handleAssignmentRound(posting, currentStep);
        break;
      case "CODING_ASSESSMENT":
      case "MCQ_ASSESSMENT":
        handleAssessmentRound(posting, currentStep);
        break;
      case "INTERVIEW":
        handleInterviewRound(posting, currentStep);
        break;
    }

    console.log("Workflow advanced to next step", currentStep.type);

    await posting.save();
    await logWorkflowAdvance(c, posting, perms);

    const updatedPosting = await Posting.findById(_id)
      .populate("candidates")
      .populate("organizationId");
    return sendSuccess(
      c,
      200,
      "Workflow advanced successfully",
      updatedPosting
    );
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const handleResumeScreening = async (posting: any, orgId?: string) => {
  await Posting.findByIdAndUpdate(posting._id, {
    "ats.status": "processing",
  });

  const lambdaClient = new LambdaClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_LAMBDA_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_LAMBDA_SECRET_ACCESS_KEY!,
    },
  });

  const resumes = await Promise.all(
    posting.candidates.map(async (candidateId: string) => {
      const candidate = await CandidateModel.findById(candidateId);
      if (!candidate) return null;
      return candidate
        ? {
            candidateId: candidate._id.toString(),
            resume: candidate.resumeExtract,
          }
        : null;
    })
  );

  const org = await Organization.findById(orgId).populate("members.user");
  const step = posting.workflow.steps.find(
    (step: any) => step.type === "RESUME_SCREENING"
  );
  const user = org?.members.find(
    (member: any) => member.user._id.toString() === step?.startedBy.toString()
  );
  const dbUser = await User.findById(user?.user);
  if (!dbUser) return;
  const accountUser = await userDirectory.users.getUser(dbUser?._id.toString());

  const event = {
    jobDescription: posting.description,
    skills: posting.skills?.join(","),
    negativePrompts: posting.ats?.negativePrompts?.join(","),
    positivePrompts: posting.ats?.positivePrompts?.join(","),
    postingId: posting._id.toString(),
    resumes: resumes.filter(Boolean),
    mailData: {
      name: accountUser.firstName + " " + accountUser.lastName,
      email: user?.email,
      posting: posting.title,
      resumeScreenUrl: `${process.env.ENTERPRISE_FRONTEND_URL}/jobs/${posting.url}/ats`,
    },
  };

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: "resume-screener",
      Payload: JSON.stringify(event),
    })
  );
};

const handleAssignmentRound = async (posting: any, step: any) => {
  const assignment = posting.assignments?.find(
    (a: Assignment) => a.name === step.name
  );
  const organization = await Organization.findById(posting.organizationId);

  if (!assignment || !organization) return;

  const candidates = await CandidateModel.find({
    _id: { $in: posting.candidates },
    "appliedPostings.status": { $ne: "rejected" },
  });

  await Promise.all(
    candidates.map((candidate) =>
      loops.sendTransactionalEmail({
        transactionalId: "cm0zk1vd900966e8e6czepc4d",
        email: candidate.email,
        dataVariables: {
          name: candidate.name,
          postingName: posting.title,
          company: organization.name,
          assignmentLink: `${process.env.CANDIDATE_FRONTEND_URL}/postings/${posting._id}/assignments/${assignment._id}`,
        },
      })
    )
  );
};

const handleAssessmentRound = async (posting: any, step: any) => {
  console.log("Detected assessment round");
  const assessment =
    posting.mcqAssessments?.find(
      (a: Assessment) => a.workflowId.toString() === step._id.toString()
    ) ||
    posting.codeAssessments?.find(
      (a: Assessment) => a.workflowId.toString() === step._id.toString()
    );
  const organization = await Organization.findById(posting.organizationId);
  if (!assessment || !organization) return;

  const candidates = await CandidateModel.find({
    _id: { $in: posting.candidates },
    "appliedPostings.status": { $ne: "rejected" },
  });

  const assessmentType = step.type === "CODING_ASSESSMENT" ? "Coding" : "MCQ";
  const type = step.type === "CODING_ASSESSMENT" ? "c" : "m";

  console.log("Sending assessment emails");
  await Promise.all(
    candidates.map((candidate) =>
      loops.sendTransactionalEmail({
        transactionalId: "cm16lbamn012iyfq0agp9wl54",
        email: candidate.email,
        dataVariables: {
          name: candidate.name,
          postingName: posting.title,
          type: assessmentType,
          assessmentLink: `${process.env.SCRIPTOPIA_FRONTEND_URL}/assessments/${type}/${assessment.assessmentId}`,
          company: organization.name,
        },
      })
    )
  );
};

const handleInterviewRound = async (posting: any, step: any) => {
  console.log("Detected interview round");
  const organization = await Organization.findById(posting.organizationId);
  if (!organization) return;

  const candidates = await CandidateModel.find({
    _id: { $in: posting.candidates },
    "appliedPostings.status": { $ne: "rejected" },
  });

  const workflowStepId = posting.workflow.steps.find(
    (s: any) => s._id.toString() === step._id.toString()
  )._id;

  const interviewId = posting.interviews.find(
    (interview: any) =>
      interview.workflowId.toString() === workflowStepId.toString()
  ).interview;


  console.log("Interview ID", interviewId);

  if (!interviewId) return;

  const interview = await Meet.findById(interviewId);
  if (!interview) return;


  await Promise.all(
    candidates.map((candidate) => {
      loops.sendTransactionalEmail({
        transactionalId: "cm84on6wm06v3e9gl6a2hm0j8",
        email: candidate.email,
        dataVariables: {
          name: candidate.name,
          postingName: posting.title,
          interviewLink: `${process.env.MEET_FRONTEND_URL}/v3/${interview.code}`,
          company: organization.name,
        },
      });

      interview.candidates.push(candidate._id);
    })
  );

  const interviewer = organization.members.find(
    (member: any) => member.role === "hiring_manager"
  );

  if (interviewer && interviewer.user) {
    interview.interviewers.push(interviewer?.user);
  }

  await interview.save();
};

const logWorkflowAdvance = async (c: Context, posting: any, perms: any) => {
  const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
  const organization = await Organization.findById(
    perms.data!.organization?._id
  );
  if (!organization) return;

  organization.auditLogs.push({
    action: `Advanced workflow for ${posting.title} to next step`,
    user: `${accountUser.firstName} ${accountUser.lastName}`,
    userId: accountUser.id,
    type: "info",
  });

  const notification = {
    title: "Workflow Advanced",
    description: `Workflow for ${posting.title} has been advanced to the next step`,
    date: new Date(),
    read: false,
  };

  organization.members.forEach((member) => {
    if (
      member.role &&
      organization.roles.some(
        (r: any) =>
          r.slug === member.role && r.permissions.includes("manage_job")
      )
    ) {
      member.notifications.push(notification);
    }
  });

  await organization.save();
};

export default { advanceWorkflow };
