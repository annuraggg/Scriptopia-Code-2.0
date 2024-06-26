import Response from "@/@types/Response";
import { Button, Select, SelectItem, Tooltip } from "@nextui-org/react";
import { ArrowUpFromLine, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import languages from "@/data/languages";

const Actions = ({
  setExplainOpen,
  runCode,
  submitCode,
  loading,
}: {
  setExplainOpen: (open: boolean) => void;
  runCode: () => Promise<Response<object>>;
  submitCode: () => Promise<Response<object>>;
  loading: boolean;
}) => {
  const [runLoading, setRunLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  const triggerRun = async () => {
    setRunLoading(true);
    runCode().finally(() => setRunLoading(false));
  };

  const triggerSubmit = async () => {
    setSubmitLoading(true);
    submitCode().finally(() => setSubmitLoading(false));
  };

  return (
    <>
      <Select
        placeholder="Select Language"
        size="sm"
        className="w-[180px]"
        aria-label="Select Language"
      >
        {languages.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {lang}
          </SelectItem>
        ))}
      </Select>

      <Tooltip content="Explain Code">
        <Button
          variant="flat"
          className="p-0 max-w-2 m-0 bg-yellow-900"
          size="sm"
          isIconOnly
          onClick={() => setExplainOpen(true)}
          disabled={loading}
          aria-label="Explain Code"
        >
          <Sparkles size={14} />
        </Button>
      </Tooltip>

      <Tooltip content="Run Code">
        <Button
          variant="flat"
          className="p-0 max-w-2 m-0 bg-green-900"
          size="sm"
          isIconOnly
          onClick={triggerRun}
          disabled={loading}
          isLoading={runLoading}
          aria-label="Run Code"
        >
          <Play size={14} />
        </Button>
      </Tooltip>

      <Tooltip content="Submit Code">
        <Button
          variant="flat"
          className="p-0 max-w-2 m-0 bg-blue-900"
          size="sm"
          isIconOnly
          onClick={triggerSubmit}
          disabled={loading}
          isLoading={submitLoading}
          aria-label="Submit Code"
        >
          <ArrowUpFromLine size={14} />
        </Button>
      </Tooltip>
    </>
  );
};

export default Actions;
