import { Context } from "hono";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import Institute from "../../../models/Institute";
import User from "../../../models/User";
import { User as IUser } from "@shared-types/User";
import jwt from "jsonwebtoken";
import loops from "../../../config/loops";
import userDirectory from "@/services/userDirectory";
import logger from "../../../utils/logger";
import r2Client from "../../../config/s3";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  AuditLog,
  Institute as IInstitute,
  Member,
  Role,
} from "@shared-types/Institute";
import defaultInstituteRoles from "@shared-data/defaultInstituteRoles";
import institutePermissions from "@/data/institutePermissions";
import checkInstitutePermission from "@/middlewares/checkInstitutePermission";
import { UserMeta } from "@shared-types/UserMeta";
import CandidateModel from "@/models/Candidate";
import { Types } from "mongoose";
import Candidate from "@/models/Candidate";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mongoose from "mongoose";
import {
  sanitizeInput,
  validateEmail,
  validateWebsite,
} from "@/utils/validation";
import getCampusUsersWithPermission from "@/utils/getUserWithPermission";
import {
  sendNotificationToCampus,
  sendNotificationToCandidate,
} from "@/utils/sendNotification";
import generateSampleInstituteData from "@/utils/generateSampleInstituteData";
import {
  generateMockData as generateInstituteMockData,
  getMockDataStatus as readMockDataStatus,
  removeMockData as removeInstituteMockData,
} from "@/services/mockDataManager";

const TOKEN_EXPIRY = "24h";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg"];
// const MAX_RESUME_SIZE = 10 * 1024 * 1024;

/**
 * Create a new institute
 */
const createInstitute = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, email, website, address, members, sampleData } = body;

    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedWebsite = sanitizeInput(website);
    const sanitizedAddress = address;

    console.log(sanitizedAddress);

    const accountUserId = c.get("auth")?.userId;
    if (!accountUserId) {
      return sendError(c, 401, "Authentication required");
    }

    const accountUser = await userDirectory.users.getUser(accountUserId);
    const fName = accountUser.firstName || "";
    const lName = accountUser.lastName || "";
    const uid = accountUser.publicMetadata._id;

    if (!uid) {
      return sendError(c, 400, "User metadata is missing");
    }

    if (
      !sanitizedName ||
      !sanitizedEmail ||
      !sanitizedWebsite ||
      !sanitizedAddress ||
      !members
    ) {
      return sendError(c, 400, "Please fill all required fields");
    }

    if (!validateEmail(sanitizedEmail)) {
      return sendError(c, 400, "Invalid email address");
    }

    if (!validateWebsite(sanitizedWebsite)) {
      return sendError(c, 400, "Invalid website address");
    }

    const existingInstitute = await Institute.findOne({
      email: sanitizedEmail,
    });
    if (existingInstitute) {
      return sendError(c, 400, "Institute with this email already exists");
    }

    const userInInstitute = await Institute.findOne({
      members: {
        $elemMatch: {
          user: uid,
          status: "active",
        },
      },
    });

    if (userInInstitute) {
      return sendError(c, 400, "User is already part of an institute");
    }

    const membersArr: Member[] = [];

    for (const member of members) {
      if (!member.email || !member.role) {
        return sendError(c, 400, "Please fill all fields for members");
      }

      const sanitizedMemberEmail = sanitizeInput(member.email);
      if (!validateEmail(sanitizedMemberEmail)) {
        return sendError(
          c,
          400,
          `Invalid email address for member: ${sanitizedMemberEmail}`
        );
      }

      const role = defaultInstituteRoles.find(
        (r) => r.name.toLowerCase() === member.role.toLowerCase()
      );

      if (!role) {
        return sendError(
          c,
          400,
          `Invalid role for member: ${sanitizedMemberEmail}`
        );
      }

      membersArr.push({
        user: member.user,
        email: sanitizedMemberEmail,
        role: role?.slug,
        status: "pending",
      });
    }

    const adminRole = defaultInstituteRoles.find(
      (role) => role.slug === "administrator"
    );

    if (!adminRole) {
      return sendError(c, 500, "Administrator role not found");
    }

    membersArr.push({
      user: typeof uid === "string" ? uid : "",
      email: accountUser.emailAddresses[0].emailAddress,
      role: adminRole?.slug,
      status: "active",
    });

    const auditLog = {
      user: `${fName} ${lName}`,
      userId: uid as string,
      action: "Institute Created",
      type: "info",
      timestamp: new Date(),
    };

    const code = crypto.randomUUID();

    const session = await mongoose.startSession();
    let institute;

    try {
      await session.withTransaction(async () => {
        institute = await Institute.create(
          [
            {
              name: sanitizedName,
              email: sanitizedEmail,
              website: sanitizedWebsite,
              address: sanitizedAddress,
              members: membersArr,
              roles: defaultInstituteRoles,
              subscription: {
                type: "trial",
                status: "active",
                startedOn: new Date(),
                endsOn: new Date(new Date().setDate(new Date().getDate() + 15)),
                maxStudents: 50,
                maxFaculty: 10,
                features: [],
              },
              auditLogs: [auditLog],
              code,
              createdBy: uid,
            },
          ],
          { session }
        );

        institute = institute[0];

        await userDirectory.users.updateUser(accountUserId, {
          publicMetadata: {
            ...accountUser.publicMetadata,
            institute: {
              _id: institute._id,
              name: institute.name,
              role: adminRole,
            },
          },
        });
      });
    } catch (error) {
      logger.error(`Transaction failed in createInstitute: ${error}`);
      return sendError(c, 500, "Failed to create institute", {
        message: "Database transaction failed",
      });
    } finally {
      await session.endSession(); // Ensure the session ends regardless of success or failure
    }

    for (const member of members) {
      const role = defaultInstituteRoles.find(
        (r) => r.name.toLowerCase() === member.role.toLowerCase()
      );

      const reqObj = {
        email: sanitizeInput(member.email),
        role: role?.slug,
        institute: (institute as unknown as IInstitute)?._id,
        inviter: fName || "",
        inviterId: uid,
        institutename: sanitizedName,
      };

      const token = jwt.sign(reqObj, process.env.JWT_SECRET!, {
        expiresIn: TOKEN_EXPIRY,
      });

      try {
        loops.sendTransactionalEmail({
          transactionalId: process.env.LOOPS_CAMPUS_INVITE_EMAIL!,
          email: sanitizeInput(member.email),
          dataVariables: {
            inviter: fName || "",
            joinlink: `${process.env
              .ENTERPRISE_FRONTEND_URL!}/join?token=${token}`,
            institutename: sanitizedName,
          },
        });
      } catch (error) {
        logger.error(
          `Failed to send invite email to ${member.email}: ${error}`
        );
      }
    }

    if (sampleData) {
      await generateSampleInstituteData(
        (institute as unknown as IInstitute)?._id!
      );
    }

    return sendSuccess(c, 200, "Institute created successfully", {
      institute: (institute as unknown as IInstitute)?._id,
    });
  } catch (error) {
    logger.error(`Failed to create institute: ${error}`);
    return sendError(c, 500, "Failed to create institute", {
      message: "Internal server error",
    });
  }
};

