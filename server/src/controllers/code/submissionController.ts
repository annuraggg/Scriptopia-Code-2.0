import { Context } from "hono";
import { sendError, sendSuccess } from "../../utils/sendResponse";
import Problem from "../../models/Problem";
import { runCode as runCompilerCode } from "../../utils/runCode";
import User from "../../models/User";
import { TestCase } from "@shared-types/Problem";
import Submission from "@/models/Submission";

const runCode = async (c: Context) => {
  try {
    const body = await c.req.json();
    const prob = await Problem.findOne({ _id: body.problemId });

    if (!prob) {
      return sendError(c, 404, "Problem Not Found");
    }

    if (!prob) {
      return sendError(c, 404, "Problem Not Found");
    }

    const result = await runCompilerCode(
      body.language,
      prob.sdsl,
      body.code,
      prob.testCases as unknown as TestCase[]
    );

    if (!result) {
      return sendSuccess(c, 200, "Success", result);
    }

    if (result?.status === "ERROR") {
      console.error(result.error);
    }

    return sendSuccess(c, 200, "Success", result);
  } catch (error) {
    return sendError(c, 500, "Internal Server Error", error);
  }
};

const submitCode = async (c: Context) => {
  try {
    const body = await c.req.json();
    const prob = await Problem.findOne({ _id: body.problemId });
    if (!prob) {
      return sendError(c, 404, "Problem Not Found");
    }

    const result = await runCompilerCode(
      body.language,
      prob.sdsl,
      body.code,
      prob.testCases as unknown as TestCase[]
    );

    const results = result.results.map((r: any) => ({
      caseNo: r.caseNo,
      caseId: r._id,
      output: r.output,
      isSample: r.isSample,
      memory: r.memory,
      time: r.time,
      passed: r.passed,
      console: r.console,
    }));

    // @ts-ignore
    const auth = c.get("auth");
    const u = auth?._id;
    if (!u) {
      return sendError(c, 401, "Unauthorized");
    }

    const submission = new Submission({
      problem: body.problemId,
      user: u,
      code: body.code,
      language: body.language,
      status: result.failedCaseNo === -1 ? "SUCCESS" : "FAILED",
      avgMemory: result.avgMemory,
      avgTime: result.avgTime,
      failedCaseNumber: result.failedCaseNo,
      results: results,
      meta: {
        driver: result.driver,
        timestamp: result.timestamp,
      },
    });

    if (result.failedCaseNo === -1) {
      const date = new Date();
      const user = await User.findOne({ _id: u });

      if (user) {
        user.streak.push(date);

        await user.save();
      }
    }

    prob.totalSubmissions += 1;
    if (result.failedCaseNo === -1) {
      console.log("Success");
      prob.successfulSubmissions += 1;
      const acceptanceRate =
        (prob.successfulSubmissions / prob.totalSubmissions) * 100;
      prob.acceptanceRate = acceptanceRate;
    }

    await prob.save();
    console.log(result.STATUS);
    if (result.STATUS === "PASSED") {
      await submission.save();
    } else {
      return sendError(c, 400, "Submission Failed", result);
    }

    return sendSuccess(c, 200, "Success", {
      submission,
      result,
    });
  } catch (error) {
    console.log(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

export default { runCode, submitCode };
