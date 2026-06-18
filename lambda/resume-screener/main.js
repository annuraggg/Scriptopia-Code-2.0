import "dotenv/config";
import mongoose from "mongoose";
import Candidate from "./Candidate.js";
import Posting from "./Posting.js";
import AppliedPosting from "./AppliedPosting.js";

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const MONGODB_TIMEOUT = 5000; // 5 seconds
const CF_API_ENDPOINT = "https://api.cloudflare.com/client/v4/accounts/2ff2ec5b4b7853ab47fda4fa989403f7/ai/run";
const LOOPS_API_ENDPOINT = "https://app.loops.so/api/v1/transactional";

// Logger utility
const createLog = (level, stage, message, error = null, metadata = {}) => ({
  level,
  stage,
  timestamp: new Date(),
  message,
  ...(error && {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }),
  ...(Object.keys(metadata).length > 0 && { metadata })
});

// Enhanced MongoDB connection with timeout and retry
const connectToMongoDB = async (posting) => {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const connectionPromise = mongoose.connect(process.env.MONGO_URI, {
        dbName: process.env.MONGO_DB,
        connectTimeoutMS: MONGODB_TIMEOUT,
      });
      await mongoose.connect(process.env.MONGO_URI, {
        dbName: process.env.MONGO_DB,
        connectTimeoutMS: MONGODB_TIMEOUT,
      });
      return;
    } catch (error) {
      retries++;

      if (retries === MAX_RETRIES) {
        throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

// Enhanced API call function with timeout and better error handling
const runApiCall = async (model, input, posting) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const startTime = Date.now();
    const response = await fetch(`${CF_API_ENDPOINT}/${model}`, {
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      method: "POST",
      body: JSON.stringify(input),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    posting.ats.logs.push(createLog('INFO', 'RESUME_PROCESSING', 'API call successful', null, {
      processingTime,
      model
    }));
    await posting.save();

    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      error.message = 'API call timed out';
    }
    posting.ats.logs.push(createLog('ERROR', 'RESUME_PROCESSING', 'API call failed', error));
    await posting.save();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// Enhanced email sending function
const sendMail = async (transactionalId, event, posting) => {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const startTime = Date.now();
      const response = await fetch(LOOPS_API_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: event.mailData.email,
          transactionalId: transactionalId,
          dataVariables: {
            name: event.mailData.name,
            posting: event.mailData.posting,
            resumeScreenUrl: event.mailData.resumeScreenUrl
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Mail API responded with status: ${response.status}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      posting.ats.logs.push(createLog('INFO', 'EMAIL', 'Email sent successfully', null, {
        processingTime,
        transactionalId
      }));
      await posting.save();

      return result;
    } catch (error) {
      retries++;
      posting.ats.logs.push(createLog('ERROR', 'EMAIL', 'Email sending failed', error, { retryCount: retries }));
      await posting.save();

      if (retries === MAX_RETRIES) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

// Enhanced candidate posting update function
const updateCandidatePosting = async (candidate, postingId, finalResp, posting) => {
  try {
    const startTime = Date.now();
    const [appliedPosting, postingDoc] = await Promise.all([
      AppliedPosting.findOne({ user: candidate?._id, posting: postingId }).exec(),
      Posting.findById(postingId)
    ]);

    if (!appliedPosting || !postingDoc) {
      throw new Error('Applied posting or posting not found');
    }

    const stageId = postingDoc.workflow.steps.find(step => step.type === "RESUME_SCREENING")?._id;
    if (!stageId) {
      throw new Error('Resume screening stage not found');
    }

    const score = {
      stageId,
      score: finalResp.match,
      reason: finalResp.reason,
      timestamp: new Date()
    };

    appliedPosting.scores = appliedPosting.scores || [];
    appliedPosting.scores.push(score);
    appliedPosting.status = finalResp.match >= posting?.ats?.minimumScore ? "inprogress" : "rejected"

    await appliedPosting.save();

    const processingTime = Date.now() - startTime;
    posting.ats.logs.push(createLog('INFO', 'DATABASE', 'Updated candidate posting', null, {
      candidateId: candidate._id,
      processingTime,
      score: finalResp.match
    }));
    await posting.save();

    return true;
  } catch (error) {
    posting.ats.logs.push(createLog('ERROR', 'DATABASE', 'Failed to update candidate posting', error, {
      candidateId: candidate?._id
    }));
    await posting.save();
    return false;
  }
};

// Enhanced resume processing function
const processResume = async (resume, event, posting) => {
  const startTime = Date.now();
  try {
    posting.ats.logs.push(createLog('INFO', 'RESUME_PROCESSING', 'Started processing resume', null, {
      candidateId: resume.candidateId
    }));

    const content = generatePrompt({
      jobDescription: event.jobDescription,
      skills: event.skills,
      negativePrompts: event.negativePrompts,
      positivePrompts: event.positivePrompts,
      resume: resume.resume,
    });

    const response = await runApiCall("@cf/meta/llama-3-8b-instruct", {
      messages: [{ role: "user", content }]
    }, posting);

    const finalResp = JSON.parse(response.result.response);
    const candidate = await Candidate.findById(resume.candidateId);

    if (!candidate) {
      throw new Error(`Candidate not found: ${resume.candidateId}`);
    }

    await updateCandidatePosting(candidate, event.postingId, finalResp, posting);

    const processingTime = Date.now() - startTime;
    posting.ats.logs.push(createLog('INFO', 'RESUME_PROCESSING', 'Completed processing resume', null, {
      candidateId: resume.candidateId,
      processingTime,
      score: finalResp.match
    }));
    await posting.save();

    return finalResp;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    posting.ats.logs.push(createLog('ERROR', 'RESUME_PROCESSING', 'Failed to process resume', error, {
      candidateId: resume.candidateId,
      processingTime
    }));
    await posting.save();
    throw error;
  }
};

const generatePrompt = (event) => `
  ASSUME YOU ARE A Resume Screener
  Here is a job description (JD):
  ${event.jobDescription}

  Skills required (comma separated):
  ${event.skills}

  Negative Prompts (Things you don't want to see in the resume but are not deal breakers):
  ${event.negativePrompts}

  Positive Prompts (Things you want to see in the resume but are not deal makers):
  ${event.positivePrompts}

  I HAVE THE FOLLOWING CANDIDATE RESUME (The actual resume of the candidate):
  ${event.resume}

  Please account for the following:
  - The match percent should be between 0-100
  - The reason should be a string
  - Account for similar skills (e.g. JavaScript and JS should be considered the same)

  Give the following JSON output. PLEASE GIVE ONLY JSON AND NOTHING ELSE:
  {
    match: the match percent of candidate with JD (between 0-100),
    reason: the reason for the match (string),
  }
`;

// Main handler with enhanced logging
export const handler = async (event) => {
  let posting;
  const startTime = Date.now();

  try {
    // Connect to MongoDB
    await connectToMongoDB(posting);


    // Get posting first to enable logging
    posting = await Posting.findById(event.postingId);
    if (!posting) {
      throw new Error(`Posting not found: ${event.postingId}`);
    }

    // Initialize ATS if needed
    posting.ats = posting.ats || {};
    posting.ats.logs = posting.ats.logs || [];
    posting.ats.status = "processing";
    posting.ats.startTime = new Date();
    posting.ats.logs.push(createLog('INFO', 'INIT', 'Started processing job posting', null, {
      totalResumes: event.resumes.length
    }));
    await posting.save();

    // Process resumes
    const processingResults = await Promise.allSettled(
      event.resumes.map(resume => processResume(resume, event, posting))
    );

    // Calculate results
    const failures = processingResults.filter(result => result.status === 'rejected');
    const successCount = processingResults.length - failures.length;
    const failedCount = failures.length;
    const totalTime = Date.now() - startTime;

    // Update posting status and summary
    posting.ats.status = failures.length === processingResults.length ? "failed" : "finished";
    posting.ats.endTime = new Date();
    posting.ats.failedCount = failedCount;
    posting.ats.successCount = successCount;
    posting.ats.summary = {
      totalProcessed: processingResults.length,
      successfulProcessing: successCount,
      failedProcessing: failedCount,
      totalTime,
      averageProcessingTime: totalTime / processingResults.length
    };

    posting.ats.logs.push(createLog('INFO', 'PROCESSING', 'Completed processing all resumes', null, {
      successCount,
      failedCount,
      totalTime
    }));
    await posting.save();

    // Send appropriate email
    const emailResult = await sendMail(
      failures.length === 0 ? "cm7fx3zu1001w136umtdy939y" : "cm7fxd2gz06e711u3zm16c6bv",
      event,
      posting
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Processing completed",
        successCount,
        failureCount: failedCount,
        emailResult
      })
    };
  } catch (error) {
    if (posting) {
      posting.ats.status = "failed";
      posting.ats.endTime = new Date();
      posting.ats.error = error.message;
      posting.ats.logs.push(createLog('ERROR', 'PROCESSING', 'Processing failed', error, {
        totalTime: Date.now() - startTime
      }));
      await posting.save();

      // Try to send failure email
      try {
        await sendMail("cm7fxd2gz06e711u3zm16c6bv", event, posting);
      } catch (emailError) {
        posting.ats.logs.push(createLog('ERROR', 'EMAIL', 'Failed to send failure notification email', emailError));
        await posting.save();
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message
      })
    };
  } finally {
    // Ensure MongoDB connection is closed
    try {
      await mongoose.connection.close();
    } catch (error) {
      if (posting) {
        posting.ats.logs.push(createLog('ERROR', 'DATABASE', 'Failed to close MongoDB connection', error));
        await posting.save();
      }
    }
  }
};