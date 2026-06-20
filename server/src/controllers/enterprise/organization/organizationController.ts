import { Context } from "hono";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import Organization from "../../../models/Organization";
import User from "../../../models/User";
import jwt from "jsonwebtoken";
import loops from "../../../config/loops";
import userDirectory from "@/services/userDirectory";
import logger from "../../../utils/logger";
import r2Client from "../../../config/s3";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { AuditLog, Member } from "@shared-types/Organization";
import { Role } from "@shared-types/Organization";
import defaultOrganizationRoles from "@/data/defaultOrganizationRoles";
import organizationPermissions from "@/data/organizationPermissions";
import checkOrganizationPermission from "@/middlewares/checkOrganizationPermission";
import Posting from "@/models/Posting";
import { Candidate } from "@shared-types/Candidate";
import { MemberWithPermission } from "@shared-types/MemberWithPermission";
import { UserMeta } from "@shared-types/UserMeta";
import { Types } from "mongoose";

const createOrganization = async (c: Context) => {
  try {
    const { name, email, website, members } = await c.req.json();
    const accountUserId = c.get("auth").userId;

    const accountUser = await userDirectory.users.getUser(accountUserId);
    const fName = accountUser.firstName;
    const lName = accountUser.lastName;
    const uid = accountUser.publicMetadata._id;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const websiteRegex = /(http|https):\/\/[^ "]*/;

    if (!name || !email || !website || !members) {
      return sendError(c, 400, "Please fill all fields");
    }

    if (!emailRegex.test(email)) {
      return sendError(c, 400, "Invalid email address");
    }

    if (!websiteRegex.test(website)) {
      return sendError(c, 400, "Invalid website address");
    }

    const existingOrg = await Organization.findOne({ email });
    if (existingOrg) {
      return sendError(c, 400, "Organization with this email already exists");
    }

    const userInOrg = await Organization.findOne({
      members: { $elemMatch: { user: uid } },
    });

    if (userInOrg) {
      return sendError(c, 400, "User is already part of an organization");
    }

    const membersArr = [];
    for (const member of members) {
      if (!member.email || !member.role) {
        return sendError(c, 400, "Please fill all fields");
      }

      if (!emailRegex.test(member.email)) {
        return sendError(c, 400, "Invalid email address");
      }

      const user = await User.findOne({ email });
      const role = defaultOrganizationRoles.find(
        (r) => r.slug === member.role.toLowerCase()
      );

      const mem = {
        user: user?._id || null,
        email: member.email,
        role: role?.slug,
        addedOn: new Date(),
        status: "pending",
      };

      membersArr.push(mem);
    }

    const creator = await userDirectory.users.getUser(accountUserId);

    if (!creator) {
      return sendError(c, 404, "User not found");
    }

    const adminRole = defaultOrganizationRoles.find(
      (role) => role.slug === "administrator"
    );

    membersArr.push({
      user: uid,
      email: creator.emailAddresses[0].emailAddress,
      role: adminRole?.slug,
      addedOn: new Date(),
      status: "active",
    });

    const auditLog: AuditLog = {
      user: fName + " " + lName,
      userId: uid as string,
      action: "Organization Created",
      type: "info",
    };

    const org = await Organization.create({
      name,
      email,
      website,
      members: membersArr,
      subscription: {
        type: "trial",
        status: "active",
        startedOn: new Date(),
        endsOn: new Date(new Date().setDate(new Date().getDate() + 15)),
      },
      roles: defaultOrganizationRoles,
      auditLogs: [auditLog],
    });

    const role = org.roles.find((r: any) => r.slug === "administrator");

    userDirectory.users.updateUser(accountUserId as string, {
      publicMetadata: {
        ...accountUser.publicMetadata,
        organization: {
          _id: org._id,
          name: org.name,
          role: role,
        },
      },
    });

    for (const member of members) {
      const role = defaultOrganizationRoles.find(
        (r) => r.slug === member.role.toLowerCase()
      );

      const reqObj = {
        email: member.email,
        role: role?.slug,
        organization: org._id,
        inviter: fName || "",
        inviterId: uid,
        organizationname: name,
      };

      const token = jwt.sign(reqObj, process.env.JWT_SECRET!);

      await loops.sendTransactionalEmail({
        transactionalId: process.env.LOOPS_INVITE_EMAIL!,
        email: member.email,
        dataVariables: {
          inviter: fName || "",
          joinlink:
            process.env.ENTERPRISE_FRONTEND_URL! + "/join?token=" + token,
          organizationname: name,
        },
      });
    }

    return sendSuccess(c, 201, "Organization created successfully", {
      org: org._id,
    });
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to create organization", error);
  }
};

const verifyInvite = async (c: Context) => {
  try {
    const { token } = await c.req.json();
    const cid = c.get("auth").userId;
    const accountUser = await userDirectory.users.getUser(cid);
    const email = accountUser.emailAddresses[0].emailAddress;

    if (!token) {
      return sendError(c, 400, "Invalid token");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      organization: string;
    };

    const org = await Organization.findById(decoded.organization);
    if (!org) {
      return sendError(c, 404, "Organization not found");
    }

    const organization = await Organization.findOne({
      _id: decoded.organization,
      members: { $elemMatch: { email, status: "pending" } },
    });

    if (!organization) {
      logger.warn("No organization found");
      return sendError(c, 400, "Invalid Invite");
    }

    return sendSuccess(c, 200, "Token verified", decoded);
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to verify token", error);
  }
};

const joinOrganization = async (c: Context) => {
  try {
    const { status, token } = await c.req.json();
    const userId = c.get("auth")._id;
    const cid = c.get("auth").userId;
    const accountUser = await userDirectory.users.getUser(cid);
    const email = accountUser.emailAddresses[0].emailAddress;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      organization: string;
    } as {
      role: string;
      organization: string;
      inviterId: string;
    };

    const org = await Organization.findById(decoded.organization);
    if (!org) {
      return sendError(c, 404, "Organization not found");
    }

    const organization = await Organization.findOne({
      _id: decoded.organization,
      members: { $elemMatch: { email, status: "pending" } },
    });

    if (!organization) {
      return sendError(c, 400, "Invalid Invite");
    }

    if (organization._id.toString() !== decoded.organization) {
      return sendError(c, 400, "Invalid Invite");
    }

    const role = org.roles.find((r: any) => r.slug === decoded.role);

    if (status === "accept") {
      userDirectory.users.updateUser(cid, {
        publicMetadata: {
          ...accountUser.publicMetadata,
          organization: {
            _id: decoded.organization,
            name: org.name,
            role: role,
          },
        },
      });

      const inviterUser = await User.findById(decoded.inviterId);
      if (!inviterUser) {
        return sendError(c, 404, "Inviter not found");
      }

      const inviterAccount = await userDirectory.users.getUser(
        inviterUser._id.toString()
      );
      const auditLog: AuditLog = {
        user: accountUser.firstName + " " + accountUser.lastName,
        userId: userId,
        action: `User Joined Organization. Invited By: ${
          inviterAccount.firstName + " " + inviterAccount.lastName
        }`,
        type: "info",
      };

      await Organization.updateOne(
        { _id: decoded.organization, "members.email": email },
        { $set: { "members.$.status": "active", "members.$.user": userId } },
        { $push: { auditLogs: auditLog } }
      );
    } else {
      await Organization.updateOne(
        { _id: decoded.organization, "members.email": email },
        { $pull: { members: { email } } }
      );
    }

    return sendSuccess(c, 200, "Joined Organization", {
      id: decoded.organization,
    });
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to join organization", error);
  }
};

