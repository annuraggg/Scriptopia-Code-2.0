import { Context } from "hono";
import { createWallet, getTokenBalance } from "../../config/blockchainService";
import User from "../../models/User";
import { sendError, sendSuccess } from "../../utils/sendResponse";

const getWallet = async (c: Context) => {
  try {
    const userId = c.req.param("userId");

    console.log("Fetching wallet for userId:", userId);

    const user = await User.findOne({ userId: userId });

    console.log("User found:", !!user);

    if (!user) {
      return sendError(c, 404, "User not found");
    }

    console.log("Existing user wallet:", user.wallet);

    if (!user.wallet || !user.wallet.address) {
      console.log("Creating new wallet for user");
      const newWallet = createWallet();

      user.wallet = {
        address: newWallet.address,
        privateKey: newWallet.privateKey,
        balance: 0,
      };

      await user.save();
      console.log("New wallet created:", user.wallet);
    }

    try {
      const blockchainBalance = await getTokenBalance(user.wallet.address);
      const blockchainBalanceFloat = parseFloat(blockchainBalance);

      console.log("Blockchain balance:", blockchainBalance);
      console.log("Parsed blockchain balance:", blockchainBalanceFloat);

      if (
        !isNaN(blockchainBalanceFloat) &&
        blockchainBalanceFloat !== user.wallet.balance
      ) {
        // user.wallet.balance = blockchainBalanceFloat;
        // await user.save();
        console.log("Updated wallet balance:", user.wallet.balance);
      }
    } catch (error) {
      console.error("Error updating wallet balance:", error);
    }

    console.log("Returning wallet data:", {
      walletAddress: user.wallet.address,
      balance: user.wallet.balance.toString(),
    });

    return sendSuccess(c, 200, "Wallet retrieved successfully", {
      walletAddress: user.wallet.address,
      balance: user.wallet.balance.toString(),
      success: true, // Explicitly add success flag
    });
  } catch (error) {
    console.error("Error retrieving wallet:", error);
    return sendError(c, 500, "Internal Server Error", error);
  }
};

export default { getWallet };
