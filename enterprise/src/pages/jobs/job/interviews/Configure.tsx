import { useAuth } from "@/auth";
import { Divider } from "@heroui/divider";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { TimeInput, TimeInputValue } from "@heroui/date-input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ax from "@/config/axios";
import { Member, Role } from "@shared-types/Organization";
import { useOutletContext } from "react-router-dom";
import { Posting } from "@shared-types/Posting";
import { Input } from "@heroui/input";

const Configure = () => {
  const [availableAssignees, setAvailableAssignees] = useState<Member[]>([]);

  const [assignees, setAssignees] = useState<Set<string>>(new Set([]));
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set([]));
  const [timeSlotStart, setTimeSlotStart] = useState<TimeInputValue>();
  const [timeSlotEnd, setTimeSlotEnd] = useState<TimeInputValue>();
  const [duration, setDuration] = useState<number>(0);

  const [loading, setLoading] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    axios
      .get("/organizations/settings")
      .then((res) => {
        const members = res.data.data.members;

        for (const member of members) {
          const associatedRole = res.data.data.roles.find(
            (role: Role) => role._id === member.role
          );

          if (associatedRole?.permissions.includes("interviewer")) {
            setAvailableAssignees((prev) => [...prev, member]);
          }
        }
      })
      .catch(() => {
        toast.error("Failed to fetch assignees");
      });
  }, []);

  const days = ["M", "T", "W", "Th", "F", "Sa", "Su"];

  const handleCheckboxChange = (
    set: Set<string>,
    setFunction: (set: Set<string>) => void,
    item: string | undefined
  ) => {
    if (!item) return;
    const newSet = new Set(set);
    if (newSet.has(item)) {
      newSet.delete(item);
    } else {
      newSet.add(item);
    }
    setFunction(newSet);
  };

  const { posting } = useOutletContext() as { posting: Posting };
  const save = async () => {
    setLoading(true);
    const step = posting?.workflow?.steps?.findIndex(
      (step) => step.type === "INTERVIEW"
    );
    if (step === undefined) {
      return toast.error("Failed to save interview configuration");
    }

    axios
      .post("postings/interview", {
        postingId: posting._id,
        step: step,
        interview: {
          assignees: Array.from(assignees),
          duration: duration,
          slots: [],
          days: Array.from(selectedDays),
          timeSlotStart: timeSlotStart?.toString(),
          timeSlotEnd: timeSlotEnd?.toString(),
        },
      })
      .then(() => {
        toast.success("Interview configuration saved successfully");
      })
      .catch(() => {
        toast.error("Failed to save interview configuration");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="flex items-center justify-center flex-col min-h-screen p-6">
      <div className="w-full max-w-4xl">
        <div className="p-8">
          <p className="text-xl">
            Interview is enabled but not configured for this posting
          </p>
          <p className="opacity-50 mt-2">
            Please configure Interview for this posting
          </p>

          <div className="flex gap-10 max-h-[60vh] overflow-y-auto mt-5">
            <div className="w-full min-w-[30%] flex flex-col">
              <p className="mb-4">Assignees</p>
              <div className="flex flex-col gap-3">
                {availableAssignees.map((assignee) => (
                  <Checkbox
                    key={assignee._id}
                    isSelected={assignees.has(assignee?._id || "")}
                    onChange={() =>
                      handleCheckboxChange(
                        assignees,
                        setAssignees,
                        assignee?._id
                      )
                    }
                    size="sm"
                  >
                    {/* @ts-expect-error  - Converting string to User */}
                    {assignee?.user?.firstName + " " + assignee?.user?.lastName}
                  </Checkbox>
                ))}
              </div>
            </div>

            <Divider orientation="vertical" />

            <div className="w-full min-w-[60%]">
              <div className="mb-8">
                <p className="mb-4">Available Days</p>
                <div className="flex flex-wrap gap-4">
                  {days.map((day) => (
                    <Checkbox
                      key={day}
                      isSelected={selectedDays.has(day)}
                      onChange={() =>
                        handleCheckboxChange(selectedDays, setSelectedDays, day)
                      }
                      size="sm"
                    >
                      {day}
                    </Checkbox>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-4">Time Slots</p>
                <div className="flex gap-3">
                  <TimeInput
                    label="Start"
                    value={timeSlotStart}
                    onChange={(value) => value && setTimeSlotStart(value)}
                  />
                  <TimeInput
                    label="End"
                    value={timeSlotEnd}
                    onChange={(value) => value && setTimeSlotEnd(value)}
                  />
                </div>
              </div>

              <Input
                label="Duration per candidate (in minutes)"
                type="number"
                className="mt-5"
                value={duration.toString()}
                onChange={(e) => setDuration(+e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={save}
        isLoading={loading}
        className="mt-8"
        color="success"
        variant="flat"
      >
        Save Configuration
      </Button>
    </div>
  );
};

export default Configure;
