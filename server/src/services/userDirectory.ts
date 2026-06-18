import User from "@/models/User";
import { getUserMetadata } from "@/utils/auth";
import { hashPassword } from "@/utils/password";

const serializeUser = async (user: any) => {
  if (!user) throw new Error("User not found");

  const publicMetadata = await getUserMetadata(user._id.toString());
  return {
    id: user._id.toString(),
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    fullName:
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email,
    imageUrl: user.imageUrl || "",
    emailAddresses: [
      {
        id: user._id.toString(),
        emailAddress: user.email,
      },
    ],
    primaryEmailAddressId: user._id.toString(),
    publicMetadata,
    privateMetadata: {
      isSample: user.isSample || false,
      sampleInstituteId: user.sampleInstituteId,
    },
  };
};

const getUser = async (id: string) => serializeUser(await User.findById(id));

const updateUser = async (
  id: string,
  changes: {
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    password?: string;
    publicMetadata?: unknown;
    privateMetadata?: Record<string, any>;
  }
) => {
  const update: Record<string, unknown> = {};
  if (changes.firstName !== undefined) update.firstName = changes.firstName;
  if (changes.lastName !== undefined) update.lastName = changes.lastName;
  if (changes.imageUrl !== undefined) update.imageUrl = changes.imageUrl;
  if (changes.password) update.passwordHash = hashPassword(changes.password);
  if (changes.privateMetadata?.isSample !== undefined) {
    update.isSample = changes.privateMetadata.isSample;
  }
  if (changes.privateMetadata?.sampleInstituteId !== undefined) {
    update.sampleInstituteId = changes.privateMetadata.sampleInstituteId;
  }

  const user = await User.findByIdAndUpdate(id, update, { new: true });
  return serializeUser(user);
};

const createUser = async (data: {
  emailAddress: string[];
  password?: string;
  firstName?: string;
  lastName?: string;
  privateMetadata?: Record<string, unknown>;
  skipPasswordChecks?: boolean;
}) => {
  const email = data.emailAddress[0]?.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const user = await User.create({
    email,
    passwordHash: data.password ? hashPassword(data.password) : undefined,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    name: [data.firstName, data.lastName].filter(Boolean).join(" "),
    isSample: data.privateMetadata?.isSample || false,
    sampleInstituteId: data.privateMetadata?.sampleInstituteId,
  });

  return serializeUser(user);
};

const deleteUser = async (id: string) => User.findByIdAndDelete(id);

const userDirectory = {
  users: {
    getUser,
    updateUser,
    createUser,
    deleteUser,
  },
};

export default userDirectory;
