import { Context } from "hono";
import { sendError, sendSuccess } from "../../utils/sendResponse";
import Problem from "../../models/Problem";
import { runCode as runCompilerCode } from "../../aws/runCode";
import { Console } from "console";
import Submission from "../../models/Submission";
import User from "../../models/User";

const runCode = async (c: Context) => {
  try {
    const cached = c.get("cached") || false;
    if (cached) {
      return sendSuccess(c, 200, "Success", JSON.parse(c.get("cachedData")));
    }

    const body = await c.req.json();
    const prob = await Problem.findOne({ _id: body.problemId });
    if (!prob) {
      return sendError(c, 404, "Problem Not Found");
    }

    const functionSchema = {
      functionName: prob.functionName,
      functionArgs: prob.functionArgs,
      functionBody: body.code,
      functionReturn: prob.functionReturnType,
    };

    const result = await runCompilerCode(
      body.language,
      functionSchema,
      prob.testCases
    );

    if (result?.status === "ERROR") {
      console.log(result.error);
      return sendError(c, 500, "Internal Server Error", result.error);
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

    const functionSchema = {
      functionName: prob.functionName,
      functionArgs: prob.functionArgs,
      functionBody: body.code,
      functionReturn: prob.functionReturnType,
    };

    const result = await runCompilerCode(
      body.language,
      functionSchema,
      prob.testCases
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

    const submission = new Submission({
      problem: body.problemId,
      user: c.get("auth").userId,
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
      const user = await User.findOne({ clerkId: c.get("auth").userId });

      user?.streak.push(date);
      await user?.save();
    }

    prob.totalSubmissions += 1;
    if (result.failedCaseNo === -1) {
      prob.successfulSubmissions += 1;
    }

    await prob.save();

    await submission.save();

    return sendSuccess(c, 200, "Success", submission);
  } catch (error) {
    return sendError(c, 500, "Internal Server Error", error);
  }
};

export default { runCode, submitCode };
