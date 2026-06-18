import Institute from "../../../models/Institute";
import { sendError, sendSuccess } from "../../../utils/sendResponse";
import { Context } from "hono";
import userDirectory from "@/services/userDirectory";
import checkInstitutePermission from "../../../middlewares/checkInstitutePermission";
import PlacementGroup from "@/models/PlacementGroup";
import Candidate from "@/models/Candidate";
import Drive from "@/models/Drive";
import { z } from "zod";
import mongoose from "mongoose";
import getCampusUsersWithPermission from "@/utils/getUserWithPermission";
import { sendNotificationToCampus } from "@/utils/sendNotification";

const PlacementGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  academicYear: z.object({
    start: z.string().min(1, "Start year is required"),
    end: z.string().min(1, "End year is required"),
  }),
  departments: z
    .array(z.string())
    .min(1, "At least one department is required"),
  purpose: z.string().optional(),
  expiryDate: z.string().optional(),
  candidates: z.array(z.string()).optional().default([]),
  criteria: z.any().optional(),
});

interface UpdateData {
  [key: string]: any;
}

const createPlacementGroup = async (c: Context) => {
  try {
    const body = await c.req.json();
    console.log("Request body:", body);
    const validationResult = PlacementGroupSchema.safeParse(body);
    if (!validationResult.success) {
      console.error(validationResult.error.errors);
      return sendError(c, 400, validationResult.error.errors?.toString());
    }

    const validatedData = validationResult.data;
    const { userId, _id } = c.get("auth");

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to create placement groups"
      );
    }

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group = await PlacementGroup.create(
        [
          {
            name: validatedData.name,
            institute: instituteId,
            academicYear: validatedData.academicYear,
            criteria: validatedData.criteria || {},
            departments: validatedData.departments,
            purpose: validatedData.purpose || "",
            expiryDate: validatedData.expiryDate,
            candidates: validatedData.candidates || [],
            createdBy: _id,
            pendingCandidates: [],
          },
        ],
        { session }
      );

      await Institute.findByIdAndUpdate(
        instituteId,
        {
          $push: {
            placementGroups: group[0]._id,
            auditLogs: {
              action: "create_placement_group",
              userId: _id,
              user: accountUser.fullName,
              type: "info",
              details: `Created placement group: ${validatedData.name}`,
              timestamp: new Date(),
            },
          },
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      const institute = await Institute.findById(instituteId).lean();
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
          title: "New Placement Group Created",
          message: `A new placement group "${validatedData.name}" has been created.`,
        });
      }

      return sendSuccess(
        c,
        201,
        "Placement group created successfully",
        group[0]
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (err) {
    console.error(
      "Error creating placement group:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to create placement group");
  }
};

const getPlacementGroups = async (c: Context) => {
  try {
    const { userId } = c.get("auth");

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to view placement groups"
      );
    }

    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
    const skip = (page - 1) * limit;

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const totalCount = await PlacementGroup.countDocuments({
      institute: instituteId,
    });

    const groups = await PlacementGroup.find({ institute: instituteId })
      .populate("departments", "name")
      .populate("candidates", "name email createdAt instituteUid _id")
      .populate("createdBy", "name email")
      .populate("pendingCandidates", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return sendSuccess(c, 200, "Placement groups fetched successfully", {
      groups,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch (err) {
    console.error(
      "Error fetching placement groups:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to fetch placement groups");
  }
};

const getPlacementGroup = async (c: Context) => {
  try {
    const { userId } = c.get("auth");
    const groupId = c.req.param("id");

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return sendError(c, 400, "Invalid placement group ID");
    }

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to view placement groups"
      );
    }

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const group = await PlacementGroup.findOne({
      _id: groupId,
      institute: instituteId,
    })
      .populate("departments", "name")
      .populate("candidates", "name email instituteUid createdAt _id")
      .populate("createdBy", "name email")
      .lean();

    if (!group) {
      return sendError(
        c,
        404,
        "Placement group not found or you don't have access to it"
      );
    }

    return sendSuccess(c, 200, "Placement group fetched successfully", group);
  } catch (err) {
    console.error(
      "Error fetching placement group:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to fetch placement group");
  }
};

