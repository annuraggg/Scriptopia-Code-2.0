import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Link,
  Spinner,
  Badge,
} from "@nextui-org/react";
import {
  BriefcaseIcon,
  GraduationCapIcon,
  CodeIcon,
  MapPinIcon,
  MailIcon,
  PhoneIcon,
  GlobeIcon,
  UserIcon,
  CalendarIcon,
  FlagIcon,
  GlobeLockIcon,
  HeartHandshakeIcon,
  PaletteIcon,
  BookIcon,
  ScrollTextIcon,
  LandmarkIcon,
  BadgeIcon,
  FileQuestionIcon,
  FileBadgeIcon,
} from "lucide-react";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { toast } from "sonner";
import { Candidate } from "@shared-types/Candidate";

interface SidebarNavItem {
  key: string;
  icon: React.ElementType;
  label: string;
  renderContent: (candidate: Candidate) => React.ReactNode;
}

interface InfoCardProps {
  title: string;
  data: any[] | undefined;
  renderItem: (item: any, index: number) => React.ReactNode;
  emptyMessage?: string;
  icon: React.ElementType;
}

const ProfilePage: React.FC = () => {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("workExperience");
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const fetchCandidateData = async () => {
      try {
        const candId = window.location.pathname.split("/").pop();
        if (!candId) {
          setError("Invalid candidate ID");
          setLoading(false);
          return;
        }

        const response = await axios.get(`institutes/candidate/${candId}`);
        if (response.data && response.data.data) {
          setCandidate(response.data.data);
        } else {
          setError("No candidate data found");
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err.response?.data?.message || "Error fetching candidate data"
        );
        toast.error(err.response?.data?.message || "Error fetching candidate");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateData();
  }, []);

  const InfoCard: React.FC<InfoCardProps> = ({
    title,
    data,
    renderItem,
    emptyMessage = "No information available",
    icon: Icon,
  }) => (
    <Card className="shadow-sm border border-gray-200">
      <CardBody className="p-5">
        <div className="flex items-center mb-4 border-b pb-3">
          <Icon className="mr-3 text-primary" size={20} />
          <h2 className="text-lg font-medium text-gray-800">{title}</h2>
        </div>
        <div className="max-h-[550px] overflow-y-auto pr-1">
          {data && data.length > 0 ? (
            data.map(renderItem)
          ) : (
            <p className="text-gray-500 italic text-sm">{emptyMessage}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "Invalid date";
    }
  };

  const ProfileOverview: React.FC = () => (
    <Card className="shadow-sm border border-gray-200 mb-6">
      <CardBody className="p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="bg-gray-100 p-4 rounded-full">
            <UserIcon className="text-primary" size={32} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-800">
              {candidate?.name || "No name available"}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {candidate?.summary || "No summary provided"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 mt-4">
              {candidate?.email && (
                <div className="flex items-center space-x-2">
                  <MailIcon className="text-gray-500" size={16} />
                  <Link href={`mailto:${candidate.email}`} color="foreground">
                    {candidate.email}
                  </Link>
                </div>
              )}

              {candidate?.phone && (
                <div className="flex items-center space-x-2">
                  <PhoneIcon className="text-gray-500" size={16} />
                  <span>{candidate.phone}</span>
                </div>
              )}

              {candidate?.address && (
                <div className="flex items-center space-x-2">
                  <MapPinIcon className="text-gray-500" size={16} />
                  <span>{candidate.address}</span>
                </div>
              )}

              {(candidate?.dob || candidate?.gender) && (
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="text-gray-500" size={16} />
                  <span>
                    {candidate.dob ? formatDate(candidate.dob?.toString()) : ""}
                    {candidate.dob && candidate.gender ? " | " : ""}
                    {candidate.gender || ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  const sidebarNavItems: SidebarNavItem[] = [
    {
      key: "workExperience",
      icon: BriefcaseIcon,
      label: "Work Experience",
      renderContent: (candidate) => (
        <InfoCard
          title="Professional Experience"
          icon={BriefcaseIcon}
          data={candidate.workExperience}
          renderItem={(work, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                <h3 className="text-base font-semibold">{work.title}</h3>
                {work.type && (
                  <Badge color="primary" variant="flat" size="sm">
                    {work.type}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 text-sm mt-1">
                {work.company} {work.location ? `| ${work.location}` : ""}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(work.startDate)} -{" "}
                {work.current ? "Present" : formatDate(work.endDate)}
              </p>
              {work.description && (
                <p className="mt-2 text-gray-700 text-sm">{work.description}</p>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "education",
      icon: GraduationCapIcon,
      label: "Education",
      renderContent: (candidate) => (
        <InfoCard
          title="Educational Background"
          icon={GraduationCapIcon}
          data={candidate.education}
          renderItem={(edu, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                <h3 className="text-base font-semibold">{edu.degree}</h3>
                {edu.type && (
                  <Badge color="secondary" variant="flat" size="sm">
                    {edu.type}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 text-sm mt-1">
                {edu.school} {edu.board ? `| ${edu.board}` : ""}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {edu.startYear} - {edu.current ? "Present" : edu.endYear}
                {edu.percentage ? ` | ${edu.percentage}%` : ""}
                {edu.branch ? ` | ${edu.branch}` : ""}
              </p>
            </div>
          )}
        />
      ),
    },
    {
      key: "technicalSkills",
      icon: CodeIcon,
      label: "Technical Skills",
      renderContent: (candidate) => (
        <InfoCard
          title="Technical Proficiency"
          icon={CodeIcon}
          data={candidate.technicalSkills}
          renderItem={(skill, index) => (
            <div
              key={index}
              className="flex justify-between items-center mb-3 pb-2 border-b last:border-b-0"
            >
              <span className="text-sm">{skill.skill}</span>
              <Badge color="primary" variant="flat" size="sm">
                {skill.proficiency}/5
              </Badge>
            </div>
          )}
        />
      ),
    },
    {
      key: "projects",
      icon: LandmarkIcon,
      label: "Projects",
      renderContent: (candidate) => (
        <InfoCard
          title="Projects Portfolio"
          icon={LandmarkIcon}
          data={candidate.projects}
          renderItem={(project, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                <h3 className="text-base font-semibold">{project.title}</h3>
                {project.associatedWith && (
                  <Badge color="primary" variant="flat" size="sm">
                    {project.associatedWith}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 text-sm mt-1">
                {project.domain || "N/A"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(project.startDate)} -{" "}
                {project.current ? "Present" : formatDate(project.endDate)}
              </p>
              {project.description && (
                <p className="mt-2 text-gray-700 text-sm">
                  {project.description}
                </p>
              )}
              {project.url && (
                <Link
                  href={project.url}
                  target="_blank"
                  color="primary"
                  className="text-sm mt-2 inline-block"
                >
                  View Project
                </Link>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "certificates",
      icon: FileBadgeIcon,
      label: "Certificates",
      renderContent: (candidate) => (
        <InfoCard
          title="Certifications"
          icon={FileBadgeIcon}
          data={candidate.certificates}
          renderItem={(cert, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{cert.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{cert.issuer}</p>
              <p className="text-gray-500 text-xs mt-1">
                Issued: {formatDate(cert.issueDate)}
              </p>
              {cert.hasScore && cert.score && (
                <Badge
                  color="primary"
                  variant="flat"
                  size="sm"
                  className="mt-1"
                >
                  Score: {cert.score}%
                </Badge>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "languages",
      icon: FlagIcon,
      label: "Languages",
      renderContent: (candidate) => (
        <InfoCard
          title="Language Proficiency"
          icon={FlagIcon}
          data={candidate.languages}
          renderItem={(lang, index) => (
            <div
              key={index}
              className="flex justify-between items-center mb-3 pb-2 border-b last:border-b-0"
            >
              <span className="text-sm">{lang.language}</span>
              <Badge color="primary" variant="flat" size="sm">
                {lang.proficiency}/5
              </Badge>
            </div>
          )}
        />
      ),
    },
    {
      key: "awards",
      icon: BadgeIcon,
      label: "Awards",
      renderContent: (candidate) => (
        <InfoCard
          title="Achievements & Recognition"
          icon={BadgeIcon}
          data={candidate.awards}
          renderItem={(award, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{award.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{award.issuer}</p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(award.date)}
              </p>
              {award.associatedWith && (
                <Badge
                  color="secondary"
                  variant="flat"
                  size="sm"
                  className="mt-1"
                >
                  {award.associatedWith}
                </Badge>
              )}
              {award.description && (
                <p className="mt-2 text-gray-700 text-sm">
                  {award.description}
                </p>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "responsibilities",
      icon: ScrollTextIcon,
      label: "Responsibilities",
      renderContent: (candidate) => (
        <InfoCard
          title="Professional Responsibilities"
          icon={ScrollTextIcon}
          data={candidate.responsibilities}
          renderItem={(resp, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{resp.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{resp.institute}</p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(resp.startDate)} -{" "}
                {resp.current ? "Present" : formatDate(resp.endDate)}
              </p>
              {resp.description && (
                <p className="mt-2 text-gray-700 text-sm">{resp.description}</p>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "competitions",
      icon: FileQuestionIcon,
      label: "Competitions",
      renderContent: (candidate) => (
        <InfoCard
          title="Competitions"
          icon={FileQuestionIcon}
          data={candidate.competitions}
          renderItem={(comp, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{comp.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{comp.organizer}</p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(comp.date)}
              </p>
              {comp.position && (
                <Badge
                  color="secondary"
                  variant="flat"
                  size="sm"
                  className="mt-1"
                >
                  {comp.position}
                </Badge>
              )}
              {comp.description && (
                <p className="mt-2 text-gray-700 text-sm">{comp.description}</p>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "social",
      icon: GlobeIcon,
      label: "Social Links",
      renderContent: (candidate) => (
        <InfoCard
          title="Social Profiles"
          icon={GlobeIcon}
          data={candidate.socialLinks}
          renderItem={(link, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 pb-3 border-b last:border-b-0"
            >
              <span className="text-sm capitalize font-medium mb-1 sm:mb-0">
                {link.platform}
              </span>
              <Link
                href={link.url}
                target="_blank"
                color="primary"
                className="text-xs sm:text-sm break-all"
              >
                {link.url}
              </Link>
            </div>
          )}
        />
      ),
    },
    {
      key: "subjects",
      icon: BookIcon,
      label: "Subjects",
      renderContent: (candidate) => (
        <InfoCard
          title="Subject Knowledge"
          icon={BookIcon}
          data={candidate.subjects}
          renderItem={(subject, index) => (
            <div
              key={index}
              className="flex justify-between items-center mb-3 pb-2 border-b last:border-b-0"
            >
              <span className="text-sm">{subject.subject}</span>
              <Badge color="secondary" variant="flat" size="sm">
                {subject.proficiency}%
              </Badge>
            </div>
          )}
        />
      ),
    },
    {
      key: "patents",
      icon: GlobeLockIcon,
      label: "Patents",
      renderContent: (candidate) => (
        <InfoCard
          title="Patents"
          icon={GlobeLockIcon}
          data={candidate.patents}
          renderItem={(patent, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{patent.title}</h3>
              <div className="flex flex-wrap text-gray-600 text-sm mt-1 gap-x-2">
                <span>{patent.patentOffice}</span>
                {patent.patentNumber && (
                  <>
                    <span>|</span>
                    <span>{patent.patentNumber}</span>
                  </>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Filed: {formatDate(patent.filingDate)}
                {patent.issueDate &&
                  ` | Issued: ${formatDate(patent.issueDate)}`}
              </p>
              {patent.status && (
                <Badge
                  color="secondary"
                  variant="flat"
                  size="sm"
                  className="mt-1"
                >
                  {patent.status}
                </Badge>
              )}
            </div>
          )}
        />
      ),
    },
    {
      key: "volunteering",
      icon: HeartHandshakeIcon,
      label: "Volunteering",
      renderContent: (candidate) => (
        <InfoCard
          title="Volunteer Work"
          icon={HeartHandshakeIcon}
          data={candidate.volunteerings}
          renderItem={(volunteer, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{volunteer.role}</h3>
              <div className="flex flex-wrap text-gray-600 text-sm mt-1 gap-x-2">
                <span>{volunteer.institute}</span>
                {volunteer.cause && (
                  <>
                    <span>|</span>
                    <span>{volunteer.cause}</span>
                  </>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(volunteer.startDate)} -{" "}
                {volunteer.current ? "Present" : formatDate(volunteer.endDate)}
              </p>
            </div>
          )}
        />
      ),
    },
    {
      key: "extraCurricular",
      icon: PaletteIcon,
      label: "Extra Curricular",
      renderContent: (candidate) => (
        <InfoCard
          title="Extra-Curricular Activities"
          icon={PaletteIcon}
          data={candidate.extraCurriculars}
          renderItem={(activity, index) => (
            <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
              <h3 className="text-base font-semibold">{activity.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{activity.category}</p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(activity.startDate)} -{" "}
                {activity.current ? "Present" : formatDate(activity.endDate)}
              </p>
            </div>
          )}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardBody className="p-8 text-center">
            <div className="text-danger mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12" y2="16"></line>
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-gray-600">
              {error || "Failed to load candidate data"}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <ProfileOverview />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="shadow-sm border border-gray-200 sticky top-6">
              <CardBody className="p-0">
                <nav>
                  <div className="p-3 border-b border-gray-100">
                    <h2 className="font-medium text-gray-600 text-sm">
                      PROFILE SECTIONS
                    </h2>
                  </div>
                  <div className="py-2">
                    {sidebarNavItems.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setActiveTab(item.key)}
                        className={`
                          w-full flex items-center px-4 py-2.5 text-sm
                          ${
                            activeTab === item.key
                              ? "bg-primary-50 text-primary border-l-4 border-primary"
                              : "text-gray-700 hover:bg-gray-50"
                          }
                        `}
                      >
                        <item.icon className="mr-3" size={16} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </nav>
              </CardBody>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {sidebarNavItems
              .find((item) => item.key === activeTab)
              ?.renderContent(candidate)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
