import { sendError } from "../utils/sendResponse";
import { Context } from "hono";
import logger from "../utils/logger";
import { UserMeta } from "@shared-types/UserMeta";
import { getUserMetadata } from "@/utils/auth";

interface ReturnType {
  allowed: boolean;
  data: UserMeta | null;
}

class checkOrganizationPermission {
  private static async getUserMeta(userId: string) {
    try {
      return await getUserMetadata(userId);
    } catch (error) {
      throw new Error("Error retrieving or verifying user Meta");
    }
  }

  static all = async (
    c: Context<any, any, {}>,
    permissions: string[]
  ): Promise<ReturnType> => {
    const auth = c.get("auth");
    if (!auth?.userId) {
      sendError(c, 401, "Unauthorized in checkPermission");
      return { allowed: false, data: null };
    }

    try {
      const userMeta = await checkOrganizationPermission.getUserMeta(
        auth.userId
      );

      const hasPermission = permissions.every((permission) =>
        userMeta.organization?.role?.permissions.includes(permission)
      );

      return { allowed: hasPermission, data: userMeta };
    } catch (error) {
      logger.error(error as string);
      return { allowed: false, data: null };
    }
  };

  static some = async (
    c: Context<any, any, {}>,
    permissions: string[]
  ): Promise<ReturnType> => {
    const auth = c.get("auth");
    if (!auth?.userId) {
      sendError(c, 401, "Unauthorized in checkPermission");
      return { allowed: false, data: null };
    }

    try {
      const userMeta = await checkOrganizationPermission.getUserMeta(
        auth.userId
      );
      const hasPermission = permissions.some((permission) =>
        userMeta.organization?.role?.permissions.includes(permission)
      );

      return { allowed: hasPermission, data: userMeta };
    } catch (error) {
      logger.error(error as string);
      return { allowed: false, data: null };
    }
  };
}

export default checkOrganizationPermission;
