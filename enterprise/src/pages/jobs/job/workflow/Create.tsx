import { useRef, useState } from "react";
import {
  FileText,
  Code,
  // MonitorPlay,
  Edit2,
  Trash,
  Combine,
  Book,
  Copy,
} from "lucide-react";
import { Card, CardBody } from "@heroui/card";
import type { DateValue } from "@internationalized/date";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Divider } from "@heroui/divider";
import { Tooltip } from "@heroui/tooltip";
import { Switch } from "@heroui/switch";
import { DatePicker } from "@heroui/date-picker";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { motion, Reorder } from "framer-motion"; // Added framer-motion for animation
import { TimeInput, TimeInputValue } from "@heroui/date-input";

const Create = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const [page, setPage] = useState(0);
  const [auto, setAuto] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [addedComponents, setAddedComponents] = useState<
    { icon: React.ElementType; label: string; name: string; id: string }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false); // State for handling dragging status
  const [autoSchedule, setAutoSchedule] = useState<
    {
      start: DateValue | null;
      end: DateValue | null;
      startTime: TimeInputValue | null;
      endTime: TimeInputValue | null;
    }[]
  >([]);

  const components = [
    { icon: FileText, label: "ATS" },
    { icon: Copy, label: "MCQ Assessment" },
    { icon: Code, label: "Code Assessment" },
    { icon: Combine, label: "MCQ + Code Assessment" },
    { icon: Book, label: "Assignment" },
    // { icon: MonitorPlay, label: "Interview" },
  ];

  const dragStart = (e: React.DragEvent<HTMLDivElement>, label: string) => {
    e.dataTransfer.setData("text", label);
    setIsDragging(true); // Set dragging state to true
  };

  const dragEnd = () => {
    setIsDragging(false); // Reset dragging state after drop
  };

  const drop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false); // Reset dragging state on drop
    const label = e.dataTransfer.getData("text");
    const component = components.find((c) => c.label === label);

    if (component) {
      const newComponent = {
        ...component,
        name: `${component.label} ${
          addedComponents.filter((c) => c.label === component.label).length
        }`,
        id: Math.random().toString(36).substring(7),
      };

      setAddedComponents([...addedComponents, newComponent]);
      setAutoSchedule([
        ...autoSchedule,
        { start: null, end: null, startTime: null, endTime: null },
      ]);
    }
  };

  const editName = (id: string, newName: string) => {
    setAddedComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName } : c))
    );
  };

  const deleteComponent = (id: string) => {
    setAddedComponents(addedComponents.filter((c) => c.id !== id));
    setAutoSchedule(
      autoSchedule.filter(
        (_, index) => index !== addedComponents.findIndex((c) => c.id === id)
      )
    );
  };

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const componentMap = {
    ATS: "rs",
    "MCQ Assessment": "mcqa",
    "Code Assessment": "ca",
    "MCQ + Code Assessment": "mcqca",
    Assignment: "as",
    Interview: "pi",
  };

  const handleSave = () => {
    let formattedAutoSchedule = null;
    if (auto && autoSchedule) {
      formattedAutoSchedule = autoSchedule.map((schedule) => {
        const startDate = new Date(
          schedule.start!.year,
          schedule.start!.month - 1, // Months are zero-indexed in JS Date
          schedule.start!.day,
          schedule.startTime?.hour || 0,
          schedule.startTime?.minute || 0
        );

        const endDate = new Date(
          schedule.end!.year,
          schedule.end!.month - 1,
          schedule.end!.day,
          schedule.endTime?.hour || 0,
          schedule.endTime?.minute || 0
        );

        return {
          step: 0,
          start: startDate.getTime(), // Convert to timestamp
          end: endDate.getTime(), // Convert to timestamp
        };
      });
    }

    const formattedData = {
      steps: addedComponents.map((component) => ({
        name: component.label, // @ts-expect-error - TS doesn't know the keys of componentMap
        type: componentMap[component.label] as string,
      })),
      currentStep: -1,
      behavior: auto ? "auto" : "manual",
      auto: formattedAutoSchedule,
    };

    axios
      .post("/postings/workflow/create", {
        formattedData,
        _id: window.location.pathname.split("/")[2],
      })
      .then(() => {
        toast.success("Workflow saved successfully");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      })
      .catch((err) => {
        toast.error("Failed to save workflow");
        console.error(err);
      });
  };

  const handleEditClick = (id: string) => {
    setEditingId(editingId === id ? null : id);
    // Auto-focus the input field if it's being edited
    if (editingId !== id) {
      setTimeout(() => {
        inputRefs.current[id]?.focus(); // Use a timeout to ensure it focuses after the state change
      }, 0);
    }
  };

  const handleBlur = (id: string, value: string) => {
    if (editingId === id) {
      editName(id, value); // Save changes on blur
      setEditingId(null); // Reset editing state
    }
  };

  return (
    <div className="p-10 w-full h-[92vh]">
      {page === 0 && (
        <div className="gap-10 flex justify-between">
          <div className="w-full flex flex-col gap-5">
            <Reorder.Group
              axis="y"
              values={addedComponents}
              onReorder={setAddedComponents}
              className="flex flex-col gap-5"
            >
              {addedComponents.map((component) => (
                <Reorder.Item
                  key={component.id}
                  value={component}
                  whileDrag={{ scale: 1.1 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    layout
                    className="border p-5 gap-5 rounded-xl min-h-20 flex justify-start items-center relative"
                  >
                    <component.icon />
                    <div>
                      <input
                        ref={(el) => (inputRefs.current[component.id] = el)} // Assign ref to input
                        className={`border-none outline-none bg-transparent max-w-fit transition-all ${
                          editingId === component.id
                            ? "opacity-100 text-xl"
                            : "opacity-50 text-base" // Increase text size when editing
                        }`}
                        value={component.name}
                        onChange={(e) => editName(component.id, e.target.value)}
                        onBlur={() => handleBlur(component.id, component.name)} // Call onBlur handler
                        onFocus={() => setEditingId(component.id)} // Set editingId on focus
                      />
                      <p className="text-sm opacity-50 mt-2">
                        {component.label}
                      </p>
                    </div>
                    <Tooltip content="Delete Component">
                      <Trash
                        className="cursor-pointer absolute right-5 text-red-500"
                        size={20}
                        onClick={() => deleteComponent(component.id)}
                      />
                    </Tooltip>
                    <span>
                      <Tooltip content="Edit Name" placement="top">
                        <Edit2
                          className="cursor-pointer absolute right-16 -mt-[8px]"
                          size={20}
                          onClick={() => handleEditClick(component.id)} // Call new edit handler
                          style={{
                            transition: "transform 0.2s",
                            transform:
                              editingId === component.id
                                ? "scale(1.1)"
                                : "scale(1)",
                          }}
                        />
                      </Tooltip>
                    </span>
                  </motion.div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
            <motion.div
              className={`border-4 p-5 rounded-xl min-h-20 w-full flex justify-center items-center ${
                isDragging ? "border-blue-500" : "border-dashed opacity-50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={drop}
              whileHover={{ scale: isDragging ? 1.1 : 1.05 }}
            >
              {isDragging ? "Drop here!" : "+ Add Component"}
            </motion.div>
          </div>
          <Divider orientation="vertical" className="opacity-50" />
          <div className="h-full w-[30%] flex flex-col gap-5 relative">
            {components.map((component, index) => (
              <motion.div
                key={index}
                draggable // @ts-expect-error - TS doesn't know the keys of componentMap
                onDragStart={(e) => dragStart(e, component.label)}
                onDragEnd={dragEnd}
                className="p-5 border rounded-xl cursor-pointer hover:bg-gray-800 transition-colors flex items-center gap-5"
                whileHover={{ scale: 1.05 }}
                whileDrag={{ scale: 1.1, opacity: 0.8 }}
              >
                <component.icon />
                {component.label}
              </motion.div>
            ))}
            <Button
              className="w-full mt-5"
              color="success"
              variant="flat"
              onClick={() => setShowSaveModal(true)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {page === 1 && (
        <div className="flex flex-col h-full">
          <div className="mb-5">
            <p className="opacity-50 text-sm mb-5">
              Select the workflow schedule...
            </p>
            <div className="flex items-center gap-5 justify-center">
              <p>Manual</p>
              <Switch
                checked={auto}
                onChange={() => setAuto(!auto)}
                color="success"
              />
              <p>Automatic</p>
            </div>
          </div>

          {auto && (
            <div className="flex-grow overflow-y-auto">
              <div className="flex flex-wrap gap-5 pb-16">
                {addedComponents.map((component, index) => (
                  <Card className="w-[31%]" key={index}>
                    <CardBody>
                      <div className="flex gap-2 items-center">
                        <p>{component.name}</p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <DatePicker
                          className="max-w-[284px]"
                          label="End Date"
                          value={autoSchedule[index]?.end}
                        />
                        <TimeInput
                          label="End Time"
                          value={autoSchedule[index]?.endTime}
                        />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-5">
            <Button onClick={() => setPage(0)} variant="flat">
              Back
            </Button>
            <Button onClick={() => setShowSaveModal(true)} color="success">
              Save Workflow
            </Button>
          </div>
        </div>
      )}

      <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>Save Workflow</h2>
          </ModalHeader>
          <ModalBody>
            <p>Are you sure you want to save this workflow?</p>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowSaveModal(false)} color="danger">
              Cancel
            </Button>
            <Button onClick={handleSave} color="success">
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Create;
