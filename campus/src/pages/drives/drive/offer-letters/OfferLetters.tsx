import { DriveContext } from "@/types/DriveContext";
import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Tabs,
  Tab,
  Spinner,
  Tooltip,
  User,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Divider,
} from "@nextui-org/react";
import {
  Download,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  User as UserIcon,
} from "lucide-react";
import { ExtendedCandidate } from "@shared-types/ExtendedCandidate";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { ExtendedAppliedDrive } from "@shared-types/ExtendedAppliedDrive";
import Loader from "@/components/Loader";

interface CandidateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: ExtendedCandidate | null;
  onViewFullProfile: (candidateId: string) => void;
}

const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onViewFullProfile,
}) => {
  if (!candidate) return null;

  const latestEducation =
    candidate.education && candidate.education.length > 0
      ? candidate.education.sort(
          (a, b) => (b.endYear || 9999) - (a.endYear || 9999)
        )[0]
      : null;

  const latestWorkExperience =
    candidate.workExperience && candidate.workExperience.length > 0
      ? candidate.workExperience.sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        )[0]
      : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Candidate Profile</h3>
              </div>
            </ModalHeader>
            <Divider />
            <ModalBody className="py-5">
              <div className="flex items-center gap-4 mb-6">
                <Avatar
                  src={candidate.profileImage}
                  showFallback
                  name={candidate.name || "User"}
                  className="h-16 w-16"
                />
                <div>
                  <h4 className="text-xl font-semibold">{candidate.name}</h4>
                  <p className="text-default-500">{candidate.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <div className="space-y-3">
                  <h5 className="text-sm font-semibold text-default-700 mb-2">
                    Contact Information
                  </h5>
                  <div className="bg-default-50 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-default-500" />
                      <span>{candidate.email || "Not provided"}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-default-500" />
                      <span>{candidate.phone || "Not provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-default-500" />
                      <span>
                        DOB:{" "}
                        {candidate.dob
                          ? new Date(candidate.dob).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Education */}
                {latestEducation && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-semibold text-default-700 mb-2">
                      Education
                    </h5>
                    <div className="bg-default-50 rounded-md p-3">
                      <div className="font-medium">
                        {latestEducation.degree} in{" "}
                        {latestEducation.branch || "N/A"}
                      </div>
                      <div className="text-sm text-default-600 mt-1">
                        {latestEducation.school}, {latestEducation.board}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Chip size="sm" color="primary" variant="flat">
                          {latestEducation.percentage}%
                        </Chip>
                        <span className="text-xs text-default-500">
                          {latestEducation.startYear} -{" "}
                          {latestEducation.current
                            ? "Present"
                            : latestEducation.endYear}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                {/* Work Experience */}
                {latestWorkExperience && (
                  <div className="mb-5">
                    <h5 className="text-sm font-semibold text-default-700 mb-2">
                      Work Experience
                    </h5>
                    <div className="bg-default-50 rounded-md p-3">
                      <div className="font-medium">
                        {latestWorkExperience.title}
                      </div>
                      <div className="text-sm text-default-600 mt-1">
                        {latestWorkExperience.company},{" "}
                        {latestWorkExperience.location}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Chip size="sm" variant="flat">
                          {latestWorkExperience.type}
                        </Chip>
                        <span className="text-xs text-default-500">
                          {new Date(
                            latestWorkExperience.startDate
                          ).toLocaleDateString()}{" "}
                          -{" "}
                          {latestWorkExperience.current
                            ? "Present"
                            : latestWorkExperience.endDate &&
                              new Date(
                                latestWorkExperience.endDate
                              ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Skills */}
                {candidate.technicalSkills &&
                  candidate.technicalSkills.length > 0 && (
                    <div className="mb-0">
                      <h5 className="text-sm font-semibold text-default-700 mb-2">
                        Technical Skills
                      </h5>
                      <div className="bg-default-50 rounded-md p-3">
                        <div className="flex flex-wrap gap-1">
                          {candidate.technicalSkills.map((skill) => (
                            <Chip
                              key={skill._id || skill.skill}
                              variant="flat"
                              size="sm"
                              color={
                                skill.proficiency > 3 ? "primary" : "default"
                              }
                            >
                              {skill.skill}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </ModalBody>
            <Divider />
            <ModalFooter>
              <div className="flex justify-between w-full">
                <Button
                  color="primary"
                  variant="flat"
                  startContent={<UserIcon className="h-4 w-4" />}
                  onPress={() => {
                    if (candidate._id) {
                      onViewFullProfile(candidate._id);
                    }
                  }}
                  isDisabled={!candidate._id}
                >
                  View Full Profile
                </Button>
                <Button color="default" variant="light" onPress={onClose}>
                  Close
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

const OfferLetters: React.FC = () => {
  const { drive } = useOutletContext<DriveContext>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedCandidate, setSelectedCandidate] =
    useState<ExtendedCandidate | null>(null);
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [appliedDrives, setAppliedDrives] = useState<ExtendedAppliedDrive[]>(
    []
  );
  const [loadingAppliedDrives, setLoadingAppliedDrives] =
    useState<boolean>(true);
  const [offerLetterDownloading, setOfferLetterDownloading] = useState<
    string | null
  >(null);

  // Safely access hired candidates and offer letters
  const hiredCandidates = drive?.hiredCandidates || [];
  const offerLetters = drive?.offerLetters || [];

  const candidatesWithOfferLetters = useMemo(() => {
    return hiredCandidates.filter((candidate) =>
      offerLetters.includes(candidate._id!)
    );
  }, [hiredCandidates, offerLetters]);

  const pendingOfferLetters = useMemo(() => {
    return hiredCandidates.filter(
      (candidate) => !offerLetters.includes(candidate._id!)
    );
  }, [hiredCandidates, offerLetters]);

  useEffect(() => {
    if (!drive || !drive._id) return;

    setLoadingAppliedDrives(true);
    axios
      .get(`/drives/${drive._id}/applied`)
      .then((res) => {
        setAppliedDrives(res.data.data.applications || []);
      })
      .catch((err) => {
        console.error("Error fetching applied drives:", err);
        toast.error(err.response?.data?.message || "Error Getting CTCs");
      })
      .finally(() => {
        setLoadingAppliedDrives(false);
      });
  }, [drive?._id]);

  const handleDownloadOfferLetter = (
    candidateId: string,
    event: React.MouseEvent
  ) => {
    if (event) event.stopPropagation();

    setOfferLetterDownloading(candidateId);
    axios
      .get(`/drives/${drive._id}/offer-letter/${candidateId}`)
      .then((res) => {
        if (res.data?.data?.url) {
          window.open(res.data.data.url, "_blank");
        } else {
          toast.error("No download URL received");
        }
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Error downloading offer letter"
        );
      })
      .finally(() => {
        setOfferLetterDownloading(null);
      });
  };

  const viewCandidateDetails = (candidate: ExtendedCandidate) => {
    setSelectedCandidate(candidate);
    onOpen();
  };

  const navigateToCandidateProfile = (candidateId: string) => {
    navigate(`/c/${candidateId}`);
  };

  // Helper function to get CTC for a candidate
  const getCandidateCTC = (candidateId: string) => {
    const appliedDrive = appliedDrives.find(
      (drive) => drive.user?._id?.toString() === candidateId
    );
    return appliedDrive?.salary || "Not Given";
  };

  // Current date generation
  const currentDate = new Date("2025-04-12 15:28:03");

  if (!drive) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner color="primary" label="Loading drive data..." />
      </div>
    );
  }

  // Render a candidate row with proper error handling
  const renderCandidateRow = (
    candidate: ExtendedCandidate,
    hasOfferLetter: boolean
  ) => {
    if (!candidate) return null;

    const latestEducation =
      candidate.education && candidate.education.length > 0
        ? candidate.education.sort(
            (a, b) => (b.endYear || 9999) - (a.endYear || 9999)
          )[0]
        : null;

    return (
      <TableRow
        key={candidate._id}
        className="cursor-pointer hover:bg-default-50"
        onClick={() => viewCandidateDetails(candidate)}
      >
        <TableCell>
          <User
            name={candidate.name || "No Name"}
            avatarProps={{
              src: candidate.profileImage,
              showFallback: true,
              name: candidate.name?.[0] || "?",
              size: "sm",
            }}
            classNames={{
              name: "font-medium",
            }}
          />
        </TableCell>
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
        <TableCell>
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-default-500" />
            <span className="text-sm">{candidate.email || "No email"}</span>
          </div>
        </TableCell>
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
          {candidate._id ? getCandidateCTC(candidate._id) : "N/A"}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end">
            {hasOfferLetter ? (
              <Button
                color="primary"
                variant="flat"
                startContent={<Download className="h-4 w-4" />}
                size="sm"
                onClick={(e) => {
                  if (candidate._id)
                    handleDownloadOfferLetter(candidate._id, e);
                }}
                isLoading={offerLetterDownloading === candidate._id}
                isDisabled={offerLetterDownloading !== null || !candidate._id}
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

  if (loadingAppliedDrives) return <Loader />;

  return (
    <div className="w-full p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Offer Letters</h2>
        <div className="text-sm text-default-500">
          Last updated: {currentDate.toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-md shadow-sm">
          <div className="text-sm font-semibold text-default-500 mb-1">
            TOTAL HIRED
          </div>
          <div className="text-2xl font-bold">{hiredCandidates.length}</div>
        </div>
        <div className="bg-white p-4 rounded-md shadow-sm">
          <div className="text-sm font-semibold text-default-500 mb-1">
            OFFER LETTERS RECEIVED
          </div>
          <div className="text-2xl font-bold">
            {candidatesWithOfferLetters.length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-md shadow-sm">
          <div className="text-sm font-semibold text-default-500 mb-1">
            PENDING
          </div>
          <div className="text-2xl font-bold">{pendingOfferLetters.length}</div>
        </div>
      </div>

      <Tabs aria-label="Offer Letters Tabs" className="mb-4">
        <Tab
          key="all"
          title={
            <div className="flex items-center gap-2">
              <span>All Hired Candidates</span>
              <Chip size="sm" variant="flat">
                {hiredCandidates.length}
              </Chip>
            </div>
          }
        >
          <div className="bg-white p-4 rounded-md shadow-sm">
            <Table
              aria-label="All hired candidates"
              removeWrapper
              classNames={{
                th: "bg-default-100 text-default-800 py-3",
                td: "py-3",
              }}
            >
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>EDUCATION</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>CTC</TableColumn>
                <TableColumn className="text-right">ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No hired candidates found">
                {hiredCandidates
                  .map((candidate) => {
                    const hasOfferLetter = offerLetters.includes(candidate._id!);
                    return renderCandidateRow(candidate, hasOfferLetter);
                  })
                  .filter((row) => row !== null)}
              </TableBody>
            </Table>
          </div>
        </Tab>

        <Tab
          key="uploaded"
          title={
            <div className="flex items-center gap-2">
              <span>Uploaded</span>
              <Chip size="sm" color="success" variant="flat">
                {candidatesWithOfferLetters.length}
              </Chip>
            </div>
          }
        >
          <div className="bg-white p-4 rounded-md shadow-sm">
            <Table
              aria-label="Candidates with offer letters"
              removeWrapper
              classNames={{
                th: "bg-default-100 text-default-800 py-3",
                td: "py-3",
              }}
            >
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>EDUCATION</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>CTC</TableColumn>
                <TableColumn className="text-right">ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No candidates have uploaded offer letters yet">
                {candidatesWithOfferLetters
                  .map((candidate) => renderCandidateRow(candidate, true))
                  .filter((row) => row !== null)}
              </TableBody>
            </Table>
          </div>
        </Tab>

        <Tab
          key="pending"
          title={
            <div className="flex items-center gap-2">
              <span>Pending</span>
              <Chip size="sm" color="warning" variant="flat">
                {pendingOfferLetters.length}
              </Chip>
            </div>
          }
        >
          <div className="bg-white p-4 rounded-md shadow-sm">
            <Table
              aria-label="Candidates with pending offer letters"
              removeWrapper
              classNames={{
                th: "bg-default-100 text-default-800 py-3",
                td: "py-3",
              }}
            >
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>EDUCATION</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>CTC</TableColumn>
                <TableColumn className="text-right">ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="All hired candidates have uploaded their offer letters">
                {pendingOfferLetters
                  .map((candidate) => renderCandidateRow(candidate, false))
                  .filter((row) => row !== null)}
              </TableBody>
            </Table>
          </div>
        </Tab>
      </Tabs>

      {hiredCandidates.length === 0 && (
        <div className="bg-white p-8 rounded-md shadow-sm text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-600 mb-2">
            No Hired Candidates
          </p>
          <p className="text-gray-500">
            There are no hired candidates yet. Hired candidates will appear here
            once added.
          </p>
        </div>
      )}

      <CandidateDetailsModal
        isOpen={isOpen}
        onClose={onClose}
        candidate={selectedCandidate}
        onViewFullProfile={navigateToCandidateProfile}
      />
    </div>
  );
};

export default OfferLetters;