/**
 * Verify an invitation token
 */
const verifyInvite = async (c: Context) => {
  try {
    const { token } = await c.req.json();
    const cid = c.get("auth")?.userId;

    if (!cid) {
      return sendError(c, 401, "Authentication required");
    }

    if (!token) {
      return sendError(c, 400, "Token is required");
    }

    const accountUser = await userDirectory.users.getUser(cid);
    const email = accountUser.emailAddresses[0].emailAddress;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        institute: string;
        institutename: string;
        inviter: string;
        inviterId: string;
        email: string;
        role: string;
        iat: number;
        exp: number;
      };
    } catch (error) {
      if ((error as Error).name === "TokenExpiredError") {
        return sendError(c, 400, "Invitation has expired");
      }
      return sendError(c, 400, "Invalid token");
    }

    if (!decoded?.institute || !Types.ObjectId.isValid(decoded.institute)) {
      return sendError(c, 400, "Invalid invitation");
    }

    const institute = await Institute.findById(decoded.institute);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    if (decoded.email !== email) {
      return sendError(c, 400, "This invitation is not for your email address");
    }

    const instituteWithMember = await Institute.findOne({
      _id: decoded.institute,
      members: { $elemMatch: { email, status: "pending" } },
    });

    if (!instituteWithMember) {
      return sendError(c, 400, "Invalid invitation");
    }

    return sendSuccess(c, 200, "Invitation verified", {
      institute: decoded.institute,
      institutename: institute.name,
      role: decoded.role,
      inviter: decoded.inviter,
    });
  } catch (error) {
    logger.error(`verifyInvite error: ${error}`);
    return sendError(c, 500, "Failed to verify invitation", {
      message: "Internal server error",
    });
  }
};

/**
 * Join an institute using an invitation token
 */
const joinInstitute = async (c: Context) => {
  try {
    const { status, token } = await c.req.json();
    const userId = c.get("auth")?._id;
    const cid = c.get("auth")?.userId;

    if (!userId || !cid) {
      return sendError(c, 401, "Authentication required");
    }

    if (!token) {
      return sendError(c, 400, "Token is required");
    }

    if (status !== "accept" && status !== "reject") {
      return sendError(c, 400, "Invalid status value");
    }

    const accountUser = await userDirectory.users.getUser(cid);
    const email = accountUser.emailAddresses[0].emailAddress;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        role: string;
        institute: string;
        inviterId: string;
        email: string;
        iat: number;
        exp: number;
      };
    } catch (error) {
      if ((error as Error).name === "TokenExpiredError") {
        return sendError(c, 400, "Invitation has expired");
      }
      return sendError(c, 400, "Invalid token");
    }

    if (!decoded?.institute || !Types.ObjectId.isValid(decoded.institute)) {
      return sendError(c, 400, "Invalid invitation");
    }

    if (decoded.email !== email) {
      return sendError(c, 400, "This invitation is not for your email address");
    }

    const institute = await Institute.findById(decoded.institute);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const instituteWithMember = await Institute.findOne({
      _id: decoded.institute,
      members: { $elemMatch: { email, status: "pending" } },
    });

    if (!instituteWithMember) {
      return sendError(c, 400, "Invalid invitation");
    }

    const userInInstitute = await Institute.findOne({
      _id: { $ne: decoded.institute },
      "members.user": userId,
      "members.status": "active",
    });

    if (userInInstitute) {
      return sendError(c, 400, "You are already a member of another institute");
    }

    if (status === "accept") {
      const role = institute.roles.find((r: any) => r.slug === decoded.role);
      if (!role) {
        return sendError(c, 400, "Invalid role in invitation");
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await userDirectory.users.updateUser(cid, {
            publicMetadata: {
              ...accountUser.publicMetadata,
              institute: {
                _id: decoded.institute,
                name: institute.name,
                role: role,
              },
            },
          });

          let inviterName = "Unknown";
          try {
            const inviterUser = await User.findById(decoded.inviterId);
            if (inviterUser?._id) {
              const inviterAccount = await userDirectory.users.getUser(
                inviterUser._id.toString()
              );
              inviterName = `${inviterAccount.firstName || ""} ${
                inviterAccount.lastName || ""
              }`.trim();
            }
          } catch (inviterError) {
            logger.error(`Failed to find inviter: ${inviterError}`);
          }

          const auditLog: AuditLog = {
            user: `${accountUser.firstName || ""} ${
              accountUser.lastName || ""
            }`.trim(),
            userId: userId,
            action: `User Joined Institute. Invited By: ${inviterName}`,
            type: "info",
          };

          await Institute.updateOne(
            { _id: decoded.institute, "members.email": email },
            {
              $set: { "members.$.status": "active", "members.$.user": userId },
              $push: { auditLogs: auditLog },
            }
          );
        });
        await session.endSession();
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
        logger.error(`Transaction failed in joinInstitute: ${error}`);
        return sendError(c, 500, "Failed to join institute", {
          message: "Database transaction failed",
        });
      }
    } else {
      await Institute.updateOne(
        { _id: decoded.institute },
        { $pull: { members: { email } } }
      );
    }

    const notifyingUsers = await getCampusUsersWithPermission({
      institute: institute!,
      permissions: ["manage_institute"],
    });

    console.log("Notifying users: ", notifyingUsers);

    if (notifyingUsers.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUsers,
        title: "New Member Joined",
        message: `${accountUser.firstName || ""} ${
          accountUser.lastName || ""
        } has joined the institute.`,
      });
    }

    return sendSuccess(
      c,
      200,
      status === "accept"
        ? "Joined institute successfully"
        : "Invitation rejected",
      {
        id: decoded.institute,
      }
    );
  } catch (error) {
    logger.error(`joinInstitute error: ${error}`);
    return sendError(c, 500, "Failed to process invitation", {
      message: "Internal server error",
    });
  }
};

/**
 * Get institute settings
 */
const getSettings = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["view_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to view institute settings"
      );
    }

    if (!perms.data?.institute?._id) {
      return sendError(c, 404, "Institute not found");
    }

    const instituteId = perms.data.institute._id;

    if (!Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 400, "Invalid institute ID");
    }

    const institute = await Institute.findById(instituteId)
      .populate("auditLogs.user")
      .populate("members.user")
      .lean();

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const logoUrl = institute.logo;
    if (logoUrl) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_S3_BUCKET!,
          Key: logoUrl,
        });
        const presignedUrl = await getSignedUrl(r2Client, command, {
          expiresIn: 3600,
        });
        institute.logo = presignedUrl;
      } catch (e) {
        logger.error(`Failed to fetch logo: ${e}`);

        institute.logo = null;
      }
    }

    const sanitizedInstitute = {
      ...institute,
      auditLogs: institute.auditLogs.map((log: any) => ({
        ...log,

        additionalData: undefined,
      })),
    };

    return sendSuccess(c, 200, "Settings retrieved successfully", {
      institute: sanitizedInstitute,
      permissions: institutePermissions,
    });
  } catch (error) {
    logger.error(`getSettings error: ${error}`);
    return sendError(c, 500, "Failed to fetch institute settings", {
      message: "Internal server error",
    });
  }
};