const joinPlacementGroup = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const { _id } = c.get("auth");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(c, 400, "Invalid placement group ID");
    }

    const user = await Candidate.findOne({ userId: _id }).lean();
    if (!user) {
      return sendError(c, 404, "User not found");
    }

    const institute = await Institute.findById(user.institute).lean();
    if (!institute) {
      return sendError(c, 404, "Institute not found");
    }

    if (
      !institute.candidates.some(
        (candidateId) => candidateId.toString() === user._id.toString()
      )
    ) {
      return sendError(
        c,
        403,
        "You are not a registered candidate of this institute"
      );
    }

    const group = await PlacementGroup.findById(id);
    if (!group) {
      return sendError(c, 404, "Placement group not found");
    }

    if (group.institute.toString() !== institute._id.toString()) {
      return sendError(c, 403, "You don't have access to this placement group");
    }

    if (
      group.candidates.some(
        (candidateId) => candidateId.toString() === user._id.toString()
      )
    ) {
      return sendError(c, 400, "You are already a member of this group");
    }

    if (
      group.pendingCandidates.some(
        (candidateId) => candidateId.toString() === user._id.toString()
      )
    ) {
      return sendError(
        c,
        400,
        "Your request to join this group is already pending"
      );
    }

    const accessType = group.get("accessType") || "private";

    if (accessType === "public") {
      group.candidates.push(user._id);
    } else {
      group.pendingCandidates.push(user._id);
    }

    await group.save();

    await Institute.findByIdAndUpdate(institute._id, {
      $push: {
        auditLogs: {
          action:
            accessType === "public" ? "joined_group" : "requested_join_group",
          userId: _id,
          user: user.name || "Candidate",
          type: "info",
          details: `${
            accessType === "public" ? "Joined" : "Requested to join"
          } placement group: ${group.name}`,
          timestamp: new Date(),
        },
      },
    });

    return sendSuccess(
      c,
      200,
      accessType === "public"
        ? "Successfully joined the placement group"
        : "Request to join placement group has been submitted",
      { group: group._id }
    );
  } catch (err) {
    console.error(
      "Error joining placement group:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to join placement group");
  }
};

const acceptCandidate = async (c: Context) => {
  try {
    const groupId = c.req.param("id");
    const { candidateId } = await c.req.json();
    const { userId, _id } = c.get("auth");

    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(candidateId)
    ) {
      return sendError(c, 400, "Invalid group or candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to manage placement groups"
      );
    }

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const group = await PlacementGroup.findOne({
      _id: groupId,
      institute: instituteId,
    });
    if (!group) {
      return sendError(
        c,
        404,
        "Placement group not found or you don't have access to it"
      );
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    if (!group.pendingCandidates.some((id) => id.toString() === candidateId)) {
      return sendError(c, 400, "Candidate not in the pending list");
    }

    group.candidates.push(candidateId);
    group.pendingCandidates = group.pendingCandidates.filter(
      (id) => id.toString() !== candidateId
    );

    await group.save();

    await Institute.findByIdAndUpdate(instituteId, {
      $push: {
        auditLogs: {
          action: "accept_candidate",
          userId: _id,
          user: accountUser.fullName,
          type: "info",
          details: `Accepted candidate ${candidate.name} to group: ${group.name}`,
          timestamp: new Date(),
        },
      },
    });

    return sendSuccess(c, 200, "Candidate accepted successfully", {
      groupId: group._id,
      candidateId,
    });
  } catch (err) {
    console.error(
      "Error accepting candidate:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to accept candidate");
  }
};

const rejectCandidate = async (c: Context) => {
  try {
    const groupId = c.req.param("id");
    const { candidateId } = await c.req.json();
    const { userId, _id } = c.get("auth");

    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(candidateId)
    ) {
      return sendError(c, 400, "Invalid group or candidate ID");
    }

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to manage placement groups"
      );
    }

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const group = await PlacementGroup.findOne({
      _id: groupId,
      institute: instituteId,
    });
    if (!group) {
      return sendError(
        c,
        404,
        "Placement group not found or you don't have access to it"
      );
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return sendError(c, 404, "Candidate not found");
    }

    if (!group.pendingCandidates.some((id) => id.toString() === candidateId)) {
      return sendError(c, 400, "Candidate not in the pending list");
    }

    group.pendingCandidates = group.pendingCandidates.filter(
      (id) => id.toString() !== candidateId
    );

    await group.save();

    await Institute.findByIdAndUpdate(instituteId, {
      $push: {
        auditLogs: {
          action: "reject_candidate",
          userId: _id,
          user: accountUser.fullName,
          type: "info",
          details: `Rejected candidate ${candidate.name} from group: ${group.name}`,
          timestamp: new Date(),
        },
      },
    });

    return sendSuccess(c, 200, "Candidate rejected successfully", {
      groupId: group._id,
      candidateId,
    });
  } catch (err) {
    console.error(
      "Error rejecting candidate:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to reject candidate");
  }
};

