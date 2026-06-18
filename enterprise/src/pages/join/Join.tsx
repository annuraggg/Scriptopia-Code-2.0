import ax from "@/config/axios";
import { SignOutButton, useAuth, useUser } from "@/auth";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { CircularProgress } from "@heroui/progress";
import { HeartCrack, Link } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const bgStyle = {
  backgroundImage: "url(./join-bg.svg)",
  backgroundSize: "cover",
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

interface Token {
  inviter: string;
  organization: string;
  role: string;
  email: string;
  organizationname: string;
}

const Join = () => {
  const [loading, setLoading] = useState(true);
  const { isSignedIn, user, isLoaded } = useUser();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(false);

  const [token, setToken] = useState<Token>({} as Token);

  const { getToken } = useAuth();
  const axios = ax(getToken);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    axios
      .post("/organizations/verify", { token })
      .then((data) => {
        setToken(data.data.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = (status: "accept" | "decline") => {
    setSubmitLoading(true);
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    axios
      .post("/organizations/join", { status, token })
      .then(() => {
        toast.success("Joined Organization");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1000);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to join organization");
      })
      .finally(() => setSubmitLoading(false));
  };

  return (
    <div
      style={bgStyle}
      className={`${
        loading ? "opacity-50" : ""
      } transition-all flex flex-col gap-5`}
    >
      <div>
        {!isSignedIn || !isLoaded || loading ? (
          <CircularProgress />
        ) : error ? (
          <Card>
            <CardHeader className="justify-center ">
              You received an invite but...
            </CardHeader>
            <CardBody className="items-center px-10 w-[30vw]">
              <HeartCrack size={100} className="opacity-50 text-red-500" />
              <h3 className="mt-3">Invite Invalid</h3>
              <p className="mt-5 opacity-50 text-center">
                The Invite may have expired or you may not have permission to
                join this organization
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader className="justify-center">
              Organization Invite
            </CardHeader>
            <CardBody className="items-center px-10 w-[30vw]">
              <div className="flex gap-5 items-center">
                <Avatar src={user?.imageUrl} size="lg" />
                <Link />
                <Avatar size="lg" />
              </div>
              <p className="mt-5 opacity-50">
                {token.inviter
                  ? `${token.inviter} has invited you to join`
                  : "You have been invited to join"}
              </p>
              <h3 className="mt-3">
                {token?.organizationname
                  ? token.organizationname
                  : "Organization"}
              </h3>
            </CardBody>
            <CardFooter>
              <Button
                className="w-full mr-2"
                color="danger"
                variant="flat"
                onClick={() => handleJoin("decline")}
                isDisabled={submitLoading}
                isLoading={submitLoading}
              >
                Decline
              </Button>
              <Button
                className="w-full"
                color="success"
                variant="flat"
                onClick={() => handleJoin("accept")}
                isDisabled={submitLoading}
                isLoading={submitLoading}
              >
                Join
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <Card>
        <CardBody className="flex flex-col items-center justify-center p-5 w-full">
          <p>
            Signed In as{" "}
            <span className="underline">
              {user?.emailAddresses[0].emailAddress}
            </span>
          </p>

          <SignOutButton signOutOptions={{ redirectUrl: "/join" }}>
            <a className="underline cursor-pointer">
              Sign In to a different account
            </a>
          </SignOutButton>
        </CardBody>
      </Card>
    </div>
  );
};

export default Join;