const getSettings = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, [
      "view_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const org = await Organization.findById(perms.data?.organization?._id)
      .populate("auditLogs.user")
      .populate("members.user")
      .lean();

    if (!org) {
      return sendError(c, 404, "Organization not found");
    }

    const logoUrl = org.logo;
    try {
      if (logoUrl) {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_S3_BUCKET!,
          Key: logoUrl,
        });

        const data = await r2Client.send(command);
        const buffer = await data.Body?.transformToByteArray();
        const base64 = Buffer.from(buffer as unknown as ArrayBuffer).toString(
          "base64"
        );
        org.logo = `data:image/png;base64,${base64}`;
      }
    } catch (e) {
      console.log("Failed to fetch logo", e);
      console.log(e);
    }

    return sendSuccess(c, 200, "Success", {
      ...org,
      permissions: organizationPermissions,
    });
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to fetch organization settings", error);
  }
};

const updateOrganization = async (c: Context) => {
  try {
    // Check permissions for managing organization
    const perms = await checkOrganizationPermission.all(c, [
      "manage_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const orgId = perms.data?.organization?._id;
    const body = await c.req.json();

    // Fetch original organization
    const org = await Organization.findById(orgId).lean();
    if (!org) {
      logger.error("Organization not found:");
      return sendError(c, 404, "Organization not found");
    }

    // Get current user for audit and invitation purposes
    const currentUser = await userDirectory.users.getUser(c.get("auth").userId);
    const inviterName = `${currentUser.firstName || ""} ${
      currentUser.lastName || ""
    }`.trim();

    // Handle member changes
    const oldMembers = org.members || [];
    const newMembers = body.members || [];

    // Find removed members (present in old but not in new)
    const oldEmails = oldMembers.map((m) => m.email);
    const newEmails = newMembers.map((m: Member) => m.email);
    const removedEmails = oldEmails.filter(
      (email) => !newEmails.includes(email)
    );

    // Process metadata updates for removed members
    if (removedEmails.length > 0) {
      const removedMembers = oldMembers.filter(
        (member) => removedEmails.includes(member.email) && member.user
      );

      await Promise.all(
        removedMembers.map(async (member) => {
          if (!member.user) return;

          try {
            const user = await User.findById(member.user);
            if (!user?._id) return;

            const accountUserToUpdate = await userDirectory.users.getUser(
              user._id.toString()
            );
            const currentMetadata =
              accountUserToUpdate.publicMetadata as unknown as UserMeta;

            // Remove organization from metadata if it matches current org
            if (currentMetadata.organization?._id === orgId) {
              await userDirectory.users.updateUser(user._id.toString(), {
                publicMetadata: {
                  ...currentMetadata,
                  organization: null,
                },
              });
            }
          } catch (error) {
            logger.error(
              `Failed to update identity provider metadata for removed user: ${member.user}`
            );
          }
        })
      );
    }

    // Handle role changes for existing members
    const existingMembers = newMembers.filter(
      (member: Member) =>
        oldEmails.includes(member.email) && member.status === "active"
    );

    await Promise.all(
      existingMembers.map(async (newMember: Member) => {
        const oldMember = oldMembers.find((m) => m.email === newMember.email);
        if (!oldMember?.user || oldMember.role === newMember.role) return;

        try {
          const user = await User.findById(oldMember.user);
          if (!user?._id) return;

          const accountUserToUpdate = await userDirectory.users.getUser(
            user._id.toString()
          );
          const currentMetadata =
            accountUserToUpdate.publicMetadata as unknown as UserMeta;

          if (currentMetadata.organization?._id === orgId) {
            const role = org.roles.find(
              (r: any) => r.slug === newMember.role
            ) as Role | undefined;
            if (!role) return;

            await userDirectory.users.updateUser(user._id.toString(), {
              publicMetadata: {
                ...currentMetadata,
                organization: {
                  ...currentMetadata.organization,
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
      })
    );

    // Handle new pending invites
    const oldPendingEmails = oldMembers
      .filter((member) => member.status === "pending")
      .map((member) => member.email);

    const newPendingMembers = newMembers.filter(
      (member: Member) =>
        member.status === "pending" && !oldPendingEmails.includes(member.email)
    );

    // Send invites to new pending members
    await Promise.all(
      newPendingMembers.map(async (member: Member) => {
        const role = org.roles.find((r: any) => r.slug === member.role) as
          | Role
          | undefined;
        if (!role) {
          logger.error(`Role not found for member: ${member.email}`);
          return;
        }

        const reqObj = {
          email: member.email,
          role: role.slug,
          organization: orgId,
          inviter: inviterName,
          inviterId: currentUser?.publicMetadata?._id,
          organizationname: body.name || org.name,
        };

        const token = jwt.sign(reqObj, process.env.JWT_SECRET!);

        try {
          await loops.sendTransactionalEmail({
            transactionalId: process.env.LOOPS_INVITE_EMAIL!,
            email: member.email,
            dataVariables: {
              inviter: inviterName,
              joinlink: `${process.env
                .ENTERPRISE_FRONTEND_URL!}/join?token=${token}`,
              organizationname: body.name || org.name,
            },
          });
          logger.info(`Invite sent to: ${member.email}`);
        } catch (error) {
          logger.error(`Failed to send invite to: ${member.email}`);
        }
      })
    );

    // Create audit log
    const auditLog = {
      user: inviterName,
      userId: currentUser?.publicMetadata?._id,
      action: "Organization Updated",
      type: "info",
    };

    // Update organization with new data and audit log
    const updatedOrg = await Organization.findByIdAndUpdate(
      orgId,
      {
        ...body,
        $push: { auditLog: auditLog },
      },
      { new: true }
    );

    if (!updatedOrg) {
      return sendError(c, 404, "Organization not found");
    }

    return sendSuccess(
      c,
      200,
      "Organization settings updated successfully",
      updatedOrg
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to update organization settings", error);
  }
};

const updateGeneralSettings = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, [
      "manage_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const { name, email, website } = await c.req.json();
    const orgId = perms.data?.organization?._id;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const websiteRegex = /(http|https):\/\/[^ "]*/;

    if (!name || !email || !website) {
      return sendError(c, 400, "Please fill all required fields");
    }

    if (!emailRegex.test(email)) {
      return sendError(c, 400, "Invalid email address");
    }

    if (!websiteRegex.test(website)) {
      return sendError(c, 400, "Invalid website address");
    }

    const user = await userDirectory.users.getUser(c.get("auth").userId);

    const auditLog: AuditLog = {
      user: user.firstName + " " + user.lastName,
      userId: c.get("auth")._id,
      action: "Organization General Settings Updated",
      type: "info",
    };

    const org = await Organization.findById(orgId).populate("members.user");
    if (!org) {
      return sendError(c, 404, "Organization not found");
    }

    if (name !== org.name) {
      for (const member of org.members) {
        if (!member.user) continue;
        const userDoc = await User.findById(member.user);
        if (!userDoc) continue;
        const u = await userDirectory.users.getUser(userDoc._id.toString());
        const publicMetadata = u.publicMetadata;
        (publicMetadata.organization as { name: string }).name = name;

        await userDirectory.users.updateUser(userDoc._id.toString(), {
          publicMetadata,
        });
      }
    }

    org.name = name;
    org.email = email;
    org.website = website;
    org.auditLogs.push(auditLog);

    await org.save();

    return sendSuccess(
      c,
      200,
      "Organization settings updated successfully",
      org
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to update organization settings", error);
  }
};

const updateLogo = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, [
      "manage_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    // Parse the incoming request body
    const file = await c.req.json();

    if (!file.logo) {
      return sendError(c, 400, "Please provide a file");
    }

    const buffer = Buffer.from(
      file.logo.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const orgId = perms.data?.organization?._id;
    const uploadParams = {
      Bucket: process.env.R2_S3_BUCKET!,
      Key: `org-logos/${orgId}.png`,
      Body: buffer,
      ContentEncoding: "base64",
      ContentType: "image/png",
    };

    const upload = new Upload({
      client: r2Client,
      params: uploadParams,
    });

    await upload.done();

    const user = await userDirectory.users.getUser(c.get("auth").userId);
    const auditLog: AuditLog = {
      user: user.firstName + " " + user.lastName,
      userId: c.get("auth")._id,
      action: "Organization Logo Updated",
      type: "info",
    };

    const updatedOrg = await Organization.findByIdAndUpdate(orgId, {
      $set: { logo: `org-logos/${orgId}.png` },
      $push: { auditLogs: auditLog },
    });

    if (!updatedOrg) {
      return sendError(c, 404, "Organization not found");
    }

    return c.json({ message: "Logo updated successfully" });
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to update organization logo", error);
  }
};

const updateMembers = async (c: Context) => {
  try {
    // Check permissions for managing organization
    const perms = await checkOrganizationPermission.all(c, [
      "manage_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const { members } = await c.req.json();
    const orgId = perms.data?.organization?._id;

    // Fetch organization and validate existence
    const organization = await Organization.findById(orgId);
    if (!organization) {
      return sendError(c, 404, "Organization not found");
    }

    // Get current user details for audit logging
    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const fullName = `${accountUser.firstName || ""} ${
      accountUser.lastName || ""
    }`.trim();

    // Find members that were removed (present in old members but not in new members)
    const oldMemberEmails = organization.members.map((member) => member.email);
    const newMemberEmails = members.map((member: Member) => member.email);
    const removedMemberEmails = oldMemberEmails.filter(
      (email) => !newMemberEmails.includes(email)
    );

    // Process metadata updates for both removed members and role changes
    const metadataUpdates = [];

    // Handle removed members
    if (removedMemberEmails.length > 0) {
      const removedMembers = organization.members.filter(
        (member) => removedMemberEmails.includes(member.email) && member.user
      );

      metadataUpdates.push(
        ...removedMembers.map(async (member) => {
          if (!member.user) return;

          try {
            const user = await User.findById(member.user);
            if (!user?._id) return;

            const accountUserToUpdate = await userDirectory.users.getUser(
              user._id.toString()
            );
            const currentMetadata: UserMeta =
              accountUserToUpdate.publicMetadata as unknown as UserMeta;

            // Remove organization from metadata if it matches current org
            if (currentMetadata.organization?._id === orgId) {
              await userDirectory.users.updateUser(user._id.toString(), {
                publicMetadata: {
                  ...currentMetadata,
                  organization: null,
                },
              });
            }
          } catch (error) {
            logger.error(
              `Failed to update identity provider metadata for user: ${member.user}`
            );
          }
        })
      );
    }

    // Handle role changes for existing members
    const existingMembers = members.filter(
      (member: Member) =>
        oldMemberEmails.includes(member.email) && member.status === "active"
    );

    existingMembers.forEach((newMember: Member) => {
      const oldMember = organization.members.find(
        (m) => m.email === newMember.email
      );

      if (!oldMember || !oldMember.user) return;

      // Check if role has changed

      if (oldMember.role !== newMember.role) {
        metadataUpdates.push(async () => {
          try {
            const user = await User.findById(oldMember.user);
            if (!user?._id) return;

            const accountUserToUpdate = await userDirectory.users.getUser(
              user._id.toString()
            );
            const currentMetadata: UserMeta =
              accountUserToUpdate.publicMetadata as unknown as UserMeta;

            // Update organization role in metadata
            if (currentMetadata.organization?._id === orgId) {
              const role = organization.roles.find(
                (r: any) => r.slug === newMember.role
              );

              await userDirectory.users.updateUser(user._id.toString(), {
                publicMetadata: {
                  ...currentMetadata,
                  organization: {
                    ...currentMetadata.organization,
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
        });
      }
    });

    // Execute all metadata updates in parallel
    await Promise.all(metadataUpdates);

    // Handle new pending member invites
    const oldPendingMembers = organization.members.filter(
      (member) => member.status === "pending"
    );
    const newPendingMembers = members.filter(
      (member: Member) => member.status === "pending"
    );

    // Send invites to new pending members
    if (oldPendingMembers.length !== newPendingMembers.length) {
      const newPendingEmails = newPendingMembers.map((m: Member) => m.email);
      const oldPendingEmails = oldPendingMembers.map((m) => m.email);
      const newInviteEmails = newPendingEmails.filter(
        (email: string) => !oldPendingEmails.includes(email)
      );

      await Promise.all(
        newInviteEmails.map(async (email: string) => {
          const member = members.find((m: Member) => m.email === email);
          const reqObj = {
            email,
            role: member.role.name,
            roleId: member.role._id,
            organization: orgId,
            inviter: accountUser.firstName || "",
            inviterId: c.get("auth")._id,
            organizationname: organization.name,
          };

          const token = jwt.sign(reqObj, process.env.JWT_SECRET!);

          return loops.sendTransactionalEmail({
            transactionalId: process.env.LOOPS_INVITE_EMAIL!,
            email,
            dataVariables: {
              inviter: accountUser.firstName || "",
              joinlink: `${process.env
                .ENTERPRISE_FRONTEND_URL!}/join?token=${token}`,
              organizationname: organization.name,
            },
          });
        })
      );
    }

    // Prepare final member updates
    const finalMembers = members.map((member: Member) => ({
      user:
        (member.user as any)?._id?.toString() ||
        (member.user as any)?.id ||
        null,
      email: member.email,
      role: member.role,
      status: member.status,
    }));

    // Create audit log
    const auditLog = {
      user: fullName,
      userId: c.get("auth")._id,
      action: "Organization Members Updated",
      type: "info",
    };

    // Update organization with new members and audit log
    const updatedOrg = await Organization.findByIdAndUpdate(
      orgId,
      {
        $set: { members: finalMembers },
        $push: { auditLogs: auditLog },
      },
      { new: true }
    );

    if (!updatedOrg) {
      return sendError(c, 404, "Organization not found");
    }

    return sendSuccess(
      c,
      200,
      "Organization settings updated successfully",
      members
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to update organization settings", error);
  }
};

const updateRoles = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, [
      "manage_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const { roles } = await c.req.json();
    const finalRoles: Role[] = [];

    for (const role of roles) {
      const roleObj: Role = {
        name: role.name,
        slug: role.slug,
        description: role.description,
        permissions: role.permissions,
        default: role.default,
      };

      finalRoles.push(roleObj);
    }

    const orgId = perms.data?.organization?._id;
    const organization = await Organization.findById(orgId);

    if (!organization) {
      return sendError(c, 404, "Organization not found");
    }

    const accountUser = await userDirectory.users.getUser(c.get("auth").userId);
    const fName = accountUser.firstName;
    const lName = accountUser.lastName;

    const auditLog: AuditLog = {
      user: fName + " " + lName,
      userId: c.get("auth")._id,
      action: "Organization Roles Updated",
      type: "info",
    };

    finalRoles.push(...defaultOrganizationRoles);

    const updatedOrg = await Organization.findByIdAndUpdate(orgId, {
      $set: { roles: finalRoles },
      $push: { auditLogs: auditLog },
    });

    if (!updatedOrg) {
      return sendError(c, 404, "Organization not found");
    }

    return sendSuccess(
      c,
      200,
      "Organization settings updated successfully",
      updatedOrg
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to update organization settings", error);
  }
};

const getCandidates = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, ["view_job"]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const orgId = perms.data?.organization?._id;

    const posting = await Posting.find({ organizationId: orgId })
      .populate("candidates")
      .lean();

    const candidates = new Set<Candidate>();
    const emails = new Set<string>();

    for (const post of posting) {
      const postCandidates = post.candidates;
      for (const candidate of postCandidates) {
        const cand: Candidate = candidate as unknown as Candidate;

        if (!emails.has(cand.email)) {
          emails.add(cand.email);
          candidates.add(cand);
        }
      }
    }

    return sendSuccess(
      c,
      200,
      "Candidates fetched successfully",
      Array.from(candidates)
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to fetch candidates", error);
  }
};

const getDepartments = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, [
      "view_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const orgId = perms.data?.organization?._id;
    const org = await Organization.findById(orgId).lean();

    if (!org) {
      return sendError(c, 404, "Organization not found");
    }

    return sendSuccess(
      c,
      200,
      "Departments fetched successfully",
      org.departments
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to fetch departments", error);
  }
};

const updateDepartments = async (c: Context) => {
  try {
    const perms = await checkOrganizationPermission.all(c, [
      "manage_organization",
    ]);
    if (!perms.allowed) {
      return sendError(c, 401, "Unauthorized");
    }

    const { departments } = await c.req.json();

    const orgId = perms.data?.organization?._id;

    const user = await userDirectory.users.getUser(c.get("auth").userId);
    const fName = user.firstName;
    const lName = user.lastName;

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return sendError(c, 404, "Organization not found");
    }

    organization.departments = departments;
    organization.auditLogs.push({
      user: fName + " " + lName,
      userId: c.get("auth")._id,
      action: "Departments Updated",
      type: "info",
    });
    await organization.save();

    return sendSuccess(c, 200, "Departments updated successfully", {
      departments: organization.departments,
    });
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to update departments", error);
  }
};

const permissionFieldMap = {
  manage_job: [
    "name",
    "email",
    "website",
    "logo",
    "departments",
    "candidates",
    "postings",
  ],
  view_job: [
    "name",
    "email",
    "website",
    "logo",
    "departments",
    "candidates",
    "postings",
  ],
  view_organization: [
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
    "postings",
  ],
  manage_organization: [
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
    "postings",
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
    "postings",
  ],
  interviewer: [
    "name",
    "email",
    "website",
    "logo",
    "departments",
    "candidates",
    "postings",
  ],
};

const getOrganization = async (c: Context): Promise<Response> => {
  try {
    const userId = c.get("auth")._id;

    const org = await Organization.findOne({
      "members.user": userId,
    })
      .populate("postings")
      .populate("members.user")
      .lean();

    if (!org) {
      return sendError(c, 404, "Organization not found");
    }

    // Find member and validate role in one pass
    const member = org.members.find(
      (m) =>
        (
          m?.user as Types.ObjectId | { _id: Types.ObjectId }
        )?._id?.toString() === userId?.toString()
    );
    if (!member?.role) {
      return sendError(c, 403, "Invalid member access");
    }

    // Get role permissions
    const role = defaultOrganizationRoles.find((r) => r.slug === member.role);
    if (!role?.permissions?.length) {
      return sendError(c, 403, "No permissions found for role");
    }

    const fieldsToSelect = [
      ...new Set(
        role.permissions.flatMap(
          // @ts-expect-error - TS doesn't like flatMap
          (permission) => permissionFieldMap[permission] || []
        )
      ),
    ];

    const [selectedOrg, userDetails] = await Promise.all([
      Organization.findById(org._id)
        .populate("postings")
        .select(fieldsToSelect.join(" ")),
      User.findOne({ _id: member.user }).lean(),
    ]);

    if (!selectedOrg || !userDetails) {
      return sendError(c, 404, "Required data not found");
    }

    const user: MemberWithPermission = {
      ...member, // @ts-expect-error - TS sucks
      userInfo: userDetails,
      permissions: role.permissions,
    };

    const logoUrl = selectedOrg.logo;
    try {
      if (logoUrl) {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_S3_BUCKET!,
          Key: logoUrl,
        });

        let data = null;
        try {
          data = await r2Client.send(command);
          const buffer = await data?.Body?.transformToByteArray();
          const base64 = Buffer.from(buffer as unknown as ArrayBuffer)?.toString(
            "base64"
          );
          selectedOrg.logo = `data:image/png;base64,${base64}`;
        } catch (e) {}
      }
    } catch (e) {
      console.log("Failed to fetch logo", e);
      console.log(e);
    }

    console.log("Selected Org", selectedOrg.departments);

    return sendSuccess(c, 200, "Organization fetched successfully", {
      organization: selectedOrg,
      user,
    });
  } catch (error) {
    logger.error("Failed to fetch organization: " + error);
    return sendError(c, 500, "Failed to fetch organization", error);
  }
};

export default {
  createOrganization,
  verifyInvite,
  joinOrganization,
  getSettings,
  updateGeneralSettings,
  getCandidates,
  updateLogo,
  updateMembers,
  updateRoles,
  getDepartments,
  updateDepartments,
  getOrganization,
  updateOrganization,
};
