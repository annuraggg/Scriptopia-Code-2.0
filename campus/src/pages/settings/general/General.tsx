import { Image } from "@nextui-org/image";
import { Button, Input } from "@nextui-org/react";
import { useRef, useState } from "react";
import { Breadcrumbs, BreadcrumbItem } from "@nextui-org/breadcrumbs";
import { Upload } from "lucide-react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Slider,
  useDisclosure,
} from "@nextui-org/react";
import AvatarEditor from "react-avatar-editor";
import { useOutletContext } from "react-router-dom";
import { SettingsContext } from "@/types/SettingsContext";

const General = () => {
  const [newLogo, setNewLogo] = useState<File>({} as File);
  const [zoom, setZoom] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newLogoRef = useRef<AvatarEditor>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const { institute, setInstitute } =
    useOutletContext() as SettingsContext;

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const handleInputChange =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log(key, e.target.value);
      setInstitute({ ...institute, [key]: e.target.value });
    };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewLogo(file);
      onOpen();
    }
  };

  const updateLogo = () => {
    const canvas = newLogoRef.current?.getImage().toDataURL("image/png");
    axios
      .post("institutes/settings/logo", { logo: canvas })
      .then(() => {
        toast.success("Logo updated successfully");
        onOpenChange();
      })
      .catch((err) => {
        console.error(err);
        toast.error("Error updating logo. Please try again.");
      });
  };

  return (
    <>
      <div className="mt-5 ml-5">
        <Breadcrumbs>
          <BreadcrumbItem>{institute.name}</BreadcrumbItem>
          <BreadcrumbItem href={"/settings"}>Settings</BreadcrumbItem>
          <BreadcrumbItem href={"/settings/general"}>General</BreadcrumbItem>
        </Breadcrumbs>
      </div>
      <div className="p-5 px-10">
        <div className="w-fit">
          {institute?.logo ? (
            <Image src={institute.logo} width={200} height={200} />
          ) : (
            <p className="mt-5 text-center text-sm opacity-50">
              No Logo. Upload one to make your institute look better.
            </p>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: "none" }}
            ref={fileInputRef}
          />
          <Button
            className="mt-2 w-[200px]"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload /> Change Logo
          </Button>
        </div>

        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  New Logo
                </ModalHeader>
                <ModalBody className="justify-center items-center gap-5">
                  <AvatarEditor
                    ref={newLogoRef}
                    image={newLogo}
                    width={200}
                    height={200}
                    border={50}
                    scale={zoom}
                    rotate={0}
                  />

                  <div className="w-full flex items-center justify-center flex-col gap-2">
                    <p>Zoom</p>
                    <Slider
                      minValue={1}
                      maxValue={2}
                      step={0.01}
                      value={zoom}
                      onChange={(value) => setZoom(value as number)}
                    />
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Close
                  </Button>
                  <Button
                    color="success"
                    onPress={onClose}
                    onClick={updateLogo}
                  >
                    Update
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        <div className="flex gap-3 w-[50%] items-center mt-10">
          <p className="w-[40%]">Company Name</p>
          <Input
            value={institute?.name}
            onChange={handleInputChange("name")}
          />
        </div>

        <div className="flex gap-3 w-[50%] items-center mt-3">
          <p className="w-[40%]">Company Email</p>
          <Input
            value={institute?.email}
            onChange={handleInputChange("email")}
          />
        </div>

        <div className="flex gap-3 w-[50%] items-center mt-3">
          <p className="w-[40%]">Company Website</p>
          <Input
            value={institute?.website}
            onChange={handleInputChange("website")}
          />
        </div>
      </div>
    </>
  );
};

export default General;
