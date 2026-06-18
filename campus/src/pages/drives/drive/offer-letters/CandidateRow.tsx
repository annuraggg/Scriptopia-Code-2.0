import { ExtendedCandidate } from "@shared-types/ExtendedCandidate";
import { ExtendedAppliedDrive } from "@shared-types/ExtendedAppliedDrive";
import { useAuth } from "@/auth";
import { useState, useMemo } from "react";
import { TableRow, TableCell, Chip, Button, Tooltip } from "@nextui-org/react";
import { Download, Mail } from "lucide-react";
import { toast } from "sonner";
import ax from "@/config/axios";
import { User as NextUIUser } from "@nextui-org/react";

interface CandidateRowProps {
  candidate: ExtendedCandidate;
  hasOfferLetter: boolean;
  appliedDrives?: ExtendedAppliedDrive[];
  driveId: string;
  onViewCandidate: (candidate: ExtendedCandidate) => void;
}

const CandidateRow: React.FC<CandidateRowProps> = ({
  candidate,
  hasOfferLetter,
  appliedDrives = [],
  driveId,
  onViewCandidate,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const { getToken } = useAuth();
  const axios = ax(getToken);

  // Get latest education with memoization
  const latestEducation = useMemo(() => {
    if (!candidate.education || candidate.education.length === 0) return null;
    return candidate.education.sort(
      (a, b) => (b.endYear || 9999) - (a.endYear || 9999)
    )[0];
  }, [candidate.education]);

  // Get candidate salary with memoization
  const candidateSalary = useMemo(() => {
    const appliedDrive = appliedDrives?.find(
      (drive) => drive.user?._id?.toString() === candidate._id?.toString()
    );
    return appliedDrive?.salary || "Not Given";
  }, [appliedDrives, candidate._id]);

  const handleDownloadOfferLetter = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!candidate._id) {
      toast.error("Invalid candidate ID");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await axios.get(
        `/drives/${driveId}/offer-letter/${candidate._id}`
      );
      if (response?.data?.data?.url) {
        window.open(response.data.data.url, "_blank");
      } else {
        throw new Error("No download URL received");
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Error downloading offer letter"
      );
      console.error("Download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Safety check for candidate
  if (!candidate) {
    return null;
  }

  return (
    <TableRow
      key={candidate._id}
      className="cursor-pointer hover:bg-default-50"
      onClick={() => onViewCandidate(candidate)}
    >
      {/* Candidate Info */}
      <TableCell>
        <NextUIUser
          name={candidate.name || "No Name"}
          avatarProps={{
            src: candidate.profileImage,
            showFallback: true,
            name: candidate.name || "?",
            size: "sm",
          }}
          classNames={{
            name: "font-medium",
          }}
        />
      </TableCell>

      {/* Education */}
      <TableCell>
        {latestEducation ? (
          <div className="flex flex-col">
            <span className="font-semibold text-sm">
              {latestEducation.degree}
            </span>
            <span className="text-xs text-default-500">
              {latestEducation.school}
            </span>
          </div>
        ) : (
          "N/A"
        )}
      </TableCell>

      {/* Contact */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Mail className="h-3 w-3 text-default-500" />
          <span className="text-sm">{candidate.email || "No email"}</span>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        {hasOfferLetter ? (
          <Chip color="success" variant="flat" size="sm">
            Uploaded
          </Chip>
        ) : (
          <Chip color="warning" variant="flat" size="sm">
            Pending
          </Chip>
        )}
      </TableCell>

      <TableCell>
        {appliedDrives && appliedDrives.length > 0 ? (
          <div className="flex items-center gap-2">{candidateSalary}</div>
        ) : (
          <span>N/A</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex justify-end">
          {hasOfferLetter ? (
            <Button
              color="primary"
              variant="flat"
              startContent={<Download className="h-4 w-4" />}
              size="sm"
              onClick={handleDownloadOfferLetter}
              isLoading={isDownloading}
              isDisabled={isDownloading}
            >
              Download
            </Button>
          ) : (
            <Tooltip content="Offer letter not yet uploaded">
              <Button
                color="default"
                variant="flat"
                isDisabled
                size="sm"
                onClick={(e) => e.stopPropagation()}
              >
                Not Available
              </Button>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default CandidateRow;
