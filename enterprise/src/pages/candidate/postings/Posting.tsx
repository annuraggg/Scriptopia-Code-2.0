import { useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import ax from "@/config/axios";
import { AppliedPosting } from "@shared-types/AppliedPosting";
import { Organization } from "@shared-types/Organization";
import { Posting as PostingType } from "@shared-types/Posting";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Link } from "@heroui/link";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tooltip } from "@heroui/tooltip";

import {
  Briefcase,
  DollarSign,
  Globe,
  Mail,
  MapPin,
  CheckCircle,
  ArrowRight,
  Clock,
  FileText,
  Tags,
} from "lucide-react";
import { Divider } from "@heroui/divider";

const routineMap = {
  full_time: "Full Time",
  part_time: "Part Time",
  internship: "Internship",
};

const Posting = () => {
  const { posting, organization } = useOutletContext() as {
    posting: PostingType;
    organization: Organization;
  };

  const [applied, setApplied] = useState(false);
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    axios
      .get(`/candidates/candidate`)
      .then((res) => {
        console.log(res.data);
        const posted = res.data.data.posted;
        if (posted?.some((p: AppliedPosting) => p.posting === posting._id)) {
          setApplied(true);
        }
      })
      .catch((err) => {
        toast.error("Failed to fetch candidate details");
        console.error(err);
      });
  }, []);

  const apply = () => {
    navigate("/postings/" + posting.url + "/apply");
  };

  return (
    <div className="p-6 px-10 mx-auto min-h-[90vh]">
      <Card className="mb-6 shadow-lg">
        <CardBody>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-grow text-center md:text-left">
              <h1 className="text-xl font-bold mb-2">{posting?.title}</h1>
              <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {organization?.name}
              </h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                <Chip
                  startContent={<Briefcase size={16} />}
                  variant="flat"
                  size="sm"
                >
                  {/* @ts-expect-error */}
                  {routineMap[posting?.type]}
                </Chip>
                <Chip
                  startContent={<MapPin size={16} />}
                  variant="flat"
                  size="sm"
                >
                  {posting?.location}
                </Chip>
                <Chip
                  startContent={<DollarSign size={16} />}
                  variant="flat"
                  color="success"
                  size="sm"
                >
                  {posting?.salary?.min} - {posting?.salary?.max}{" "}
                  {posting?.salary?.currency?.toUpperCase()}
                </Chip>
                <Chip
                  startContent={<Clock size={16} />}
                  variant="flat"
                  color="warning"
                  size="sm"
                >
                  Closes{" "}
                  {new Date(
                    posting?.applicationRange?.end
                  ).toLocaleDateString()}
                </Chip>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="flex gap-4">
                <Tooltip content="Visit Website">
                  <Link
                    href={organization?.website}
                    target="_blank"
                    color="primary"
                  >
                    <Globe size={24} />
                  </Link>
                </Tooltip>
                <Tooltip content="Send Email">
                  <Link href={`mailto:${organization?.email}`} color="primary">
                    <Mail size={24} />
                  </Link>
                </Tooltip>
              </div>
              {applied ? (
                <Chip
                  color="success"
                  variant="flat"
                  startContent={<CheckCircle size={16} />}
                >
                  Applied
                </Chip>
              ) : (
                <Button
                  color="primary"
                  variant="shadow"
                  endContent={<ArrowRight size={16} />}
                  onClick={apply}
                >
                  Apply Now
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-5">
        <ScrollShadow className="md:col-span-2">
          <Card className="shadow-md h-[45vh]">
            <CardHeader className="flex gap-3">
              <FileText className="text-primary" />
              <div className="flex flex-col">
                <p className="text-md font-semibold">Job Description</p>
                <p className="text-small text-default-500">
                  What you'll be doing
                </p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody>
              <pre className="whitespace-pre-wrap text-foreground-700">
                {typeof posting?.description === "string"
                  ? posting.description
                  : "No description available"}
              </pre>
            </CardBody>
          </Card>
        </ScrollShadow>
      </div>

      <div className="flex mt-5 gap-5">
        <Card className="shadow-md w-full">
          <CardHeader className="flex gap-3">
            <Tags className="text-primary" />
            <div className="flex flex-col">
              <p className="text-md font-semibold">Required Skills</p>
              <p className="text-small text-default-500">Technical expertise</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {posting?.skills?.map((skill, i) => (
                <Chip key={i} variant="flat" color="default" size="sm">
                  {skill}
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-md w-[30%]">
          <CardBody className="text-center flex items-center justify-center flex-col gap-3">
            <p>Ready to Join?</p>
            {applied ? (
              <Chip
                color="success"
                variant="flat"
                size="lg"
                startContent={<CheckCircle size={20} />}
              >
                You've Applied!
              </Chip>
            ) : (
              <Button
                color="primary"
                variant="shadow"
                size="lg"
                endContent={<ArrowRight size={20} />}
                onClick={apply}
              >
                Submit Your Application
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default Posting;