/**
 * Update institute settings
 */
const updateInstitute = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to manage institute settings"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    const body = await c.req.json();

    const institute = await Institute.findById(instituteId).lean();
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const currentUser = await userDirectory.users.getUser(c.get("auth").userId);
    const inviterName = `${currentUser.firstName || ""} ${
      currentUser.lastName || ""
    }`.trim();

    const oldMembers = institute.members || [];
    const newMembers = body.members || [];

    if (newMembers.length > 0) {
      const hasAdmin = newMembers.some((member: Member) => {
        const role = institute.roles.find(
          (r) => (r as unknown as Role).slug === member.role
        );
        return (
          (role as unknown as Role)?.slug === "administrator" &&
          member.status === "active"
        );
      });

      if (!hasAdmin) {
        return sendError(
          c,
          400,
          "At least one active administrator is required"
        );
      }
    }

    const oldEmails = oldMembers.map((m) => m.email);
    const newEmails = newMembers.map((m: Member) => m.email);
    const removedEmails = oldEmails.filter(
      (email) => !newEmails.includes(email)
    );

    const metadataUpdatePromises = [];

    if (removedEmails.length > 0) {
      const removedMembers = oldMembers.filter(
        (member) => removedEmails.includes(member.email) && member.user
      );

      for (const member of removedMembers) {
        if (!member.user) continue;

        metadataUpdatePromises.push(
          (async () => {
            try {
              const user = await User.findById(member.user);
              if (!user?._id) return;

              const accountUserToUpdate = await userDirectory.users.getUser(
                user._id.toString()
              );
              const currentMetadata =
                accountUserToUpdate.publicMetadata as unknown as UserMeta;

              if (currentMetadata.institute?._id === instituteId.toString()) {
                await userDirectory.users.updateUser(user._id.toString(), {
                  publicMetadata: {
                    ...currentMetadata,
                    institute: null,
                  },
                });
              }
            } catch (error) {
              logger.error(
                `Failed to update identity provider metadata for removed user: ${member.user}`
              );
            }
          })()
        );
      }
    }

    const existingMembers = newMembers.filter(
      (member: Member) =>
        oldEmails.includes(member.email) && member.status === "active"
    );

    for (const newMember of existingMembers) {
      const oldMember = oldMembers.find((m) => m.email === newMember.email);

      if (!oldMember?.user || oldMember.role === newMember.role) continue;

      metadataUpdatePromises.push(
        (async () => {
          try {
            const user = await User.findById(oldMember.user);
            if (!user?._id) return;

            const accountUserToUpdate = await userDirectory.users.getUser(
              user._id.toString()
            );
            const currentMetadata =
              accountUserToUpdate.publicMetadata as unknown as UserMeta;

            if (currentMetadata.institute?._id === instituteId.toString()) {
              const role = institute.roles.find(
                (r: any) => r.slug === newMember.role
              );
              if (!role) return;

              await userDirectory.users.updateUser(user._id.toString(), {
                publicMetadata: {
                  ...currentMetadata,
                  institute: {
                    ...currentMetadata.institute,
                    role: role,
                  },
                },
              });
            }
          } catch (error) {
            logger.error(
              `Failed to update role in identity provider metadata for user: ${oldMember.user}`
            );
          }
        })()
      );
    }

    const oldPendingEmails = oldMembers
      .filter((member) => member.status === "pending")
      .map((member) => member.email);

    const newPendingMembers = newMembers.filter(
      (member: Member) =>
        member.status === "pending" && !oldPendingEmails.includes(member.email)
    );

    for (const member of newPendingMembers) {
      const sanitizedEmail = sanitizeInput(member.email);
      if (!validateEmail(sanitizedEmail)) {
        return sendError(
          c,
          400,
          `Invalid email address for member: ${sanitizedEmail}`
        );
      }

      const role = institute.roles.find((r: any) => r.slug === member.role) as
        | Role
        | undefined;

      if (!role) {
        logger.error(`Role not found for member: ${member.email}`);
        continue;
      }

      const reqObj = {
        email: sanitizedEmail,
        role: role.slug,
        institute: instituteId,
        inviter: inviterName,
        inviterId: currentUser?.publicMetadata?._id,
        institutename: body.name || institute.name,
      };

      const token = jwt.sign(reqObj, process.env.JWT_SECRET!, {
        expiresIn: TOKEN_EXPIRY,
      });

      try {
        await loops.sendTransactionalEmail({
          transactionalId: process.env.LOOPS_CAMPUS_INVITE_EMAIL!,
          email: sanitizedEmail,
          dataVariables: {
            inviter: inviterName,
            joinlink: `${process.env.CAMPUS_FRONTEND_URL!}/join?token=${token}`,
            institutename: body.name || institute.name,
          },
        });

        logger.info(`Invite sent to: ${sanitizedEmail}`);
      } catch (error) {
        logger.error(`Failed to send invite to: ${sanitizedEmail}: ${error}`);
      }
    }

    await Promise.all(metadataUpdatePromises);

    const auditLog = {
      user: inviterName,
      userId: currentUser?.publicMetadata?._id,
      action: "Institute Updated",
      type: "info",
      timestamp: new Date(),
    };

    const sanitizedBody = {
      ...body,
      name: body.name ? sanitizeInput(body.name) : institute.name,
      email: body.email ? sanitizeInput(body.email) : institute.email,
      website: body.website ? sanitizeInput(body.website) : institute.website,
    };

    const updatedInstitute = await Institute.findByIdAndUpdate(
      instituteId,
      {
        $set: {
          ...sanitizedBody,
        },
      },
      { new: true }
    );

    // push audit log
    if (updatedInstitute) {
      updatedInstitute.auditLogs.push(auditLog);
      await updatedInstitute.save();
    }

    if (!updatedInstitute) {
      return sendError(c, 404, "Institute not found");
    }

    return sendSuccess(c, 200, "Institute settings updated successfully", {
      _id: updatedInstitute._id,
      name: updatedInstitute.name,
    });
  } catch (error) {
    logger.error(`updateInstitute error: ${error}`);
    return sendError(c, 500, "Failed to update institute settings", {
      message: "Internal server error",
    });
  }
};

/**
 * Update general institute settings
 */
