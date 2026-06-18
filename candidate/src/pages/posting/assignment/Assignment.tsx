import React, { useState, useEffect } from "react";
import { useAuth, useUser } from "@/auth";
import { toast } from "sonner";
import ax from "@/config/axios";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Upload,
  FileArchive,
  Link,
  FileText,
  AlertCircle,
} from "lucide-react";

// Updated interface according to new schema
interface Assignment {
  _id?: string;
  name: string;
  workflowId: string;
  description: string;
  submissionType: "file" | "text" | "link";
  submissions?: string[];
}

const Assignment = () => {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [textSubmission, setTextSubmission] = useState<string>("");
  const [linkSubmission, setLinkSubmission] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useUser();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const postingId = window.location.pathname.split("/")[2];
        const assignmentId = window.location.pathname.split("/")[4];
        setLoading(true);
        await axios
          .get(`/postings/${postingId}/assignment/${assignmentId}`)
          .then((res) => {
            setAssignment(res.data.data);
          });
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
  }, []);

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
    if (!assignment) return;

    try {
      setLoading(true);
      const postingId = window.location.pathname.split("/")[2];

      if (assignment.submissionType === "file" && !file) {
        toast.error("Please upload a file");
        setLoading(false);
        return;
      }

      if (assignment.submissionType === "text" && !textSubmission.trim()) {
        toast.error("Please enter your submission text");
        setLoading(false);
        return;
      }

      if (assignment.submissionType === "link" && !linkSubmission.trim()) {
        toast.error("Please enter a valid URL");
        setLoading(false);
        return;
      }

      const url = `postings/${postingId}/assignment/${assignment._id}`;

      // Handle different submission types
      if (assignment.submissionType === "file") {
        const formData = new FormData();
        formData.append("file", file as File);

        await axios.post(url, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        // For text or link submissions
        await axios.post(url, {
          postingId,
          userId: user?.id,
          assignmentId: assignment?._id,
          textSubmission: textSubmission.trim(),
          linkSubmission: linkSubmission.trim(),
        });
      }

      toast.success("Assignment submitted successfully");

      // Reset submission data
      setFile(null);
      setTextSubmission("");
      setLinkSubmission("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit assignment");
      toast.error("Error submitting assignment");
    } finally {
      setLoading(false);
    }
  };

  const renderSubmissionInput = () => {
    if (!assignment) return null;

    switch (assignment.submissionType) {
      case "file":
        return (
          <>
            <div className="flex items-center space-x-4">
              <Input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="flex-grow"
              />
            </div>
            {file && (
              <div className="flex items-center text-sm mt-2">
                <FileArchive className="mr-2 h-4 w-4" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </>
        );
      case "text":
        return (
          <div className="space-y-2">
            <Textarea
              placeholder="Enter your submission text here..."
              value={textSubmission}
              onChange={(e) => setTextSubmission(e.target.value)}
              className="min-h-32"
            />
            {textSubmission && (
              <div className="flex items-center text-sm">
                <FileText className="mr-2 h-4 w-4" />
                {textSubmission.length} characters
              </div>
            )}
          </div>
        );
      case "link":
        return (
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="https://example.com/your-work"
              value={linkSubmission}
              onChange={(e) => setLinkSubmission(e.target.value)}
            />
            {linkSubmission && (
              <div className="flex items-center text-sm">
                <Link className="mr-2 h-4 w-4" />
                {linkSubmission}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (loading && !assignment) {
    return (
      <div className="flex items-center justify-center h-80">
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
          <CardTitle className="text-xl">
            {assignment?.name || "Assignment"}
          </CardTitle>
          <CardDescription>Complete and submit your assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <p>{assignment?.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Submit Your Work</CardTitle>
          <CardDescription>
            {assignment?.submissionType === "file" &&
              "Upload your assignment as a .zip file (max 10MB)"}
            {assignment?.submissionType === "text" &&
              "Submit your work as text"}
            {assignment?.submissionType === "link" &&
              "Submit a link to your work"}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderSubmissionInput()}</CardContent>
        <CardFooter>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              (assignment?.submissionType === "file" && !file) ||
              (assignment?.submissionType === "text" &&
                !textSubmission.trim()) ||
              (assignment?.submissionType === "link" && !linkSubmission.trim())
            }
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Submit
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Assignment;