const getCandidatePlacementGroups = async (c: Context) => {
  try {
    const { _id } = c.get("auth");

    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
    const skip = (page - 1) * limit;

    const user = await Candidate.findOne({ userId: _id }).lean();
    if (!user) {
      return sendError(c, 404, "User not found");
    }

    const totalCount = await PlacementGroup.countDocuments({
      $or: [{ candidates: user._id }, { pendingCandidates: user._id }],
    });

    const groups = await PlacementGroup.find({
      $or: [{ candidates: user._id }, { pendingCandidates: user._id }],
    })
      .populate("departments", "name")
      .populate("candidates", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const groupsWithStatus = groups.map((group) => {
      let status = "none";
      if (
        group.candidates.some((c) => c._id?.toString() === user._id.toString())
      ) {
        status = "member";
      } else if (
        group.pendingCandidates.some(
          (c) => c.toString() === user._id.toString()
        )
      ) {
        status = "pending";
      }
      return {
        ...group,
        membershipStatus: status,
      };
    });

    return sendSuccess(c, 200, "Placement groups fetched successfully", {
      groups: groupsWithStatus,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch (err) {
    console.error(
      "Error fetching candidate placement groups:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to fetch placement groups");
  }
};

const updatePlacementGroup = async (c: Context) => {
  try {
    const { userId } = c.get("auth");
    const groupId = c.req.param("id");

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return sendError(c, 400, "Invalid placement group ID");
    }

    const body = await c.req.json();
    const updateSchema = PlacementGroupSchema.partial();
    const validationResult = updateSchema.safeParse(body);

    if (!validationResult.success) {
      return sendError(
        c,
        400,
        "Invalid request body",
        validationResult.error.errors
      );
    }

    const validatedData = validationResult.data;

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to update placement groups"
      );
    }

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const existingGroup = await PlacementGroup.findOne({
      _id: groupId,
      institute: instituteId,
    });
    if (!existingGroup) {
      return sendError(
        c,
        404,
        "Placement group not found or you don't have access to it"
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updateData: UpdateData = {};
      for (const [key, value] of Object.entries(validatedData)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      const updatedGroup = await PlacementGroup.findByIdAndUpdate(
        groupId,
        { $set: updateData },
        { new: true, session }
      )
        .populate("departments", "name")
        .populate("candidates", "name email")
        .populate("createdBy", "name email");

      await Institute.findByIdAndUpdate(
        instituteId,
        {
          $push: {
            auditLogs: {
              action: "update_placement_group",
              userId,
              user: accountUser.fullName,
              type: "info",
              details: `Updated placement group: ${existingGroup.name}`,
              timestamp: new Date(),
            },
          },
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return sendSuccess(
        c,
        200,
        "Placement group updated successfully",
        updatedGroup
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (err) {
    console.error(
      "Error updating placement group:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to update placement group");
  }
};

const deletePlacementGroup = async (c: Context) => {
  try {
    const { userId } = c.get("auth");
    const groupId = c.req.param("id");

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return sendError(c, 400, "Invalid placement group ID");
    }

    const perms = await checkInstitutePermission.all(c, ["manage_institute"]);
    if (!perms.allowed) {
      return sendError(
        c,
        403,
        "You don't have permission to delete placement groups"
      );
    }

    const accountUser = await userDirectory.users.getUser(userId);
    if (!accountUser) {
      return sendError(c, 403, "User not found");
    }

    const instituteId = (accountUser.publicMetadata.institute as any)?._id;
    if (!instituteId) {
      return sendError(c, 400, "Institute not associated with user");
    }

    const existingGroup = await PlacementGroup.findOne({
      _id: groupId,
      institute: instituteId,
    });
    if (!existingGroup) {
      return sendError(
        c,
        404,
        "Placement group not found or you don't have access to it"
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    try {
      const drives = await Drive.find({
        placementGroup: groupId,
      }).lean();

      const activeDrives = drives.filter(
        (drive) => drive.published === true || drive.hasEnded === false
      );

      if (activeDrives.length > 0) {
        await session.abortTransaction();
        return sendError(
          c,
          400,
          "Cannot delete group with active drives. Please end all drives first."
        );
      }

      await Drive.deleteMany(
        {
          placementGroup: groupId,
        },
        { session }
      );

      await Institute.findByIdAndUpdate(
        instituteId,
        {
          $pull: { placementGroups: groupId },
          $push: {
            auditLogs: {
              action: "delete_placement_group",
              userId,
              user: accountUser.fullName,
              type: "warning",
              details: `Deleted placement group: ${existingGroup.name}`,
              timestamp: new Date(),
            },
          },
        },
        { session }
      );

      await PlacementGroup.findByIdAndDelete(groupId, { session });

      await session.commitTransaction();
      committed = true;
      session.endSession();

      const groupName = existingGroup.name;
      const groupInstitute = existingGroup.institute;

      const response = sendSuccess(
        c,
        200,
        "Placement group deleted successfully"
      );

      try {
        const notifyingUsers = await getCampusUsersWithPermission({
          institute: groupInstitute,
          permissions: ["manage_drive"],
        });

        if (notifyingUsers.length > 0) {
          sendNotificationToCampus({
            userIds: notifyingUsers,
            title: "Placement Group Deleted",
            message: `The placement group "${groupName}" has been deleted.`,
          }).catch((err) => {
            console.error(
              "Failed to send notification after placement group deletion:",
              err
            );
          });
        }
      } catch (notificationErr) {
        console.error("Error preparing notifications:", notificationErr);
      }

      return response;
    } catch (error) {
      if (!committed) {
        await session.abortTransaction();
      }
      session.endSession();
      throw error;
    }
  } catch (err) {
    console.error(
      "Error deleting placement group:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return sendError(c, 500, "Failed to delete placement group");
  }
};

export default {
  createPlacementGroup,
  getPlacementGroups,
  getPlacementGroup,
  joinPlacementGroup,
  acceptCandidate,
  rejectCandidate,
  getCandidatePlacementGroups,
  updatePlacementGroup,
  deletePlacementGroup,
};
