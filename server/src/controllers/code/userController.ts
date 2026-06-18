import { Context } from "hono";
import { sendError, sendSuccess } from "../../utils/sendResponse";
import logger from "../../utils/logger";
import Notification from "@/models/Notification";

const getNotificationsForUser = async (c: Context) => {
  try {
    const platform = c.req.query("platform") as string;
    const userId = c.get("auth")._id;

    if (!platform) {
      return sendError(c, 400, "Platform is required");
    }

    const notifications = await Notification.find({
      userIds: { $in: [userId] },
      platform,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (notifications.length === 0) {
      return sendSuccess(c, 200, "No notifications found", []);
    }

    // Remove userIds and only keep userId of the current user
    const filteredNotifications = notifications.map((notification) => {
      const { userIds, readBy, ...rest } = notification;
      return {
        ...rest,
        userId: [userIds.find((id) => id.toString() === userId)],
        readBy: [readBy.find((id) => id.toString() === userId)],
      };
    });

    return sendSuccess(
      c,
      200,
      "Notifications fetched successfully",
      filteredNotifications
    );
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to fetch notifications");
  }
};

const markNotificationAsRead = async (c: Context) => {
  const { id } = await c.req.param();
  const userId = c.get("auth")._id;

  if (!id) {
    return sendError(c, 400, "Notification ID is required");
  }

  try {
    const notification = await Notification.findById(id);

    if (!notification) {
      return sendError(c, 404, "Notification not found");
    }

    if (notification.userIds.includes(userId)) {
      await Notification.updateOne(
        { _id: id },
        { $addToSet: { readBy: userId } }
      );
    }

    return sendSuccess(c, 200, "Notification marked as read successfully");
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to mark notification as read");
  }
};

export default {
  getNotificationsForUser,
  markNotificationAsRead,
};
