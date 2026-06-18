import { Context } from "hono";
import { sendError, sendSuccess } from "../../utils/sendResponse";
import Problem from "../../models/Problem";
import User from "../../models/User";

const getHome = async (c: Context) => {
  try {
    const problems = await Problem.find().limit(20).lean();
    const dupTabs = problems.map((problem) => problem.tags).flat();
    const tags = [...new Set(dupTabs)];

    const user = await User.findOne({ userId: c.get("auth").userId }).lean();

    if (!user) {
      return sendError(c, 401, "Unauthorized");
    }

    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;

    const solvedProblems: string[] = [];

    const response = {
      problems,
      tags,
      streak: user.streak,
      solvedProblems,
      problemsCount: { easy: easyCount, medium: mediumCount, hard: hardCount },
    };

    return sendSuccess(c, 200, "Success", response);
  } catch (error) {
    console.error(error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

export default {
  getHome,
};