const updateGeneralSettings = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to manage institute settings"
      );
    }

    const { name, email, website } = await c.req.json();
    const instituteId = perms.data?.institute?._id;

    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedWebsite = sanitizeInput(website);

    if (!sanitizedName || !sanitizedEmail || !sanitizedWebsite) {
      return sendError(c, 400, "Please fill all required fields");
    }

    if (!validateEmail(sanitizedEmail)) {
      return sendError(c, 400, "Invalid email address");
    }

    if (!validateWebsite(sanitizedWebsite)) {
      return sendError(c, 400, "Invalid website address");
    }

    const existingInstitute = await Institute.findOne({
      email: sanitizedEmail,
      _id: { $ne: instituteId },
    });

    if (existingInstitute) {
      return sendError(c, 400, "Institute with this email already exists");
    }

    const user = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      userId: c.get("auth")._id,
      action: "Institute General Settings Updated",
      type: "info",
    };

    const institute = await Institute.findById(instituteId).populate(
      "members.user"
    );

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (sanitizedName !== institute.name) {
          const updatePromises = [];
          for (const member of institute.members) {
            if (!member.user || member.status !== "active") continue;

            const userDoc = await User.findById(member.user);
            if (!userDoc?._id) continue;

            updatePromises.push(
              (async () => {
                try {
                  const u = await userDirectory.users.getUser(userDoc._id.toString());
                  const publicMetadata =
                    u.publicMetadata as unknown as UserMeta;
                  if (
                    publicMetadata.institute &&
                    publicMetadata.institute._id === instituteId.toString()
                  ) {
                    publicMetadata.institute.name = sanitizedName;
                    await userDirectory.users.updateUser(userDoc._id.toString(), {
                      publicMetadata:
                        publicMetadata as unknown as Record<string, unknown>,
                    });
                  }
                } catch (error) {
                  logger.error(
                    `Failed to update institute name for user ${userDoc._id.toString()}: ${error}`
                  );
                }
              })()
            );
          }

          await Promise.all(updatePromises);
        }

        institute.name = sanitizedName;
        institute.email = sanitizedEmail;
        institute.website = sanitizedWebsite;
        institute.auditLogs.push(auditLog);
        await institute.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in updateGeneralSettings: ${error}`);
      return sendError(c, 500, "Failed to update institute settings", {
        message: "Database transaction failed",
      });
    }

    return sendSuccess(c, 200, "Institute settings updated successfully", {
      _id: institute._id,
      name: institute.name,
      email: institute.email,
      website: institute.website,
    });
  } catch (error) {
    logger.error(`updateGeneralSettings error: ${error}`);
    return sendError(c, 500, "Failed to update institute settings", {
      message: "Internal server error",
    });
  }
};

/**
 * Update institute logo
 */
const updateLogo = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to update institute logo"
      );
    }

    const orgId = perms.data?.institute?._id;
    if (!orgId || !Types.ObjectId.isValid(orgId)) {
      return sendError(c, 404, "Institute not found");
    }

    const file = await c.req.json();

    if (!file.logo) {
      return sendError(c, 400, "Please provide a logo image");
    }

    const logoData = file.logo;
    const matches = logoData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      return sendError(c, 400, "Invalid image format");
    }

    const contentType = matches[1];
    const base64Data = matches[2];

    if (!ALLOWED_FILE_TYPES.includes(contentType)) {
      return sendError(
        c,
        400,
        `File type not allowed. Accepted types: ${ALLOWED_FILE_TYPES.join(
          ", "
        )}`
      );
    }

    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      return sendError(
        c,
        400,
        `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
      );
    }

    const uploadParams = {
      Bucket: process.env.R2_S3_BUCKET!,
      Key: `inst-logos/${orgId}.${contentType.split("/")[1]}`,
      Body: buffer,
      ContentEncoding: "base64",
      ContentType: contentType,
    };

    const upload = new Upload({
      client: r2Client,
      params: uploadParams,
    });

    await upload.done();

    const user = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      userId: c.get("auth")._id,
      action: "Institute Logo Updated",
      type: "info",
    };

    const updatedOrg = await Institute.findByIdAndUpdate(
      orgId,
      {
        $set: { logo: uploadParams.Key },
        $push: { auditLogs: auditLog },
      },
      { new: true }
    );

    if (!updatedOrg) {
      return sendError(c, 404, "Institute not found");
    }

    return sendSuccess(c, 200, "Logo updated successfully");
  } catch (error) {
    logger.error(`updateLogo error: ${error}`);
    return sendError(c, 500, "Failed to update institute logo", {
      message: "Internal server error",
    });
  }
};

/**
 * Update institute members
 */
