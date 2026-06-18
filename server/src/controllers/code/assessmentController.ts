import { Context } from "hono";
import { sendError, sendSuccess } from "../../utils/sendResponse";
import Problem from "../../models/Problem";
import { runCode as runCompilerCode } from "../../utils/runCode";
import { TestCase } from "@shared-types/Problem";
import Posting from "@/models/Posting";
import { Candidate } from "@shared-types/Candidate";
import logger from "@/utils/logger";
import MCQAssessment from "@/models/MCQAssessment";
import CodeAssessment from "@/models/CodeAssessment";
import { CodeAssessment as ICodeAssessment } from "@shared-types/CodeAssessment";
import { MCQAssessment as IMCQAssessment } from "@shared-types/MCQAssessment";
import MCQAssessmentSubmissions from "@/models/MCQAssessmentSubmission";
import CodeAssessmentSubmissions from "@/models/CodeAssessmentSubmission";
import mongoose from "mongoose";
import calculateMCQScore from "@/utils/calculateMCQScore";
import calculateCodeScore from "@/utils/calculateCodeScore";
import { MCQAssessmentSubmission as IMCQAssessmentSubmission } from "@shared-types/MCQAssessmentSubmission";
import Organization from "@/models/Organization";
import { AuditLog, Member } from "@shared-types/Organization";
import userDirectory from "@/services/userDirectory";
import checkOrganizationPermission from "@/middlewares/checkOrganizationPermission";
import AppliedPosting from "@/models/AppliedPosting";
import { AppliedPosting as IAppliedPosting } from "@shared-types/AppliedPosting";
import { Upload } from "@aws-sdk/lib-storage";
import r2Client from "@/config/s3";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppliedDrive from "@/models/AppliedDrive";
import checkInstitutePermission from "@/middlewares/checkInstitutePermission";
import Drive from "@/models/Drive";
import CandidateModel from "@/models/Candidate";
import { WorkflowStep } from "@shared-types/Posting";

async function getIoServer() {
  const { ioServer } = await import("@/config/init");
  return ioServer;
}

getIoServer().then((server) => {
  server.on("connection", (socket) => {
    logger.info("A user connected with id: " + socket.id);
    socket.on("disconnect", () => {
      logger.info("User disconnected");
    });

    socket.on("start-code-assessment", async (data) => {
      const newSubmission = new CodeAssessmentSubmissions(data);
      newSubmission.status = "in-progress";
      await newSubmission.save();
    });

    socket.on("start-mcq-assessment", async (data) => {
      const newSubmission = new MCQAssessmentSubmissions(data);
      newSubmission.status = "in-progress";
      await newSubmission.save();
    });

    socket.on("timeSync-code", async (data) => {
      const submission = await CodeAssessmentSubmissions.findOne({
        email: data.email,
        assessmentId: data.assessmentId,
      });

      if (!submission) {
        return;
      }

      if (submission.status === "completed") {
        return;
      }

      submission.timer = data.time;
      await submission.save();
    });

    socket.on("timeSync-mcq", async (data) => {
      const submission = await MCQAssessmentSubmissions.findOne({
        email: data.email,
        assessmentId: data.assessmentId,
      });

      if (!submission) {
        return;
      }

      if (submission.status === "completed") {
        return;
      }

      submission.timer = data.time;
      await submission.save();
    });

    socket.on("tab-change-code", async ({ assessmentId, email, problem }) => {
      if (!assessmentId || !email || !problem) return;

      const submission = await CodeAssessmentSubmissions.findOne({
        email,
        assessmentId,
      });

      if (!submission) return;

      if (!submission?.offenses) {
        submission.offenses = {};
      }

      if (!submission?.offenses?.tabChange) {
        submission.offenses.tabChange = new mongoose.Types.DocumentArray([]);
      }

      const { tabChange } = submission.offenses;

      const problemEntry = tabChange?.find(
        (p) => p?.problemId?.toString() === problem.toString()
      );

      if (problemEntry) {
        problemEntry.times = (problemEntry.times || 0) + 1;
      } else {
        tabChange?.push({ problemId: problem, times: 1 });
      }

      await submission.save();
    });

    socket.on("tab-change-mcq", async ({ assessmentId, email }) => {
      if (!assessmentId || !email) return;

      const submission = await MCQAssessmentSubmissions.findOne({
        email,
        assessmentId,
      });

      if (!submission) return;

      if (!submission?.offenses) {
        submission.offenses = {};
      }

      if (!submission?.offenses?.tabChange) {
        submission.offenses.tabChange = 0;
      }

      submission.offenses.tabChange += 1;
      await submission.save();
    });

    socket.on(
      "external-paste-code",
      async ({ assessmentId, email, problem }) => {
        if (!assessmentId || !email || !problem) return;

        const submission = await CodeAssessmentSubmissions.findOne({
          email,
          assessmentId,
        });

        if (!submission) return;

        if (!submission?.offenses) {
          submission.offenses = {};
        }

        if (!submission?.offenses?.copyPaste) {
          submission.offenses.copyPaste = new mongoose.Types.DocumentArray([]);
        }

        const { copyPaste } = submission.offenses;

        const problemEntry = copyPaste?.find(
          (p) => p?.problemId?.toString() === problem.toString()
        );

        if (problemEntry) {
          problemEntry.times = (problemEntry.times || 0) + 1;
        } else {
          copyPaste?.push({ problemId: problem, times: 1 });
        }

        await submission.save();
      }
    );

    socket.on("external-paste-mcq", async ({ assessmentId, email, mcq }) => {
      if (!assessmentId || !email || !mcq) return;

      const submission = await MCQAssessmentSubmissions.findOne({
        email,
        assessmentId,
      });

      if (!submission) return;

      if (!submission?.offenses) {
        submission.offenses = {};
      }

      if (!submission?.offenses?.copyPaste) {
        submission.offenses.copyPaste = 0;
      }

      submission.offenses.copyPaste += 1;
      await submission.save();
    });

    socket.on(
      "session-url-code",
      async ({ assessmentId, email, sessionUrl }) => {
        console.log("Session URL Code");
        console.log(assessmentId, email, sessionUrl);
        if (!assessmentId || !email || !sessionUrl) return;

        const submission = await CodeAssessmentSubmissions.findOne({
          email,
          assessmentId,
        });

        if (!submission) return;

        submission.sessionRewindUrl = sessionUrl;
        await submission.save();
      }
    );

    socket.on(
      "session-url-mcq",
      async ({ assessmentId, email, sessionUrl }) => {
        console.log("Session URL MCQ");
        console.log(assessmentId, email, sessionUrl);
        if (!assessmentId || !email || !sessionUrl) return;

        const submission = await MCQAssessmentSubmissions.findOne({
          email,
          assessmentId,
        });

        if (!submission) return;

        submission.sessionRewindUrl = sessionUrl;
        await submission.save();
      }
    );

    socket.on("auto-save-mcq", async ({ assessmentId, email, submissions }) => {
      console.log("Auto Save MCQ");
      console.log(assessmentId, email, submissions);
      if (!assessmentId || !email || !submissions) return;

      const submission = await MCQAssessmentSubmissions.findOne({
        email,
        assessmentId,
      });

      if (!submission) return;

      if (!submission.mcqSubmissions) {
        submission.mcqSubmissions = new mongoose.Types.DocumentArray([]);
      }

      submission.mcqSubmissions = submissions;

      await submission.save();
    });
  });
});

