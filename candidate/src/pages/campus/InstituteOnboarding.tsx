import Loader from "@/components/Loader";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const InstituteOnboarding = () => {
  const [loading, setLoading] = useState(true);
  const [instituteCode, setInstituteCode] = useState("");
  const [identityCode, setIdentityCode] = useState("");
  const [isCodeAvailable, setIsCodeAvailable] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [requestedName, setRequestedName] = useState("");

  const { getToken } = useAuth();
  const axios = ax(getToken);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      setInstituteCode(code);
      setIsCodeAvailable(true);
    }

    axios
      .get(`/institutes/request`)
      .then((response) => {
        console.log(response.data.data);
        if (response.data.data.exist) {
          setHasRequested(true);
          setRequestedName(response.data.data.name);
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message || "Error sending request");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const submitForm = async () => {
    if (!instituteCode || !identityCode) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    axios
      .post("/institutes/request", {
        code: instituteCode,
        uid: identityCode,
      })
      .then((res) => {
        toast.success("Request sent successfully");
        setHasRequested(true);
        setRequestedName(res.data.data.name);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response.data.message || "Error sending request");
      })
      .finally(() => setLoading(false));
  };

  const cancelRequest = () => {
    setLoading(true);
    axios
      .delete("/institutes/request")
      .then(() => {
        toast.success("Request cancelled successfully");
        setHasRequested(false);
        setRequestedName("");
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response.data.message || "Error sending request");
      })
      .finally(() => {
        setLoading(false);
        onOpenChange();
      });
  };

  if (loading) return <Loader />;

  if (hasRequested) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br">
          <div className="w-full max-w-md bg-white rounded-2xl p-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Request Submitted
            </h1>
            <p className="text-gray-600 mb-6">
              Your request to connect with {requestedName} has been submitted.
            </p>
            <Button
              onClick={onOpen}
              className="w-full mt-4"
              color="danger"
              size="lg"
            >
              Cancel Request
            </Button>
          </div>
        </div>

        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Cancel Connection Request
                </ModalHeader>
                <ModalBody>
                  <p>
                    Are you sure you want to cancel your request to connect with{" "}
                    {requestedName}?
                  </p>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone.
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button color="default" variant="light" onPress={onClose}>
                    No, Keep Request
                  </Button>
                  <Button color="danger" onPress={cancelRequest}>
                    Yes, Cancel Request
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Scriptopia Campus Platform
          </h1>
          <p className="text-gray-600 mb-6">
            Connect with your campus to discover personalized job opportunities
            tailored specifically for your institute, by your institute.
          </p>
        </div>

        <div className="space-y-4">
          <Input
            label="Institute Code"
            placeholder="Enter your institute code"
            className="w-full"
            value={instituteCode}
            onChange={(e) => setInstituteCode(e.target.value)}
            isDisabled={isCodeAvailable}
          />
          <Input
            label="Identity Code"
            placeholder="Eg. Roll No., ID No., Moodle ID., etc."
            className="w-full"
            value={identityCode}
            onChange={(e) => setIdentityCode(e.target.value)}
          />

          <Button
            className="w-full mt-4"
            color="primary"
            size="lg"
            onClick={submitForm}
          >
            Connect to Campus
          </Button>
        </div>

        <div className="text-center text-xs text-gray-500 mt-6">
          <p>
            By clicking "Connect", you agree to our{" "}
            <a
              href="/terms"
              className="text-blue-600 hover:text-blue-800 transition-colors underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-blue-600 hover:text-blue-800 transition-colors underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstituteOnboarding;