const updateMembers = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to update institute members"
      );
    }

    const { members } = await c.req.json();
    const instituteId = perms.data?.institute?._id;

    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    if (!Array.isArray(members)) {
      return sendError(c, 400, "Members must be an array");
    }

    const hasAdmin = members.some((member: Member) => {
      return member.role === "administrator" && member.status === "active";
    });

    if (!hasAdmin) {
      return sendError(c, 400, "At least one active administrator is required");
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const fullName = `${accountUser.firstName || ""} ${
      accountUser.lastName || ""
    }`.trim();

    const oldMembers = institute.members;
    const oldMemberEmails = oldMembers.map((member) => member.email);
    const newMemberEmails = members.map((member: Member) => member.email);

    const removedMemberEmails = oldMemberEmails.filter(
      (email) => !newMemberEmails.includes(email)
    );

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (removedMemberEmails.length > 0) {
          const removedMembers = oldMembers.filter(
            (member) =>
              removedMemberEmails.includes(member.email) && member.user
          );

          for (const member of removedMembers) {
            if (!member.user) continue;

            try {
              const user = await User.findById(member.user);
              if (!user?._id) continue;

              const accountUserToUpdate = await userDirectory.users.getUser(
                user._id.toString()
              );
              const currentMetadata =
                accountUserToUpdate.publicMetadata as unknown as UserMeta;

              if (currentMetadata.institute?._id === instituteId.toString()) {
                await userDirectory.users.updateUser(user._id.toString(), {
                  publicMetadata: {
                    ...currentMetadata,
                    institute: null,
                  },
                });
              }
            } catch (error) {
              logger.error(
                `Failed to update identity provider metadata for user: ${member.user}: ${error}`
              );
            }
          }
        }

        const existingMembers = members.filter(
          (member: Member) =>
            oldMemberEmails.includes(member.email) && member.status === "active"
        );

        for (const newMember of existingMembers) {
          const oldMember = oldMembers.find((m) => m.email === newMember.email);
          if (!oldMember?.user || oldMember.role === newMember.role) continue;

          try {
            const user = await User.findById(oldMember.user);
            if (!user?._id) continue;

            const accountUserToUpdate = await userDirectory.users.getUser(
              user._id.toString()
            );
            const currentMetadata =
              accountUserToUpdate.publicMetadata as unknown as UserMeta;

            if (currentMetadata.institute?._id === instituteId.toString()) {
              const role = institute.roles.find(
                (r) => r.slug === newMember.role
              );

              await userDirectory.users.updateUser(user._id.toString(), {
                publicMetadata: {
                  ...currentMetadata,
                  institute: {
                    ...currentMetadata.institute,
                    role: role,
                  },
                },
              });
            }
          } catch (error) {
            logger.error(
              `Failed to update role in identity provider metadata for user: ${oldMember.user}: ${error}`
            );
          }
        }

        const oldPendingMembers = oldMembers.filter(
          (member) => member.status === "pending"
        );
        const oldPendingEmails = oldPendingMembers.map((m) => m.email);
        const newPendingMembers = members.filter(
          (member: Member) => member.status === "pending"
        );
        const newPendingEmails = newPendingMembers.map((m: Member) => m.email);
        const newInviteEmails = newPendingEmails.filter(
          (email: string) => !oldPendingEmails.includes(email)
        );

        for (const email of newInviteEmails) {
          const member = members.find((m: Member) => m.email === email);
          if (!validateEmail(email)) {
            logger.warn(`Skipping invalid email: ${email}`);
            continue;
          }

          const role = institute.roles.find((r) => r.slug === member.role);
          if (!role) {
            logger.warn(`Skipping member with invalid role: ${email}`);
            continue;
          }

          const reqObj = {
            email,
            role: role.slug,
            institute: instituteId,
            inviter: accountUser.firstName || "",
            inviterId: c.get("auth")._id,
            institutename: institute.name,
          };

          const token = jwt.sign(reqObj, process.env.JWT_SECRET!, {
            expiresIn: TOKEN_EXPIRY,
          });

          try {
            await loops.sendTransactionalEmail({
              transactionalId: process.env.LOOPS_INVITE_EMAIL!,
              email,
              dataVariables: {
                inviter: accountUser.firstName || "",
                joinlink: `${process.env
                  .ENTERPRISE_FRONTEND_URL!}/join?token=${token}`,
                institutename: institute.name,
              },
            });
          } catch (error) {
            logger.error(`Failed to send invite to: ${email}: ${error}`);
          }
        }

        const finalMembers = members.map((member: Member) => ({
          user:
            (member.user as any)?._id?.toString() ||
            (member.user as any)?.id ||
            null,
          email: sanitizeInput(member.email),
          role: member.role,
          addedOn: (member as any).addedOn || new Date(),
          status: member.status,
        }));

        const auditLog = {
          user: fullName,
          userId: c.get("auth")._id,
          action: "Institute Members Updated",
          type: "info",
          timestamp: new Date(),
        };

        await Institute.findByIdAndUpdate(
          instituteId,
          {
            $set: { members: finalMembers },
            $push: { auditLogs: auditLog },
          },
          { session }
        );
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in updateMembers: ${error}`);
      return sendError(c, 500, "Failed to update institute members", {
        message: "Database transaction failed",
      });
    }

    return sendSuccess(c, 200, "Institute members updated successfully");
  } catch (error) {
    logger.error(`updateMembers error: ${error}`);
    return sendError(c, 500, "Failed to update institute members", {
      message: "Internal server error",
    });
  }
};

/**
 * Update institute roles
 */
const updateRoles = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to update institute roles"
      );
    }

    const { roles } = await c.req.json();
    const instituteId = perms.data?.institute?._id;

    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    if (!Array.isArray(roles)) {
      return sendError(c, 400, "Roles must be an array");
    }

    const finalRoles: Role[] = [];
    for (const role of roles) {
      if (!role.name || !role.slug) {
        return sendError(c, 400, "Each role must have a name and slug");
      }

      if (typeof role.slug !== "string" || !/^[a-z0-9_-]+$/.test(role.slug)) {
        return sendError(c, 400, `Invalid role slug format: ${role.slug}`);
      }

      if (finalRoles.some((r) => r.slug === role.slug)) {
        return sendError(c, 400, `Duplicate role slug: ${role.slug}`);
      }

      const roleObj: Role = {
        name: sanitizeInput(role.name),
        slug: role.slug,
        description: role.description ? sanitizeInput(role.description) : "",
        permissions: Array.isArray(role.permissions)
          ? role.permissions.filter((p: string) =>
              institutePermissions.includes(p)
            )
          : [],
        default: !!role.default,
      };

      finalRoles.push(roleObj);
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const defaultSystemRoles = defaultInstituteRoles.map((role) => role.slug);
    const userModifiedSystemRoles = finalRoles.some(
      (role) =>
        defaultSystemRoles.includes(role.slug) &&
        !defaultInstituteRoles.some(
          (defaultRole) =>
            defaultRole.slug === role.slug &&
            JSON.stringify(defaultRole.permissions) ===
              JSON.stringify(role.permissions)
        )
    );

    if (userModifiedSystemRoles) {
      return sendError(c, 400, "Cannot modify default system roles");
    }

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const fullName = `${accountUser.firstName || ""} ${
      accountUser.lastName || ""
    }`.trim();

    const auditLog: AuditLog = {
      user: fullName,
      userId: c.get("auth")._id,
      action: "Institute Roles Updated",
      type: "info",
    };

    const existingDefaultRoles = defaultInstituteRoles.filter(
      (role) => !finalRoles.some((r) => r.slug === role.slug)
    );

    const updatedInstitute = await Institute.findByIdAndUpdate(
      instituteId,
      {
        $set: { roles: [...finalRoles, ...existingDefaultRoles] },
        $push: { auditLogs: auditLog },
      },
      { new: true }
    );

    if (!updatedInstitute) {
      return sendError(c, 404, "Institute not found");
    }

    return sendSuccess(c, 200, "Institute roles updated successfully", {
      roles: updatedInstitute.roles,
    });
  } catch (error) {
    logger.error(`updateRoles error: ${error}`);
    return sendError(c, 500, "Failed to update institute roles", {
      message: "Internal server error",
    });
  }
};

/**
 * Get candidates for an institute
 */
const getCandidates = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["view_institute"]);
    if (!perms.allowed) {
      return sendError(c, 403, "You don't have permission to view candidates");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    // Populate more deeply to ensure we get all the candidate data
    const institute = await Institute.findOne({ _id: instituteId })
      .populate({
        path: "candidates",
        select: "-passwordHash -resetToken -refreshToken",
        options: { lean: true },
      })
      .lean();

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    // Log what we're sending back for debugging
    console.log(`Returning ${institute?.candidates?.length || 0} candidates`);

    return sendSuccess(
      c,
      200,
      "Candidates fetched successfully",
      institute?.candidates || []
    );
  } catch (error) {
    logger.error(`getCandidates error: ${error}`);
    return sendError(c, 500, "Failed to fetch candidates", {
      message: "Internal server error",
    });
  }
};

/**
 * Get pending candidates for an institute
 */
const getPendingCandidates = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["view_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to view pending candidates"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    const institute = await Institute.findOne({ _id: instituteId })
      .populate({
        path: "pendingCandidates",
        select: "-passwordHash -resetToken -refreshToken",
      })
      .lean();

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    return sendSuccess(
      c,
      200,
      "Pending Candidates fetched successfully",
      institute?.pendingCandidates || []
    );
  } catch (error) {
    logger.error(`getPendingCandidates error: ${error}`);
    return sendError(c, 500, "Failed to fetch pending candidates", {
      message: "Internal server error",
    });
  }
};

/**
 * Get departments for an institute
 */
const getDepartments = async (c: Context) => {
  try {
    const perms = await checkInstitutePermission.all(c, ["view_institute"]);
    if (!perms.allowed) {
      return sendError(c, 403, "You don't have permission to view departments");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId || !Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 404, "Institute not found");
    }

    const institute = await Institute.findById(instituteId)
      .select("departments")
      .lean();

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    return sendSuccess(
      c,
      200,
      "Departments fetched successfully",
      institute.departments || []
    );
  } catch (error) {
    logger.error(`getDepartments error: ${error}`);
    return sendError(c, 500, "Failed to fetch departments", {
      message: "Internal server error",
    });
  }
};

/**
 * Request to join an institute
 */
const requestToJoin = async (c: Context) => {
  try {
    const { code, uid } = await c.req.json();
    const userId = c.get("auth")?._id;

    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    if (!code || !uid) {
      return sendError(c, 400, "Institute code and candidate ID are required");
    }

    const sanitizedCode = sanitizeInput(code);
    const sanitizedUid = sanitizeInput(uid);

    const candidate = await CandidateModel.findOne({ userId });
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const institute = await Institute.findOne({ code: sanitizedCode });
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    if (
      institute.pendingCandidates.some(
        (c) => c?.toString() === candidate?._id?.toString()
      )
    ) {
      return sendError(
        c,
        400,
        "You have already requested to join this institute"
      );
    }

    if (
      institute.candidates.some(
        (c) => c?.toString() === candidate._id.toString()
      )
    ) {
      return sendError(c, 400, "You are already a candidate of this institute");
    }

    if (institute.members.some((m) => m.user?.toString() === userId)) {
      return sendError(
        c,
        400,
        "You are already a faculty member of this institute"
      );
    }

    if (candidate.institute) {
      return sendError(c, 400, "You already belong to another institute");
    }

    const existingCandidate = await CandidateModel.findOne({
      instituteUid: sanitizedUid,
      institute: institute._id,
    });

    if (existingCandidate) {
      return sendError(
        c,
        400,
        "A candidate with this unique ID already exists in this institute"
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Institute.findByIdAndUpdate(
          institute._id,
          {
            $push: { pendingCandidates: candidate._id },
          },
          { session }
        );

        candidate.instituteUid = sanitizedUid;
        await candidate.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in requestToJoin: ${error}`);
      return sendError(c, 500, "Failed to send join request", {
        message: "Database transaction failed",
      });
    }

    const notifyingUsers = await getCampusUsersWithPermission({
      institute: institute,
      permissions: ["verify_candidates"],
    });

    if (notifyingUsers.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUsers,
        title: "New Candidate Request",
        message: `New candidate request from ${candidate.name} (${candidate.email})`,
      });
    }

    return sendSuccess(c, 200, "Request to join institute sent successfully", {
      name: institute.name,
    });
  } catch (error) {
    logger.error(`requestToJoin error: ${error}`);
    return sendError(c, 500, "Failed to request to join institute", {
      message: "Internal server error",
    });
  }
};