const createMcqAssessment = async (c: Context) => {
  try {
    const body = await c.req.json();
    const userid = c.get("auth")?._id;

    const isEnterprise = body.isEnterprise;
    const isCampus = body.isCampus;
    const newAssessment = new MCQAssessment();

    if (isEnterprise) {
      const perms = await checkOrganizationPermission.all(c, ["manage_job"]);
      if (!perms.allowed) {
        return sendError(c, 401, "Unauthorized");
      }

      const { postingId, step } = body;

      const posting = await Posting.findOne({
        _id: postingId,
      }).populate("mcqAssessments");
      console.log("posting got");
      if (!posting) {
        return sendError(c, 404, "job not found");
      }

      if (!posting.workflow) {
        return sendError(c, 400, "Workflow not found");
      }

      const isAssessmentStep = (step: WorkflowStep) =>
        step.type === "MCQ_ASSESSMENT" || step.type === "CODING_ASSESSMENT";

      const assessmentstep = parseInt(step);
      console.log("assessment step", assessmentstep);
      const workflowId = // @ts-expect-error
        posting.workflow.steps?.filter(isAssessmentStep)?.[assessmentstep];

      console.log("workflowId", workflowId);

      await Posting.findByIdAndUpdate(postingId, {
        $push: {
          mcqAssessments: {
            assessmentId: newAssessment._id,
            workflowId: workflowId._id,
          },
        },
        updatedOn: new Date(),
      });

      const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
      const auditLog: AuditLog = {
        user: accountUser.firstName + " " + accountUser.lastName,
        userId: accountUser.publicMetadata?._id as string,
        action: `Created New Assessment for Job Posting: ${posting.title}`,
        type: "info",
      };

      await Organization.findByIdAndUpdate(perms.data!.organization?._id, {
        $push: { auditLogs: auditLog },
      });
    }

    if (isCampus) {
      const perms = await checkInstitutePermission.all(c, ["manage_drive"]);
      if (!perms.allowed) {
        return sendError(c, 401, "Unauthorized");
      }

      const { driveId, step } = body;

      const drive = await Drive.findOne({
        _id: driveId,
      }).populate("mcqAssessments");

      if (!drive) {
        return sendError(c, 404, "Drive not found");
      }

      const assessmentstep = parseInt(step);
      const workflowId = drive.workflow?.steps[assessmentstep]?._id;
      await Drive.findByIdAndUpdate(driveId, {
        $push: {
          mcqAssessments: {
            assessmentId: newAssessment._id,
            workflowId: workflowId,
          },
        },
        updatedOn: new Date(),
      });
    }

    if (!userid) {
      return sendError(c, 401, "Unauthorized");
    }

    // calculate total obtainable score
    const manualTypes = ["long-answer", "output"];
    let totalScore = 0;
    let totalAutoScore = 0;
    const assessment: IMCQAssessment = body;

    assessment.sections.forEach((section) => {
      section.questions.forEach((question) => {
        totalScore += question?.grade || 0;
        if (!manualTypes.includes(question.type)) {
          totalAutoScore += question?.grade || 0;
        }
      });
    });

    const assessmentObj = {
      ...body,
      author: userid,
      obtainableScore: totalScore,
      autoObtainableScore: totalAutoScore,
      requiresManualReview: totalAutoScore !== totalScore,
    };

    newAssessment.set(assessmentObj);
    await newAssessment.save();

    return sendSuccess(c, 200, "Success", newAssessment);
  } catch (error: any) {
    console.error(error);
    if (error.name === "ValidationError") {
      return sendError(c, 400, "Invalid Data", error.message);
    }
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const createCodeAssessment = async (c: Context) => {
  try {
    const body = await c.req.json();
    const userid = c.get("auth")?._id;

    if (!userid) {
      return sendError(c, 401, "Unauthorized");
    }

    let totalScore = 0;
    const assessment: ICodeAssessment = body;
    const gradingType = assessment?.grading?.type;
    const isEnterprise = body.isEnterprise;
    const isCampus = body.isCampus;

    console.log("isEnterprise", isEnterprise);
    console.log("isCampus", isCampus);

    const newAssessment = new CodeAssessment();

    if (isEnterprise) {
      const perms = await checkOrganizationPermission.all(c, ["manage_job"]);
      if (!perms.allowed) {
        return sendError(c, 401, "Unauthorized");
      }

      const { postingId, step } = body;
      console.log("Enterprise Assessment");
      console.log(postingId, step);

      const posting = await Posting.findOne({
        _id: postingId,
      }).populate("codeAssessments");
      if (!posting) {
        return sendError(c, 404, "job not found");
      }

      if (!posting.workflow) {
        return sendError(c, 400, "Workflow not found");
      }

      const isAssessmentStep = (step: WorkflowStep) =>
        step.type === "MCQ_ASSESSMENT" || step.type === "CODING_ASSESSMENT";

      const assessmentstep = parseInt(step);
      console.log("assessment step", assessmentstep);
      const workflowId = // @ts-expect-error
        posting.workflow.steps?.filter(isAssessmentStep)?.[assessmentstep];

      console.log("workflowId", workflowId);

      await Posting.findByIdAndUpdate(postingId, {
        $push: {
          codeAssessments: {
            assessmentId: newAssessment._id,
            workflowId: workflowId._id,
          },
        },
        updatedOn: new Date(),
      });

      const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
      const auditLog: AuditLog = {
        user: accountUser.firstName + " " + accountUser.lastName,
        userId: accountUser.publicMetadata?._id as string,
        action: `Created New Assessment for Job Posting: ${posting.title}`,
        type: "info",
      };

      await Organization.findByIdAndUpdate(perms.data!.organization?._id, {
        $push: { auditLogs: auditLog },
      });
    }

    if (isCampus) {
      const perms = await checkInstitutePermission.all(c, ["manage_drive"]);
      if (!perms.allowed) {
        return sendError(c, 401, "Unauthorized");
      }

      const { driveId, step } = body;
      console.log("Campus Assessment" + driveId);

      const drive = await Drive.findOne({
        _id: driveId,
      }).populate("codeAssessments");

      if (!drive) {
        return sendError(c, 404, "Drive not found");
      }

      const assessmentstep = parseInt(step);
      const workflowId = drive.workflow?.steps[assessmentstep]?._id;

      await Drive.findByIdAndUpdate(driveId, {
        $push: {
          codeAssessments: {
            assessmentId: newAssessment._id,
            workflowId: workflowId,
          },
        },
        updatedOn: new Date(),
      });
    }

    if (gradingType === "testcase") {
      const problems = assessment.problems;
      for (const problem of problems) {
        const p = await Problem.findById(problem).select("testCases").lean();
        if (!p) {
          return sendError(c, 404, "Problem not found");
        }

        if (!assessment?.grading?.testcases) {
          return sendError(c, 400, "Grading not found");
        }

        for (const testCase of p.testCases) {
          if (testCase.difficulty === "easy") {
            totalScore += assessment?.grading?.testcases.easy;
          } else if (testCase.difficulty === "medium") {
            totalScore += assessment?.grading?.testcases.medium;
          } else {
            totalScore += assessment?.grading?.testcases.hard;
          }
        }
      }
    }

    if (gradingType === "problem") {
      assessment?.grading?.problem?.forEach((problem: any) => {
        totalScore += problem.points;
      });
    }

    const assessmentObj = {
      ...body,
      author: userid,
      obtainableScore: totalScore,
    };

    newAssessment.set(assessmentObj);
    await newAssessment.save();

    return sendSuccess(c, 200, "Success", newAssessment);
  } catch (error: any) {
    console.error(error);
    if (error.name === "ValidationError") {
      return sendError(c, 400, "Invalid Data", error.message);
    }
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const submitMcqAssessment = async (c: Context) => {
  try {
    const { assessmentId, email, timer, assessmentSub } = await c.req.json();
    const assessment = await MCQAssessment.findById(assessmentId).lean();

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    const submission = await MCQAssessmentSubmissions.findOne({
      assessmentId,
      email,
    });

    const receivedSub: IMCQAssessmentSubmission = assessmentSub;

    if (!submission || !receivedSub) {
      return sendError(c, 404, "Submission not found");
    }

    const offenses = submission.offenses;

    const getCheatingStatus = (offenses: any) => {
      if (!offenses) {
        return "No Copying";
      }

      if (offenses.tabChange > 5) {
        return "Heavy Copying";
      }

      return "No Copying";
    };

    // @ts-expect-error - TS doesn't allow conversion of mongoose document to object
    const grades = calculateMCQScore(receivedSub.mcqSubmissions!, assessment);

    // @ts-expect-error - TS doesn't allow conversion of mongoose document to object
    submission.obtainedGrades = grades;

    submission.timer = timer;
    submission.status = "completed";
    submission.cheatingStatus = getCheatingStatus(offenses);

    if (assessment?.isEnterprise || assessment?.isCampus) {
      const totalMarks = grades?.total || 0;
      const obtaintableMarks = assessment?.obtainableScore || 0;
      const passPercentage = assessment?.passingPercentage || 0;
      const passMarks = (passPercentage / 100) * obtaintableMarks;

      const isPassed = totalMarks >= passMarks;

      const user = await CandidateModel.findOne({
        email,
      });

      if (!user) {
        return sendError(c, 404, "User not found");
      }

      if (assessment?.isEnterprise) {
        const appliedPosting = await AppliedPosting.findOne({
          user: user._id,
          postingId: assessment.postingId,
        });

        if (!appliedPosting) {
          return sendError(c, 404, "Applied Posting not found");
        }

        appliedPosting.status = isPassed ? "inprogress" : "rejected";
        await appliedPosting.save();
      }

      if (assessment?.isCampus) {
        const appliedDrive = await AppliedDrive.findOne({
          user: user._id,
          drive: assessment.driveId,
        });

        if (!appliedDrive) {
          return sendError(c, 404, "Applied Drive not found");
        }

        appliedDrive.status = isPassed ? "inprogress" : "rejected";
        await appliedDrive.save();
      }
    }

    await submission.save();

    return sendSuccess(c, 200, "Success", grades);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const submitIndividualProblem = async (c: Context) => {
  try {
    const data = await c.req.json();
    const problem = await Problem.findById(data.problemId);
    if (!problem) {
      return;
    }

    const result = await runCompilerCode(
      data.language,
      problem.sdsl,
      data.code,
      problem.testCases as unknown as TestCase[]
    );

    if (result?.status === "ERROR") {
      console.error(result.error);
      return;
    }

    const r = result?.results?.map((r: any) => ({
      caseNo: r?.caseNo,
      caseId: r?._id,
      output: r?.output,
      isSample: r?.isSample,
      memory: r?.memory,
      time: r?.time,
      passed: r?.passed,
      console: r?.console,
    }));

    const submission = await CodeAssessmentSubmissions.findOne({
      email: data?.email,
      assessmentId: data?.assessmentId,
    });

    if (!submission) {
      return;
    }

    const problemSubmission = {
      problemId: data?.problemId,
      code: data?.code,
      language: data?.language,
      results: r,
    };

    // @ts-ignore - replace the existing submission with the new one or add a new one
    const existingSubmission = submission.submissions.find(
      (s) => s?.problemId?.toString() === data?.problemId
    );

    if (existingSubmission) {
      existingSubmission.code = data?.code;
      existingSubmission.language = data?.language;
      existingSubmission.results = r;
    } else {
      // @ts-ignore
      submission.submissions.push(problemSubmission);
    }

    await submission.save();

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error as string);
  }
};

const codeSubmit = async (c: Context) => {
  try {
    console.log("Code Submit");
    const { assessmentId, email, timer } = await c.req.json();
    const assessment = await CodeAssessment.findById(assessmentId).populate(
      "problems"
    );

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    const submission = await CodeAssessmentSubmissions.findOne({
      assessmentId,
      email,
    });

    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    const grades = await calculateCodeScore(
      // @ts-expect-error - TS doesn't know that the obtainedGrades field is added in the schema
      submission?.submissions || [],
      assessment
    );
    // @ts-ignore
    submission.obtainedGrades = grades;
    submission.timer = timer;
    submission.status = "completed";

    if (assessment?.isEnterprise || assessment?.isCampus) {
      // CHECK IF CANDIDATE HAS PASSSED OR FAILED THE ASSESSMENT
      const totalMarks = grades?.total || 0;
      const obtaintableMarks = assessment?.obtainableScore || 0;
      const passPercentage = assessment?.passingPercentage || 0;
      const passMarks = (passPercentage / 100) * obtaintableMarks;

      const isPassed = totalMarks >= passMarks;

      if (assessment?.isEnterprise) {
        const appliedPosting = await AppliedPosting.findOne({
          email,
          postingId: assessment.postingId,
        });

        if (!appliedPosting) {
          return sendError(c, 404, "Applied Posting not found");
        }

        appliedPosting.status = isPassed ? "inprogress" : "rejected";
        await appliedPosting.save();
      }

      if (assessment?.isCampus) {
        const appliedDrive = await AppliedDrive.findOne({
          email,
          drive: assessment.driveId,
        });

        if (!appliedDrive) {
          return sendError(c, 404, "Applied Posting not found");
        }

        appliedDrive.status = isPassed ? "inprogress" : "rejected";
        await appliedDrive.save();
      }
    }

    await submission.save();

    return sendSuccess(c, 200, "Success", grades);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getMcqAssessment = async (c: Context) => {
  try {
    const id = c.req.param("id");

    const assessment = await MCQAssessment.findById(id).lean();
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    return sendSuccess(c, 200, "Success", assessment);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getCodeAssessment = async (c: Context) => {
  try {
    const id = c.req.param("id");

    const assessment = await CodeAssessment.findById(id).lean();
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    return sendSuccess(c, 200, "Success", assessment);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const deleteMcqAssessment = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const auth = c.get("auth");

    const assessment = await MCQAssessment.findById(id);

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.author?.toString() !== auth?._id) {
      return sendError(c, 403, "Unauthorized");
    }

    await MCQAssessment.findByIdAndDelete(id);
    return sendSuccess(c, 200, "Assessment deleted successfully");
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const deleteCodeAssessment = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const auth = c.get("auth");

    const assessment = await CodeAssessment.findById(id);

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.author?.toString() !== auth?._id) {
      return sendError(c, 403, "Unauthorized");
    }

    await CodeAssessment.findByIdAndDelete(id);
    return sendSuccess(c, 200, "Assessment deleted successfully");
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getCreatedCodeAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const assessments = await CodeAssessment.find({ author: auth?._id });

    return sendSuccess(c, 200, "Success", assessments);
  } catch (error) {
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getCreatedMcqAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const assessments = await MCQAssessment.find({ author: auth?._id });

    return sendSuccess(c, 200, "Success", assessments);
  } catch (error) {
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const verifyAccess = async (c: Context) => {
  try {
    const body = await c.req.json();

    const [result1, result2] = await Promise.all([
      CodeAssessment.findOne({ _id: body.id }).populate("problems").lean(),
      MCQAssessment.findOne({ _id: body.id }).lean(),
    ]);

    const assessment =
      // @ts-expect-error
      (result1 as ICodeAssessment) || (result2 as IMCQAssessment);

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.isEnterprise) {
      let currentAssessmentId = null;
      const posting = await Posting.findOne({
        _id: assessment.postingId,
      }).populate("candidates");
      if (!posting) {
        return sendError(c, 404, "Posting not found");
      }

      const workflow = posting.workflow;
      if (!workflow) {
        return sendError(c, 400, "No workflow found");
      }

      const currentStepIndex =
        workflow.steps.findIndex((step) => step.status === "in-progress") ?? 0;

      const currentStep = workflow.steps[currentStepIndex];

      console.log(currentStep);
      if (currentStep.type === "CODING_ASSESSMENT") {
        currentAssessmentId = posting?.codeAssessments.find(
          (assessment) =>
            assessment.workflowId.toString() === currentStep._id?.toString()
        )?.assessmentId;
      } else if (currentStep.type === "MCQ_ASSESSMENT") {
        currentAssessmentId = posting?.mcqAssessments.find(
          (assessment) =>
            assessment.workflowId?.toString() === currentStep._id?.toString()
        )?.assessmentId;
      }

      console.log(currentAssessmentId, assessment._id);

      if (currentAssessmentId?.toString() !== assessment?._id?.toString()) {
        return sendError(c, 403, "Assessment not active", {
          allowedForTest: false,
          testActive: false,
        });
      }

      const candidates = posting.candidates as unknown as Candidate[];
      if (!candidates.some((candidate) => candidate.email === body.email)) {
        return sendError(
          c,
          403,
          "You are not allowed to take this assessment",
          {
            allowedForTest: false,
            testActive: true,
          }
        );
      }
    } else if (assessment.isCampus) {
      const drive = await Drive.findOne({
        _id: assessment.driveId,
      }).populate("candidates");

      if (!drive) {
        return sendError(c, 404, "Drive not found");
      }

      const candidates = drive.candidates as unknown as Candidate[];
      if (!candidates.some((candidate) => candidate.email === body.email)) {
        return sendError(
          c,
          403,
          "You are not allowed to take this assessment",
          {
            allowedForTest: false,
            testActive: true,
          }
        );
      }
    } else {
      const assessmentStartTime = new Date(
        assessment?.openRange?.start!
      ).getTime();
      const assessmentEndTime = new Date(assessment?.openRange?.end!).getTime();

      const currentTime = new Date().getTime();
      if (currentTime < assessmentStartTime) {
        return sendError(c, 403, "Assessment not started yet", {
          allowedForTest: false,
          testActive: false,
        });
      }

      if (currentTime > assessmentEndTime) {
        return sendError(c, 403, "Assessment has ended", {
          allowedForTest: false,
          testActive: false,
        });
      }
    }

    const codeTakenAssessment = await CodeAssessmentSubmissions.findOne({
      assessmentId: body.id,
      email: body.email,
    });

    const mcqTakenAssessment = await MCQAssessmentSubmissions.findOne({
      assessmentId: body.id,
      email: body.email,
    });

    if (codeTakenAssessment || mcqTakenAssessment) {
      return sendError(c, 403, "You have already taken this assessment", {
        allowedForTest: false,
        testActive: true,
      });
    }

    if (assessment) {
      return sendSuccess(c, 200, "Access Granted", {
        instructions: assessment.instructions,
        type: result1 ? "code" : "mcq",
        assessment: assessment,
      });
    }

    // @ts-expect-error
    const candidate = (
      assessment as IMCQAssessment | ICodeAssessment
    ).candidates.find((candidate) => candidate.email === body.email);

    if (!candidate) {
      return sendError(c, 403, "You are not allowed to take this assessment", {
        allowedForTest: false,
        testActive: true,
      });
    }

    return sendSuccess(c, 200, "Access Granted", {
      // @ts-expect-error
      instructions: assessment.instructions,
      assessment: assessment,
    });
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const checkCodeProgress = async (c: Context) => {
  try {
    const body = await c.req.json();

    const [result1, result2] = await Promise.all([
      CodeAssessment.findOne({ _id: body.assessmentId })
        .populate("problems")
        .lean(),
      MCQAssessment.findOne({ _id: body.assessmentId }).lean(),
    ]);

    const assessment = result1 || result2;
    const type = result1 ? "code" : "mcq";

    let submission;

    if (type === "code") {
      submission = await CodeAssessmentSubmissions.findOne({
        email: body.email,
        assessmentId: body.assessmentId,
      });
    } else {
      submission = await MCQAssessmentSubmissions.findOne({
        email: body.email,
        assessmentId: body.assessmentId,
      });
    }

    if (!submission) {
      return sendSuccess(c, 200, "Submission not found", { exists: false });
    }

    if (submission.status === "completed") {
      return sendSuccess(c, 200, "Submission completed", {
        exists: false,
        status: "completed",
        type,
      });
    }

    return sendSuccess(c, 200, "Success", {
      assessment,
      submission,
      type,
    });
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const checkMcqProgress = async (c: Context) => {
  try {
    const body = await c.req.json();

    const assessment = await MCQAssessment.findOne({
      _id: body.assessmentId,
    }).lean();

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    const submission = await MCQAssessmentSubmissions.findOne({
      email: body.email,
      assessmentId: body.assessmentId,
    });

    if (!submission) {
      return sendSuccess(c, 200, "Submission not found", { exists: false });
    }

    if (submission.status === "completed") {
      return sendSuccess(c, 200, "Submission completed", {
        exists: false,
        status: "completed",
      });
    }

    return sendSuccess(c, 200, "Success", { assessment, submission });
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getTakenMcqAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");

    const submissions = await MCQAssessmentSubmissions.find({
      email: auth?.email,
    });

    const takenAssessments = [];

    for (const submission of submissions) {
      const assessment = await MCQAssessment.findById(submission.assessmentId);
      if (!assessment) {
        continue;
      }

      takenAssessments.push({
        assessment,
        submission,
      });
    }

    return sendSuccess(c, 200, "Success", takenAssessments);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getTakenCodeAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");

    const submissions = await CodeAssessmentSubmissions.find({
      email: auth?.email,
    });

    const takenAssessments = [];

    for (const submission of submissions) {
      const assessment = await CodeAssessment.findById(submission.assessmentId);
      if (!assessment) {
        continue;
      }

      takenAssessments.push({
        assessment,
        submission,
      });
    }

    return sendSuccess(c, 200, "Success", takenAssessments);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getAssessmentSubmissions = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const id = c.req.param("id");
    const postingId = c.req.param("postingId");
    const driveId = c.req.param("driveId");

    const queries = await Promise.all([
      CodeAssessment.findById(id).lean(),
      MCQAssessment.findById(id).lean(),
    ]);

    const assessment =
      // @ts-expect-error
      (queries[0] as ICodeAssessment) || (queries[1] as IMCQAssessment);
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.isEnterprise && postingId) {
      if (assessment?.postingId?.toString() !== postingId) {
        return sendError(c, 403, "Unauthorized");
      }
    } else if (assessment.isCampus) {
      if (assessment?.driveId?.toString() !== driveId) {
        return sendError(c, 403, "Unauthorized");
      }
    } else {
      if (assessment.author !== auth?._id) {
        return sendError(c, 403, "Unauthorized");
      }
    }

    const subQueries = await Promise.all([
      CodeAssessmentSubmissions.find({
        assessmentId: id,
      }).lean(),
      MCQAssessmentSubmissions.find({
        assessmentId: id,
      }).lean(),
    ]);

    const submissions = subQueries[0].length ? subQueries[0] : subQueries[1];
    const finalSubmissions = [];

    const getTimeUsed = (time: number) => {
      const totalTime = assessment.timeLimit * 60;
      const timeTaken = totalTime - time;
      return timeTaken;
    };

    const checkPassed = async (submission: any) => {
      const score = submission?.obtainedGrades?.total || 0;
      const totalScore = assessment.obtainableScore;
      const passingPercentage = assessment.passingPercentage;
      const percentage = (score / totalScore) * 100;
      return percentage >= passingPercentage;
    };

    if (!postingId) {
      for (const submission of submissions) {
        finalSubmissions.push({
          _id: submission._id,
          name: submission.name,
          email: submission.email,
          timer: getTimeUsed(submission.timer),
          createdAt: submission.createdAt,
          cheating: submission.cheatingStatus,
          score: submission.obtainedGrades,
          passed: await checkPassed(submission),
        });
      }
    } else {
      for (const submission of submissions) {
        const posting = await Posting.findById(postingId).populate(
          "candidates"
        );

        if (!posting) {
          return sendError(c, 404, "Posting not found");
        }

        const candidate = (posting.candidates as unknown as Candidate[]).find(
          (candidate) => candidate.email === submission.email
        );

        if (!candidate) {
          return sendError(c, 404, "Candidate not found");
        }

        const appliedPostings = AppliedPosting.find({
          candidateId: candidate._id,
        });

        if (!appliedPostings) {
          return sendError(c, 404, "Applied Postings not found");
        }

        const status = appliedPostings.find(
          (ap: IAppliedPosting) => ap.posting.toString() === postingId
        );

        finalSubmissions.push({
          _id: submission._id,
          name: submission.name,
          email: submission.email,
          timer: getTimeUsed(submission.timer),
          createdAt: submission.createdAt,
          cheating: submission.cheatingStatus,
          score: submission.obtainedGrades,
          passed: await checkPassed(submission),
          status: status,
        });
      }
    }

    const qualified = finalSubmissions.filter((s) => s.passed === true).length;

    const totalSubmissions = finalSubmissions.length;
    const noCopy = finalSubmissions.filter(
      (s) => s.cheating === "No Copying"
    ).length;
    const lightCopy = finalSubmissions.filter(
      (s) => s.cheating === "Light Copying"
    ).length;
    const heavyCopy = finalSubmissions.filter(
      (s) => s.cheating === "Heavy Copying"
    ).length;

    const resObj = {
      totalSubmissions,
      qualified,
      cheating: {
        no: noCopy,
        light: lightCopy,
        heavy: heavyCopy,
      },
      submissions: finalSubmissions,
    };

    return sendSuccess(c, 200, "Success", resObj);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getAssessmentSubmission = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const id = c.req.param("id");
    const submissionId = c.req.param("submissionId");
    const postingId = c.req.param("postingId");

    const queries = await Promise.all([
      CodeAssessment.findById(id).lean(),
      MCQAssessment.findById(id).lean(),
    ]);

    // @ts-expect-error
    const assessment: IMCQAssessment | ICodeAssessment | null = queries[0]
      ? queries[0]
      : queries[1];
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    const subQueries = await Promise.all([
      CodeAssessmentSubmissions.findById(submissionId).lean(),
      MCQAssessmentSubmissions.findById(submissionId).lean(),
    ]);

    const submission = subQueries[0] ? subQueries[0] : subQueries[1];

    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.isEnterprise && postingId) {
      if (assessment?.postingId?.toString() !== postingId) {
        return sendError(c, 403, "Unauthorized in Posts");
      }
    } else if (assessment.isCampus) {
      if (assessment?.driveId?.toString() !== postingId) {
        return sendError(c, 403, "Unauthorized in Drive");
      }
    } else {
      if (assessment.author !== auth?._id) {
        return sendError(c, 403, "Unauthorized");
      }
    }

    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    return sendSuccess(c, 200, "Success", { submission, assessment });
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getPostingMCQAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const postingId = c.req.param("postingId");

    const perms = await checkOrganizationPermission.all(c, ["view_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(postingId)
      .populate("mcqAssessments.assessmentId")
      .populate("organizationId");

    if (!posting) {
      return sendError(c, 404, "Posting not found");
    }

    if (
      // @ts-expect-error
      posting?.organizationId?.members?.filter(
        (member: Member) => member?.user?.toString() === auth?._id.toString()
      ).length === 0
    ) {
      return sendError(c, 401, "Unauthorized");
    }

    const assessments = posting.mcqAssessments.map(
      (assessment: any) => assessment.assessmentId
    );

    return sendSuccess(c, 200, "Success", assessments);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getPostingCodeAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const postingId = c.req.param("postingId");

    const perms = await checkOrganizationPermission.all(c, ["view_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const posting = await Posting.findById(postingId)
      .populate("codeAssessments.assessmentId")
      .populate("organizationId");

    if (!posting) {
      return sendError(c, 404, "Posting not found");
    }

    if (
      // @ts-expect-error
      posting?.organizationId?.members?.filter(
        (member: Member) => member?.user?.toString() === auth?._id.toString()
      ).length === 0
    ) {
      return sendError(c, 401, "Unauthorized");
    }

    const assessments = posting.codeAssessments.map(
      (assessment: any) => assessment.assessmentId
    );

    return sendSuccess(c, 200, "Success", assessments);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getDriveMCQAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const driveId = c.req.param("driveId");

    const perms = await checkInstitutePermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findById(driveId)
      .populate("mcqAssessments.assessmentId")
      .populate("institute");

    if (!drive) {
      return sendError(c, 404, "Drive not found");
    }

    if (
      // @ts-expect-error
      drive?.institute?.members?.filter(
        (member: Member) => member?.user?.toString() === auth?._id.toString()
      ).length === 0
    ) {
      return sendError(c, 401, "Unauthorized");
    }

    const assessments = drive.mcqAssessments.map(
      (assessment: any) => assessment.assessmentId
    );

    return sendSuccess(c, 200, "Success", assessments);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getDriveCodeAssessments = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const driveId = c.req.param("driveId");

    const perms = await checkInstitutePermission.all(c, ["view_drive"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const drive = await Drive.findById(driveId)
      .populate("codeAssessments.assessmentId")
      .populate("institute");

    if (!drive) {
      return sendError(c, 404, "Drive not found");
    }

    if (
      // @ts-expect-error
      drive?.institute?.members?.filter(
        (member: Member) => member?.user?.toString() === auth?._id.toString()
      ).length === 0
    ) {
      return sendError(c, 401, "Unauthorized");
    }

    const assessments = drive.codeAssessments.map(
      (assessment: any) => assessment.assessmentId
    );

    return sendSuccess(c, 200, "Success", assessments);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getMcqAssessmentSubmissions = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const assessmentId = c.req.param("id");

    const assessment = await MCQAssessment.findById(assessmentId);
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.author !== auth?._id) {
      if (assessment.isEnterprise) {
        const perms = await checkOrganizationPermission.all(c, ["view_job"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else if (assessment.isCampus) {
        const perms = await checkInstitutePermission.all(c, ["view_drive"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else return sendError(c, 403, "Unauthorized");
    }

    const submissions = await MCQAssessmentSubmissions.find({
      assessmentId,
    });

    return sendSuccess(c, 200, "Success", { submissions, assessment });
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getCodeAssessmentSubmissions = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const assessmentId = c.req.param("id");

    console.log(assessmentId);

    const assessment = await CodeAssessment.findById(assessmentId);
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.author !== auth?._id) {
      if (assessment.isEnterprise) {
        const perms = await checkOrganizationPermission.all(c, ["view_job"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else if (assessment.isCampus) {
        const perms = await checkInstitutePermission.all(c, ["view_drive"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else return sendError(c, 403, "Unauthorized");
    }

    const submissions = await CodeAssessmentSubmissions.find({
      assessmentId,
    });

    return sendSuccess(c, 200, "Success", { submissions, assessment });
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getMcqAssessmentSubmission = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const submissionId = c.req.param("submissionId");

    const submission = await MCQAssessmentSubmissions.findById(
      submissionId
    ).populate("assessmentId");
    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    const assessment = await MCQAssessment.findById(submission.assessmentId);
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.author !== auth?._id) {
      if (assessment.isEnterprise) {
        const perms = await checkOrganizationPermission.all(c, ["view_job"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else if (assessment.isCampus) {
        const perms = await checkInstitutePermission.all(c, ["view_drive"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else return sendError(c, 403, "Unauthorized");
    }

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getCodeAssessmentSubmission = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const submissionId = c.req.param("submissionId");

    const submission = await CodeAssessmentSubmissions.findById(submissionId)
      .populate("assessmentId")
      .populate("submissions.problemId");
    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    const assessment = await CodeAssessment.findById(submission.assessmentId);
    if (!assessment) {
      return sendError(c, 404, "Assessment not found");
    }

    if (assessment.author !== auth?._id) {
      if (assessment.isEnterprise) {
        const perms = await checkOrganizationPermission.all(c, ["view_job"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else if (assessment.isCampus) {
        const perms = await checkInstitutePermission.all(c, ["view_drive"]);
        if (!perms.allowed) {
          return sendError(c, 401, "Unauthorized");
        }
      } else return sendError(c, 403, "Unauthorized");
    }

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const capture = async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const image = formData.get("image");
    const timestamp = new Date().getTime();
    const assessmentId = formData.get("assessmentId");
    const assessmentType = formData.get("assessmentType");
    const email = formData.get("email");

    if (!image || !(image instanceof File)) {
      return sendError(c, 400, "Invalid image file");
    }

    const uploadParams = {
      Bucket: process.env.R2_S3_ASSESSMENT_CAMERA_CAPTURE_BUCKET!,
      Key: `${assessmentType}/${assessmentId}/${email}/${timestamp}.png`,
      Body: image,
      ContentType: image.type,
    };

    const upload = new Upload({
      client: r2Client,
      params: uploadParams,
    });

    await upload.done();

    return sendSuccess(c, 200, "Success");
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const getCaptures = async (c: Context) => {
  const assessmentId = c.req.param("id");
  const assessmentType = c.req.param("type");
  const email = c.req.param("email");

  const folderPrefix = `${assessmentType}/${assessmentId}/${email}/`;

  console.log(folderPrefix);

  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_S3_ASSESSMENT_CAMERA_CAPTURE_BUCKET!,
      Prefix: folderPrefix,
    });

    const response = await r2Client.send(command);

    if (!response.Contents) {
      return sendSuccess(c, 200, "Success", []);
    }

    const imageUrls: { url: string; timestamp: string }[] = [];

    for (const content of response.Contents) {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_S3_ASSESSMENT_CAMERA_CAPTURE_BUCKET!,
        Key: content.Key,
      });

      const url = await getSignedUrl(r2Client, command, { expiresIn: 600 });
      imageUrls.push({
        url: url,
        timestamp: content?.Key?.split("/")?.pop()?.split(".")[0] || "",
      });
    }

    console.log(imageUrls);
    return sendSuccess(c, 200, "Success", imageUrls);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const gradeMCQAnswer = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const body = await c.req.json();
    const { submissionId, mcqId, grade } = body;
    console.log(body);

    const submission = await MCQAssessmentSubmissions.findById(submissionId);
    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    if (!submission.obtainedGrades)
      return sendError(c, 400, "Grades not found");

    if (!submission.obtainedGrades?.mcq) {
      // @ts-ignore
      submission.obtainedGrades.mcq = [];
    }

    const mcq = submission?.obtainedGrades?.mcq?.find(
      (mcq) => mcq.mcqId.toString() === mcqId.toString()
    );

    if (mcq) {
      submission.obtainedGrades.total += grade - mcq.obtainedMarks;
      mcq.obtainedMarks = grade;
    } else {
      const newMCQ = {
        mcqId: mcqId,
        obtainedMarks: grade,
      };
      submission.obtainedGrades.total += grade;
      submission.obtainedGrades?.mcq?.push(newMCQ);
    }

    if (!submission.reviewedBy?.includes(auth?._id)) {
      submission?.reviewedBy?.push(auth?._id);
    }

    await submission.save();

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const gradeCodeAnswer = async (c: Context) => {
  try {
    const auth = c.get("auth");
    const body = await c.req.json();
    const { submissionId, problemId, grade } = body;

    const submission = await CodeAssessmentSubmissions.findById(submissionId);
    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    if (!submission.obtainedGrades)
      return sendError(c, 400, "Grades not found");

    if (!submission.obtainedGrades) {
      // @ts-ignore
      submission.obtainedGrades = [];
    }

    const code = submission?.obtainedGrades?.problem?.find(
      (p) => p.problemId.toString() === problemId.toString()
    );

    console.log(code);
    console.log(grade);

    if (code) {
      // @ts-ignore
      submission.obtainedGrades.total += grade - code.obtainedMarks;
      code.obtainedMarks = grade;
    } else {
      const newCode = {
        problemId: problemId,
        obtainedMarks: grade,
      };

      // @ts-ignore
      submission.obtainedGrades.total += grade;
      submission.obtainedGrades?.problem?.push(newCode);
    }

    if (!submission.reviewedBy?.includes(auth?._id)) {
      submission?.reviewedBy?.push(auth?._id);
    }

    await submission.save();

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const saveReview = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { submissionId } = body;

    const submission = await MCQAssessmentSubmissions.findById(submissionId);
    if (!submission) {
      return sendError(c, 404, "Submission not found");
    }

    submission.isReviewed = true;
    await submission.save();

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

export default {
  checkCodeProgress,
  codeSubmit,
  submitIndividualProblem,
  createMcqAssessment,
  createCodeAssessment,
  getMcqAssessment,
  getCodeAssessment,
  deleteMcqAssessment,
  deleteCodeAssessment,
  getCreatedCodeAssessments,
  getCreatedMcqAssessments,
  getTakenMcqAssessments,
  getTakenCodeAssessments,
  verifyAccess,
  checkMcqProgress,
  submitMcqAssessment,
  getAssessmentSubmissions,
  getAssessmentSubmission,
  getPostingMCQAssessments,
  getPostingCodeAssessments,
  getMcqAssessmentSubmissions,
  getCodeAssessmentSubmissions,
  getMcqAssessmentSubmission,
  getCodeAssessmentSubmission,
  capture,
  getCaptures,
  gradeMCQAnswer,
  gradeCodeAnswer,
  saveReview,
  getDriveMCQAssessments,
  getDriveCodeAssessments,
};
