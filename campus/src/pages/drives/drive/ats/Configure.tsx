import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { useState } from "react";
import { toast } from "sonner";

const Configure = () => {
  const [threshold, setThreshold] = useState(0);
  const [negativePrompts, setNegativePrompts] = useState("");
  const [positivePrompts, setPositivePrompts] = useState("");

  const [loading, setLoading] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const save = async () => {
    setLoading(true);

    if (threshold < 0 || threshold > 100) {
      toast.error("Threshold should be between 0 and 100");
      setLoading(false);
      return;
    }

    const driveId = window.location.pathname.split("/")[2];
    try {
      await axios.post("/drives/ats", {
        minimumScore: threshold,
        negativePrompts: negativePrompts,
        positivePrompts: positivePrompts,
        _id: driveId,
      });

      toast.success("Saved successfully");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-[100vh] flex-col p-10">
      <p className="text-xl">
        ATS is enabled but not configured for this drive
      </p>
      <p className="opacity-50 mt-2">Please configure ATS for this drive</p>

      <div className="flex items-center w-[70%] mt-10">
        <div className="w-full">
          <p>Match Threshold (Min %)</p>
          <p className="text-sm opacity-50">
            Minimum percentage to match candidates
          </p>
        </div>
        <Input
          placeholder="In %"
          className="w-[50%]"
          value={threshold.toString()}
          onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="flex items-center w-[70%] mt-3">
        <div className="w-full">
          <p>Negative Prompts</p>
          <p className="text-sm opacity-50">
            Things you don't want to see in resumes
          </p>
        </div>

        <Textarea
          placeholder="No negative prompts"
          value={negativePrompts}
          onChange={(e) => setNegativePrompts(e.target.value)}
        />
      </div>

      <div className="flex items-center w-[70%] mt-3">
        <div className="w-full">
          <p>Positive Prompts</p>
          <p className="text-sm opacity-50">
            Things you want to see in resumes
          </p>
        </div>

        <Textarea
          placeholder="No positive prompts"
          value={positivePrompts}
          onChange={(e) => setPositivePrompts(e.target.value)}
        />
      </div>

      <Button
        className="mt-10"
        color="success"
        variant="flat"
        onClick={save}
        isLoading={loading}
      >
        Save
      </Button>
    </div>
  );
};

export default Configure;