/**
 * Leave an institute
 */
const leaveInstitute = async (c: Context) => {
  const userId = c.get("auth")?.userId;
  if (!userId) {
    return sendError(c, 401, "Authentication required");
  }

  try {
    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 404, "User not found");
    }

    const userMeta = accountUser.publicMetadata as unknown as UserMeta;
    if (!userMeta.institute) {
      return sendError(c, 404, "You are not a member of any institute");
    }

    const instituteId = userMeta.institute._id;
    if (!Types.ObjectId.isValid(instituteId)) {
      return sendError(c, 400, "Invalid institute ID in user metadata");
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      await userDirectory.users.updateUser(userId, {
        publicMetadata: {
          ...userMeta,
          institute: null,
        },
      });
      return sendError(c, 404, "Institute not found");
    }

    const memberId = c.get("auth")?._id;
    if (!memberId) {
      return sendError(c, 401, "User ID not found");
    }

    const member = institute.members.find(
      (m) => m.user?.toString() === memberId
    );

    if (!member) {
      await userDirectory.users.updateUser(userId, {
        publicMetadata: {
          ...userMeta,
          institute: null,
        },
      });
      return sendError(c, 404, "You are not a member of this institute");
    }

    if (member.status !== "active") {
      return sendError(c, 400, "Your membership is not active");
    }

    if (memberId === institute.createdBy?.toString()) {
      return sendError(c, 400, "Institute owners cannot leave the institute");
    }

    if (member.role === "administrator") {
      const activeAdmins = institute.members.filter(
        (m) => m.status === "active" && m.role === "administrator"
      );

      if (activeAdmins.length <= 1) {
        return sendError(
          c,
          400,
          "Cannot leave institute as you are the last administrator"
        );
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        member.status = "inactive";
        await institute.save({ session });

        await userDirectory.users.updateUser(accountUser.id, {
          publicMetadata: {
            ...userMeta,
            institute: null,
          },
        });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in leaveInstitute: ${error}`);
      return sendError(c, 500, "Failed to leave institute", {
        message: "Database transaction failed",
      });
    }

    const notifyingUsers = await getCampusUsersWithPermission({
      institute: institute,
      permissions: ["manage_institute"],
    });

    if (notifyingUsers.length > 0) {
      await sendNotificationToCampus({
        userIds: notifyingUsers,
        title: "Member Left Institute",
        message: `${accountUser.firstName} ${accountUser.lastName} has left the institute`,
      });
    }

    return sendSuccess(c, 200, "Left institute successfully", {
      message: "You have successfully left the institute",
    });
  } catch (error) {
    logger.error(`leaveInstitute error: ${error}`);
    return sendError(c, 500, "Failed to leave institute", {
      message: "Internal server error",
    });
  }
};

/**
 * Field mapping for permissions
 */
const permissionFieldMap = {
  view_institute: [
    "name",
    "email",
    "website",
    "logo",
    "members",
    "roles",
    "departments",
    "auditLogs",
    "subscriptions",
    "candidates",
    "drives",
    "code",
    "companies",
    "placementGroups",
  ],
  manage_institute: [
    "name",
    "email",
    "website",
    "logo",
    "members",
    "roles",
    "departments",
    "auditLogs",
    "subscriptions",
    "candidates",
    "drives",
    "code",
    "companies",
    "placementGroups",
  ],
  view_billing: ["name", "email", "website", "subscriptions"],
  manage_billing: ["name", "email", "website", "subscriptions"],
  view_analytics: [
    "name",
    "email",
    "website",
    "logo",
    "departments",
    "candidates",
    "drives",
    "placementGroups",
    "companies",
  ],
  interviewer: [
    "name",
    "email",
    "website",
    "logo",
    "departments",
    "candidates",
    "drives",
    "placementGroups",
    "companies",
  ],
};

/**
 * Get all institute information based on user permissions
 */
const getInstitute = async (c: Context) => {
  try {
    const userId = c.get("auth")?._id;
    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    const institute = await Institute.findOne({
      members: {
        $elemMatch: {
          user: userId,
          status: "active",
        },
      },
    })
      .populate({
        path: "members.user",
      })
      .populate("candidates")
      .populate("pendingCandidates")
      .populate("companies")
      .populate("drives")
      .lean();

    if (!institute) {
      return sendError(
        c,
        404,
        "Institute not found or you are not an active member"
      );
    }

    const member = institute.members.find(
      (m) =>
        (
          m?.user as Types.ObjectId | { _id: Types.ObjectId }
        )?._id?.toString() === userId.toString()
    );

    if (!member?.role) {
      return sendError(c, 403, "Invalid member access");
    }

    const role = institute.roles.find(
      (r) => r.slug === (member.role as unknown as string)
    );

    if (!role?.permissions?.length) {
      return sendError(c, 403, "No permissions found for your role");
    }

    const fieldsToSelect = [
      ...new Set(
        role.permissions.flatMap(
          (permission) =>
            permissionFieldMap[permission as keyof typeof permissionFieldMap] ||
            []
        )
      ),
    ];

    const [selectedInstitute, userDoc] = await Promise.all([
      Institute.findById(institute._id)
        .select(fieldsToSelect.join(" "))
        .populate({
          path: "members.user",
        })
        .populate({
          path: "candidates",
        })
        .populate({
          path: "pendingCandidates",
        })
        .populate("companies")
        .populate("placementGroups")
        .populate("drives"),

      User.findOne({ _id: userId }).lean(),
    ]);

    if (!selectedInstitute || !userDoc) {
      return sendError(c, 404, "Required data not found");
    }

    const user = {
      ...member,
      _id: member._id?.toString(),
      user: member.user ? (member.user as unknown as IUser)._id : undefined,
      permissions: role.permissions,
      createdAt: member.createdAt || new Date(),
    };

    const logoUrl = selectedInstitute.logo;
    if (logoUrl) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_S3_BUCKET!,
          Key: logoUrl,
        });

        const presignedUrl = await getSignedUrl(r2Client, command, {
          expiresIn: 3600,
        });
        selectedInstitute.logo = presignedUrl;
      } catch (e) {
        logger.error(`Failed to fetch logo: ${e}`);
        selectedInstitute.logo = null;
      }
    }

    return sendSuccess(c, 200, "Institute fetched successfully", {
      institute: selectedInstitute,
      user,
    });
  } catch (error) {
    logger.error("Failed to fetch institute: " + error);
    return sendError(c, 500, "Failed to fetch institute", {
      message: "Internal server error",
    });
  }
};

/**
 * Verify if a candidate has a pending request
 */
const verifyRequest = async (c: Context) => {
  try {
    const userId = c.get("auth")?._id;
    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await CandidateModel.findOne({ userId });
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const isCandidatePending = await Institute.findOne({
      pendingCandidates: candidate._id,
    });

    if (!isCandidatePending) {
      return sendSuccess(c, 200, "No pending requests found", { exist: false });
    }

    return sendSuccess(c, 200, "Pending request found", {
      exist: true,
      name: isCandidatePending.name,
    });
  } catch (error) {
    logger.error("Failed to verify request: " + error);
    return sendError(c, 500, "Failed to verify request", {
      message: "Internal server error",
    });
  }
};

/**
 * Cancel a pending join request
 */
const cancelRequest = async (c: Context) => {
  try {
    const userId = c.get("auth")?._id;
    if (!userId) {
      return sendError(c, 401, "Authentication required");
    }

    const candidate = await CandidateModel.findOne({ userId });
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const isCandidatePending = await Institute.findOne({
      pendingCandidates: candidate._id,
    });

    if (!isCandidatePending) {
      return sendSuccess(c, 200, "No pending request found", { exist: false });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Institute.updateOne(
          { _id: isCandidatePending._id },
          { $pull: { pendingCandidates: candidate._id } },
          { session }
        );

        candidate.instituteUid = undefined;
        await candidate.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in cancelRequest: ${error}`);
      return sendError(c, 500, "Failed to cancel request", {
        message: "Database transaction failed",
      });
    }

    return sendSuccess(c, 200, "Request cancelled successfully", {
      exist: true,
      name: isCandidatePending.name,
    });
  } catch (error) {
    logger.error("Failed to cancel request: " + error);
    return sendError(c, 500, "Failed to cancel request", {
      message: "Internal server error",
    });
  }
};

