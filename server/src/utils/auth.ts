import jwt, { JwtPayload } from "jsonwebtoken";
import Organization from "@/models/Organization";
import Institute from "@/models/Institute";
import { UserMeta } from "@shared-types/UserMeta";

export interface SessionClaims extends JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
}

export const signSessionToken = (claims: SessionClaims) =>
  jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: "7d" });

export const verifySessionToken = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET!) as SessionClaims;

export const getUserMetadata = async (userId: string): Promise<UserMeta> => {
  const [organization, institute] = await Promise.all([
    Organization.findOne({ "members.user": userId }).lean(),
    Institute.findOne({ "members.user": userId }).lean(),
  ]);

  const organizationMember = organization?.members?.find(
    (member: any) => member.user?.toString() === userId
  );
  const organizationRole = organization?.roles?.find(
    (role: any) => role.slug === organizationMember?.role
  );

  const instituteMember = institute?.members?.find(
    (member: any) => member.user?.toString() === userId
  );
  const instituteRole = institute?.roles?.find(
    (role: any) => role.slug === instituteMember?.role
  );

  return {
    _id: userId,
    organization:
      organization && organizationRole
        ? {
            _id: organization._id.toString(),
            name: organization.name,
            role: organizationRole as any,
          }
        : undefined,
    institute:
      institute && instituteRole
        ? {
            _id: institute._id.toString(),
            name: institute.name,
            role: instituteRole as any,
          }
        : undefined,
  };
};
