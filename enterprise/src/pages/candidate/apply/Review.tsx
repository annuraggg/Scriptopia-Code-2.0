import { useState } from "react";
import { EditIcon, Paperclip } from "lucide-react";

import { Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

import { toast } from "sonner";
import { useOutletContext } from "react-router-dom";
import { Posting } from "@shared-types/Posting";
import { useAuth, useUser } from "@/auth";
import ax from "@/config/axios";

interface ReviewProps {
  onEdit: (section: string) => void;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  website: string;
  resume: File | null;
  query: string;
  exists: boolean;
  candId: string;
}

const Review = ({
  onEdit,
  firstName,
  lastName,
  phone,
  email,
  website,
  resume,
  query,
  exists,
  candId,
}: ReviewProps) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const { posting } = useOutletContext() as { posting: Posting };

  const { getToken } = useAuth();
  const { user } = useUser();
  const axios = ax(getToken);
  const handleSubmit = () => {
    setLoading(true);
    const formData = new FormData();
    const postingId = posting?._id?.toString() || "";

    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("phone", phone);
    formData.append("email", email);
    formData.append("website", website);
    formData.append("exists", exists.toString());
    formData.append("candId", candId);
    formData.append("postingId", postingId);
    formData.append("userId", user?.id.toString() || "");

    if (resume) {
      formData.append("resume", resume);
    }
    formData.append("query", query);

    axios
      .post(`${import.meta.env.VITE_API_URL}/candidates/apply`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .then(() => {
        setIsModalVisible(true);
      })
      .catch((err) => {
        toast.error(err.response?.data.message || "An error occurred");
        console.log(err.response.data);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  return (
    <div className="flex flex-col items-start justify-start w-full gap-6 pb-10">
      <div className="flex flex-col items-start justify-start gap-6 w-full h-[40%] flex-reverse">
        <div className="flex flex-row flex-wrap items-center justify-between w-full">
          <p className="text-2xl">Contact Information</p>
          <div
            className="flex flex-row gap-1 items-center  text-green-500 cursor-pointer"
            onClick={() => onEdit("contact")}
          >
            <EditIcon size={14} />
            <p className="text-sm mt-1">Edit</p>
          </div>
        </div>
        <div className="flex flex-col-2 w-[50%] gap-5 text-base">
          <div className="space-y-3 text-default-500">
            <p>Name:</p>
            <p>Phone No:</p>
            <p>Email Address:</p>
            <p>Website:</p>
          </div>
          <div className="space-y-3">
            <p>
              {firstName} {lastName}
            </p>
            <p>{phone}</p>
            <p>{email}</p>
            <p>{website}</p>
          </div>
        </div>
      </div>
      <div className="w-full h-[0.5px] bg-slate-500 justify-start rounded-full"></div>
      <div className="flex flex-col items-start justify-start my-1 w-full h-[40%] flex-reverse">
        <div className="flex flex-row flex-wrap items-center justify-between w-full">
          <p className="text-2xl">Resume</p>
          <div
            className="flex flex-row gap-1 items-center justify-start text-green-500 cursor-pointer"
            onClick={() => onEdit("resume")}
          >
            <EditIcon size={14} />
            <p className="text-sm mt-1">Edit</p>
          </div>
        </div>
        <div className="flex flex-col-2 w-[50%] h-full gap-5 text-base">
          <div className="mt-5 flex items-center gap-3">
            <Paperclip size={20} />
            <p>{resume ? resume?.name : exists ? "Resume.pdf" : ""}</p>
          </div>
        </div>
      </div>
      <div className="w-full h-[0.5px] bg-slate-500 justify-start rounded-full"></div>
      <div className="flex flex-col items-start justify-start gap-6 w-full h-full flex-reverse">
        <div className="flex flex-row flex-wrap items-center justify-between w-full">
          <p className="text-2xl">Additional Questions</p>
          <div
            className="flex flex-row gap-1 items-center justify-start text-green-500 cursor-pointer"
            onClick={() => onEdit("additional")}
          >
            <EditIcon size={14} />
            <p className="text-sm mt-1">Edit</p>
          </div>
        </div>

        <div className="flex flex-col items-start justify-start w-full h-full gap-2">
          <p className="text-base text-default-500">
            Do You Have Any Questions ?
          </p>
          <Textarea
            isDisabled
            value={query}
            placeholder="Nothing Here"
            className=" rounded-none text-base"
          />
        </div>
      </div>
      <div className="w-full h-[0.5px] bg-default-400 justify-start rounded-full"></div>
      <div className="flex flex-col items-start justify-start gap-6 w-full h-[40%]">
        <div className="flex flex-row items-center justify-between w-full gap-2">
          <div className="flex gap-3 w-[70%]">
            <Checkbox
              radius="sm"
              isSelected={isSelected}
              onValueChange={setIsSelected}
            ></Checkbox>
            <p className="text-sm mt-2 w-[80%]">
              I confirm that the details I am submitting are accurate and valid.
              I understand that providing incorrect information may result in
              disqualification and further action.
            </p>
          </div>

          <Button
            onPress={handleSubmit}
            className="bg-sky-500 text-sky-900"
            isDisabled={!isSelected || loading}
          >
            Submit
          </Button>
        </div>
      </div>
      <Modal isOpen={isModalVisible} onClose={closeModal}>
        <ModalContent>
          <ModalHeader>Success</ModalHeader>
          <ModalBody>
            <p>Your application has been submitted successfully.</p>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={() => {
                window.location.href = window.location.pathname
                  .split("/")
                  .slice(0, 3)
                  .join("/");
              }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Review;