/**
 * Get a specific candidate's details
 */
const getCandidate = async (c: Context) => {
  try {
    const cid = c.req.param("cid");
    if (!cid || !Types.ObjectId.isValid(cid)) {
      return sendError(c, 400, "Invalid candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to view candidate details"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const institute = await Institute.findById(instituteId)
      .populate({
        path: "candidates",
        select: "-passwordHash -resetToken -refreshToken",
      })
      .populate({
        path: "pendingCandidates",
        select: "-passwordHash -resetToken -refreshToken",
      });

    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    if (institute.candidates.some((c) => c?._id.toString() === cid)) {
      const candidate = institute.candidates.find(
        (c) => c?._id.toString() === cid
      );
      return sendSuccess(c, 200, "Candidate found", candidate);
    }

    if (institute.pendingCandidates.some((c) => c?._id.toString() === cid)) {
      const candidate = institute.pendingCandidates.find(
        (c) => c?._id.toString() === cid
      );
      return sendSuccess(c, 200, "Candidate found", candidate);
    }

    return sendError(c, 404, "Candidate not found in this institute");
  } catch (error) {
    logger.error("Failed to get candidate details: " + error);
    return sendError(c, 500, "Failed to get candidate details", {
      message: "Internal server error",
    });
  }
};

/**
 * Accept a pending candidate
 */
const acceptCandidate = async (c: Context) => {
  try {
    const candidateId = c.req.param("cid");
    if (!candidateId || !Types.ObjectId.isValid(candidateId)) {
      return sendError(c, 400, "Invalid candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["verify_candidates"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to verify candidates"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const pendingCandidate = institute.pendingCandidates.find(
      (c) => c?.toString() === candidateId
    );

    if (!pendingCandidate) {
      return sendError(c, 404, "Pending candidate not found");
    }

    if (
      candidate.institute &&
      candidate.institute.toString() !== instituteId.toString()
    ) {
      return sendError(
        c,
        400,
        "Candidate is already part of another institute"
      );
    }

    const existingCandidate = await CandidateModel.findOne({
      instituteUid: candidate.instituteUid,
      institute: instituteId,
      _id: { $ne: candidateId },
    });

    if (existingCandidate) {
      return sendError(
        c,
        400,
        "A candidate with this unique ID already exists in this institute"
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        institute.pendingCandidates = institute.pendingCandidates.filter(
          (c) => c?.toString() !== candidateId
        );
        institute.candidates.push(candidate._id);
        await institute.save({ session });

        candidate.institute = new Types.ObjectId(instituteId);
        candidate.notifications.push({
          message: `You have been accepted to ${institute.name}`,
          type: "institute",
          timestamp: new Date(),
        });
        await candidate.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in acceptCandidate: ${error}`);
      return sendError(c, 500, "Failed to accept candidate", {
        message: "Database transaction failed",
      });
    }

    await sendNotificationToCandidate({
      candidateIds: [candidateId],
      title: "Campus Join Request Accepted",
      message: `You have been accepted to ${institute.name}`,
    });

    return sendSuccess(c, 200, "Candidate accepted successfully");
  } catch (error) {
    logger.error("Failed to accept candidate: " + error);
    return sendError(c, 500, "Failed to accept candidate", {
      message: "Internal server error",
    });
  }
};

/**
 * Reject a pending candidate
 */
const rejectCandidate = async (c: Context) => {
  try {
    const candidateId = c.req.param("cid");
    if (!candidateId || !Types.ObjectId.isValid(candidateId)) {
      return sendError(c, 400, "Invalid candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["verify_candidates"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to verify candidates"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const pendingCandidate = institute.pendingCandidates.find(
      (c) => c?.toString() === candidateId
    );

    if (!pendingCandidate) {
      return sendError(c, 404, "Pending candidate not found");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        institute.pendingCandidates = institute.pendingCandidates.filter(
          (c) => c?.toString() !== candidateId
        );
        await institute.save({ session });

        candidate.instituteUid = undefined;
        candidate.notifications.push({
          message: `Your request to join ${institute.name} has been rejected`,
          type: "institute",
          timestamp: new Date(),
        });
        await candidate.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in rejectCandidate: ${error}`);
      return sendError(c, 500, "Failed to reject candidate", {
        message: "Database transaction failed",
      });
    }

    await sendNotificationToCandidate({
      candidateIds: [candidateId],
      title: "Campus Join Request Rejected",
      message: `Your request to join ${institute.name} has been rejected`,
    });

    return sendSuccess(c, 200, "Candidate rejected successfully");
  } catch (error) {
    logger.error("Failed to reject candidate: " + error);
    return sendError(c, 500, "Failed to reject candidate", {
      message: "Internal server error",
    });
  }
};

/**
 * Get a candidate's resume
 */
const getResume = async (c: Context) => {
  try {
    const cid = c.req.param("cid");
    if (!cid || !Types.ObjectId.isValid(cid)) {
      return sendError(c, 400, "Invalid candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["view_institute"]);
    if (!perms.allowed) {
      return sendError(c, 403, "You don't have permission to view resumes");
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const candidate = await Candidate.findOne({
      _id: cid,
      institute: instituteId,
    });

    if (!candidate) {
      return sendError(
        c,
        404,
        "Candidate not found or doesn't belong to your institute"
      );
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_S3_RESUME_BUCKET!,
      Key: candidate?.isSample ? "sample.pdf" : `${candidate._id}.pdf`,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 600 });

    return sendSuccess(c, 200, "Resume URL generated", { url });
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to get resume", {
      message: "Internal server error",
    });
  }
};

/**
 * Remove a candidate from an institute
 */
const removeCandidate = async (c: Context) => {
  try {
    const candidateId = c.req.param("cid");
    if (!candidateId || !Types.ObjectId.isValid(candidateId)) {
      return sendError(c, 400, "Invalid candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to remove candidates"
      );
    }

    const instituteId = perms.data?.institute?._id;
    if (!instituteId) {
      return sendError(c, 404, "Institute not found");
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    const isInInstitute = institute.candidates.some(
      (c) => c?.toString() === candidateId
    );

    if (!isInInstitute) {
      return sendError(c, 404, "Candidate not found in this institute");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        institute.candidates = institute.candidates.filter(
          (c) => c?.toString() !== candidateId
        );
        await institute.save({ session });

        candidate.institute = undefined;
        candidate.notifications.push({
          message: `You have been removed from ${institute.name}`,
          type: "institute",
          timestamp: new Date(),
        });
        await candidate.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      logger.error(`Transaction failed in removeCandidate: ${error}`);
      return sendError(c, 500, "Failed to remove candidate", {
        message: "Database transaction failed",
      });
    }

    return sendSuccess(c, 200, "Candidate removed successfully");
  } catch (error) {
    logger.error("Failed to remove candidate: " + error);
    return sendError(c, 500, "Failed to remove candidate", {
      message: "Internal server error",
    });
  }
};

const mockDataInstituteId = async (c: Context) => {
  const permission = await checkInstitutePermission.all(c, ["manage_institute"]);
  if (!permission.allowed || !permission.data?.institute?._id) return null;
  return permission.data.institute._id.toString();
};

const getMockDataStatus = async (c: Context) => {
  try {
    const instituteId = await mockDataInstituteId(c);
    if (!instituteId) return sendError(c, 403, "You don't have permission to manage mock data");
    return sendSuccess(c, 200, "Mock data status fetched", await readMockDataStatus(instituteId));
  } catch (error) {
    return sendError(c, 500, error instanceof Error ? error.message : "Failed to fetch mock data status");
  }
};

const generateMockData = async (c: Context) => {
  try {
    const instituteId = await mockDataInstituteId(c);
    if (!instituteId) return sendError(c, 403, "You don't have permission to manage mock data");
    return sendSuccess(c, 201, "Mock data generated", await generateInstituteMockData(instituteId));
  } catch (error) {
    return sendError(c, 400, error instanceof Error ? error.message : "Failed to generate mock data");
  }
};

const removeMockData = async (c: Context) => {
  try {
    const instituteId = await mockDataInstituteId(c);
    if (!instituteId) return sendError(c, 403, "You don't have permission to manage mock data");
    return sendSuccess(c, 200, "Mock data removed", await removeInstituteMockData(instituteId));
  } catch (error) {
    return sendError(c, 500, error instanceof Error ? error.message : "Failed to remove mock data");
  }
};

export default {
  createInstitute,
  verifyInvite,
  joinInstitute,
  getSettings,
  updateGeneralSettings,
  getCandidates,
  updateLogo,
  updateMembers,
  updateRoles,
  getDepartments,
  getInstitute,
  updateInstitute,
  getPendingCandidates,
  requestToJoin,
  verifyRequest,
  cancelRequest,
  getCandidate,
  acceptCandidate,
  rejectCandidate,
  removeCandidate,
  getResume,
  leaveInstitute,
  getMockDataStatus,
  generateMockData,
  removeMockData,
};
