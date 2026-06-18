import Loader from "@/components/Loader";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ViewCaptureProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  email: string;
}

interface ImageData {
  url: string;
  timestamp: string;
}

const ViewCaptures = ({ isOpen, onOpenChange, email }: ViewCaptureProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [urls, setUrls] = useState<ImageData[]>([]);
  const [currentImage, setCurrentImage] = useState(0);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const assessmentId = window.location.pathname.split("/")[5];

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    axios
      .get(`/assessments/m/${assessmentId}/captures/${email}`)
      .then((res) => {
        console.log(res.data.data);
        setUrls(res.data.data);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch captures");
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Camera Captures
            </ModalHeader>
            <ModalBody className="items-center">
              {loading ? (
                <Loader />
              ) : (
                <>
                  <p className="text-red-500">
                    Captures will be deleted after 60 days.
                  </p>
                  <Image
                    src={urls[currentImage].url}
                    alt="capture"
                    width="100%"
                    height="auto"
                    loading="lazy"
                    className="rounded-lg"
                  />
                  <p>
                    {new Date(
                      Number(urls[currentImage].timestamp)
                    ).toLocaleString()}
                  </p>
                  <Pagination
                    page={currentImage}
                    total={urls.length - 1}
                    onChange={(page) => setCurrentImage(page)}
                    showControls
                  />
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ViewCaptures;
