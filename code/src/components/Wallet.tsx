import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Spinner,
} from "@heroui/react";
import { CoinsIcon, ExternalLinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import ax from "@/config/axios";
import { useAuth } from "@/auth";

interface WalletProps {
  userId: string;
  refetch?: boolean;
}

const Wallet: React.FC<WalletProps> = ({ userId, refetch }) => {
  const [balance, setBalance] = useState<string>("0");
  const [address, setAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);



  useEffect(() => {
    const initializeWallet = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching wallet for userId:", userId);

        const { data } = await axios.get(`/wallet/${userId}`);
        console.log("Wallet API Response:", data);

        if (data.success) {
          // Provide default values if undefined
          setAddress(data.data.walletAddress || "");
          setBalance(data.data.balance || "0");
        } else {
          console.log("Wallet creation unsuccessful", data);
          toast.error("Failed to retrieve wallet information");
        }
      } catch (error) {
        console.error("Error initializing wallet:", error);
        toast.error("Failed to load wallet information");
        setBalance("0");
        setAddress("");
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      initializeWallet();
    }
  }, [userId, refetch]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard!");
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="bg-gradient-to-r from-purple-400 to-blue-500 text-white"
        >
          <CoinsIcon size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Card className="w-[300px]">
          <CardBody>
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-bold">Your Scrypto Wallet</h3>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Balance:</span>
                    <span className="font-bold">{balance} SCRYPTO</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Address:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{shortenAddress(address)}</span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onClick={copyAddress}
                        disabled={!address}
                      >
                        <Copy size={12} />
                      </Button>
                    </div>
                  </div>
                  {address && (
                    <div className="border-t pt-2 mt-2">
                      <Button
                        size="sm"
                        variant="flat"
                        className="w-full"
                        onClick={() =>
                          window.open(
                            `https://sepolia.etherscan.io/address/${address}`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLinkIcon size={14} />
                        View on Testnet Explorer
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </PopoverContent>
    </Popover>
  );
};

export default Wallet;