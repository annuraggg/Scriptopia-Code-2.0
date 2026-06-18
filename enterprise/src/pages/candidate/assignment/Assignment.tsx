import React, { useState, useEffect } from "react";
import { useAuth, useUser } from "@/auth";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import ax from "@/config/axios";
import { Assignment as AssignmentType, Posting } from "@shared-types/Posting";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, FileArchive, AlertCircle } from "lucide-react";

const Assignment = () => {
  const { posting } = useOutletContext() as { posting: Posting };
  const [assignment, setAssignment] = useState<AssignmentType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useUser();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        setLoading(true);
        await axios.post("/candidates/verify", {
          postingId: posting?._id,
          userId: user?.id,
        });

        const currentStep = posting?.workflow?.steps?.findIndex(
          (step) => step.status === "in-progress"
        );
        const currentStepObj = posting?.workflow?.steps?.[currentStep || 0];
        const stepName = currentStepObj?.name;

        const assignmentData = posting?.assignments?.find(
          (a) => a.name === stepName
        );
        setAssignment(assignmentData || null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to fetch assignment details"
        );
        toast.error("Error fetching assignment details");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posting]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (
      !["application/zip", "application/x-zip-compressed"].includes(
        selectedFile.type
      )
    ) {
      toast.error("Please upload a .zip file");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size should be less than 10MB");
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!file || !assignment) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("postingId", posting?._id?.toString() || "");
      formData.append("userId", user?.id || "");
      formData.append("assignmentId", assignment?._id?.toString() || "");
      formData.append("file", file);

      await axios.post(
        `${import.meta.env.VITE_API_URL}/candidates/assignment/submit`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      toast.success("Assignment submitted successfully");
      setFile(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit assignment");
      toast.error("Error submitting assignment");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !assignment) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-white text-xl">
            {assignment?.name || "Assignment"}
          </CardTitle>
          <CardDescription>Complete and submit your assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            {assignment?.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-white text-xl">Submit Your Work</CardTitle>
          <CardDescription>
            Upload your assignment as a .zip file (max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="flex-grow"
            />
            <Button onClick={handleSubmit} disabled={!file || loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Submit
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          {file && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <FileArchive className="mr-2 h-4 w-4" />
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default Assignment;
