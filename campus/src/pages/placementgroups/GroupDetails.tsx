import React, { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import {
  Card,
  CardBody,
  Tabs,
  Tab,
  Chip,
  Divider,
  CardHeader,
  Listbox,
  ListboxItem,
  ScrollShadow,
} from "@nextui-org/react";
import { AlertCircle, CalendarDays, Users, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import Loader from "@/components/Loader";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { RootContext } from "@/types/RootContext";
import { DataTable } from "./DataTable";
import { ExtendedPlacementGroup } from "@shared-types/ExtendedPlacementGroup";
import { PlacementGroupRule } from "@shared-types/PlacementGroup";

// Helper function to calculate days left
const calculateDaysLeft = (expiryDate: string): number => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  return diffDays;
};

// Component for individual stat card
const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
}> = ({ icon, title, value, color = "primary" }) => (
  <Card className="shadow-md bg-default-50 w-full" shadow="sm">
    <CardBody className="flex flex-row items-center gap-4 p-4">
      <div className={`p-3 rounded-full bg-${color}/20 text-${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-default-500">{title}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </CardBody>
  </Card>
);

// Function to convert to sentence case
const toSentenceCase = (str: string): string => {
  if (!str) return "";
  // Handle potential all-caps acronyms gracefully (optional, adjust as needed)
  if (str === str.toUpperCase() && str.length > 1) {
    return str; // Keep acronyms like CGPA as is
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const GroupDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const axios = ax(getToken);
  const { institute } = useOutletContext<RootContext>();

  const [group, setGroup] = useState<ExtendedPlacementGroup | null>(null);
  const [selected, setSelected] = useState("details");
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    axios
      .get(`/placement-groups/${id}`)
      .then((res) => {
        const groupData = res.data.data as ExtendedPlacementGroup;
        console.log("Group Data:", groupData);
        setGroup(groupData);
        setDaysLeft(calculateDaysLeft(groupData.expiryDate?.toString()));
      })
      .catch((err) => {
        toast.error("Error fetching group details");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const getCategoryFriendlyName = (category: string): string => {
    const categoryMap: Record<string, string> = {
      education: "Education",
      academics: "Academic Performance",
      skills: "Skills",
      experience: "Work Experience",
      profile: "Profile Information",
      demographics: "Demographics",
      personal: "Personal Details",
    };
    return categoryMap[category.toLowerCase()] || toSentenceCase(category);
  };

  // IMPROVED: Helper to format criteria into natural sentences
  const formatCriterionSentence = (rule: PlacementGroupRule): string => {
    const subcategory = rule.subcategory || "Value";
    let valueDisplay: string;

    // Format value display
    if (Array.isArray(rule.value)) {
      if (rule.value.length > 1) {
        const lastItem = rule.value[rule.value.length - 1];
        const otherItems = rule.value.slice(0, -1);
        valueDisplay =
          otherItems.join(", ") +
          (otherItems.length > 0 ? " or " : "") +
          lastItem;
      } else if (rule.value.length === 1) {
        valueDisplay = String(rule.value[0]);
      } else {
        valueDisplay = "any specified value";
      }
    } else if (typeof rule.value === "boolean") {
      valueDisplay = rule.value ? "Yes" : "No";
    } else if (rule.value === null || rule.value === undefined) {
      valueDisplay = "not specified";
    } else {
      valueDisplay = String(rule.value);
    }

    const subcategorySentenceCase = toSentenceCase(subcategory);

    // Handle operators - always use words instead of symbols
    switch (rule.operator) {
      case "eq":
      case "==":
        return `${subcategorySentenceCase} must be equal to ${valueDisplay}.`;

      case "neq":
      case "!=":
        return `${subcategorySentenceCase} must not be equal to ${valueDisplay}.`;

      case "gt":
      case ">":
        return `${subcategorySentenceCase} must be greater than ${valueDisplay}.`;

      case "gte":
      case ">=":
        return `${subcategorySentenceCase} must be at least ${valueDisplay}.`;

      case "lt":
      case "<":
        return `${subcategorySentenceCase} must be less than ${valueDisplay}.`;

      case "lte":
      case "<=":
        return `${subcategorySentenceCase} must be at most ${valueDisplay}.`;

      case "in":
        return `${subcategorySentenceCase} must be one of the following: ${valueDisplay}.`;

      case "nin":
        return `${subcategorySentenceCase} must not be any of the following: ${valueDisplay}.`;

      case "contains":
        return `${subcategorySentenceCase} must contain "${valueDisplay}".`;

      case "startswith":
        return `${subcategorySentenceCase} must start with "${valueDisplay}".`;

      case "endswith":
        return `${subcategorySentenceCase} must end with "${valueDisplay}".`;

      case "exists":
        return `${subcategorySentenceCase} must be provided.`;

      case "notexists":
        return `${subcategorySentenceCase} must not be provided.`;

      default:
        // More friendly fallback for unknown operators
        return `${subcategorySentenceCase} must satisfy condition: ${rule.operator} ${valueDisplay}.`;
    }
  };

  const getCriteriaByCategory = (): Record<string, PlacementGroupRule[]> => {
    if (!group?.criteria || group.criteria.length === 0) return {};
    return group.criteria.reduce(
      (acc: Record<string, PlacementGroupRule[]>, rule) => {
        const category = rule.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push(rule);
        return acc;
      },
      {}
    );
  };

  if (loading) return <Loader />;

  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen">
        Placement Group not found
      </div>
    );
  }

  const criteriaByCategory = getCriteriaByCategory();
  const hasCriteria = Object.keys(criteriaByCategory).length > 0;
  const totalCandidates = group.candidates?.length || 0;
  const isExpired = daysLeft <= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between p-2">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {group.name}
        </h1>
      </div>

      {/* Analytics Section */}
      <div className="flex gap-4 w-full">
        <StatCard
          icon={<Users size={24} />}
          title="Total Candidates"
          value={totalCandidates}
          color="primary"
        />
        <StatCard
          icon={<CalendarDays size={24} />}
          title={isExpired ? "Group Expired On" : "Group Expires In"}
          value={
            isExpired
              ? new Date(group.expiryDate).toLocaleDateString()
              : `${daysLeft} Day(s)`
          }
          color={isExpired ? "danger" : daysLeft < 7 ? "warning" : "success"}
        />
      </div>

      {/* Tabs for Details and Students */}
      <Tabs
        selectedKey={selected}
        onSelectionChange={setSelected as any}
        variant="underlined"
        color="primary"
        classNames={{
          base: "w-full",
          tabList:
            "gap-6 w-full relative rounded-none p-0 border-b border-divider",
          cursor: "w-full bg-primary",
          tab: "max-w-fit px-2 h-12",
        }}
      >
        <Tab key="details" title="Group Details">
          <div className="space-y-6 mt-5">
            {/* Group Information Card */}
            <Card className="bg-default-50 p-2 w-full" shadow="sm">
              <CardHeader>
                <h3 className="text-xl font-semibold">Group Information</h3>
              </CardHeader>
              <Divider />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-sm text-default-500 mb-1">Group Name</p>
                    <p className="text-base font-medium">{group.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500 mb-1">
                      College Batch
                    </p>
                    <p className="text-base font-medium">
                      {group.academicYear.start} - {group.academicYear.end}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500 mb-1">
                      Department(s)
                    </p>
                    <div>
                      {group.departments.length > 0 ? (
                        group.departments.map((d) => (
                          <p key={d} className="text-base font-medium">
                            {institute.departments.find(
                              (dept) => dept._id === d
                            )?.name || "Unknown Department"}
                          </p>
                        ))
                      ) : (
                        <p className="text-base font-medium text-default-500 italic">
                          All departments
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-default-500 mb-1">
                      Group Purpose
                    </p>
                    <p className="text-base font-medium">
                      {group.purpose || (
                        <span className="italic text-default-400">
                          Not specified
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Eligibility Criteria Card - Uses updated sentence formatter */}
            <Card className="bg-default-50 p-2 w-full" shadow="sm">
              <CardHeader>
                <h3 className="text-xl font-semibold">Eligibility Criteria</h3>
              </CardHeader>
              <Divider />
              <CardBody>
                {hasCriteria ? (
                  <ScrollShadow hideScrollBar className="w-full max-h-[400px]">
                    <Listbox
                      variant="flat"
                      aria-label="Eligibility Criteria"
                      className="p-0 gap-0 divide-y divide-default-300/50"
                      itemClasses={{
                        base: "px-3 first:mt-0 py-3",
                        title: "text-base font-semibold text-secondary",
                        description: "text-sm text-default-600",
                      }}
                    >
                      {Object.entries(criteriaByCategory).map(
                        ([category, rules]) => (
                          <ListboxItem
                            key={category}
                            textValue={getCategoryFriendlyName(category)}
                            isReadOnly
                            className="data-[hover=true]:bg-default-100/50 mb-2 rounded-md"
                            startContent={
                              <CheckCircle2
                                size={20}
                                className="text-secondary mr-2"
                              />
                            }
                            title={getCategoryFriendlyName(category)}
                          >
                            <div className="flex flex-col pl-8 pt-1 pb-1">
                              {rules.map((rule, ruleIdx) => (
                                <div
                                  key={ruleIdx}
                                  className="flex items-start gap-2 mb-1.5"
                                >
                                  {/* Uses the IMPROVED sentence formatter */}
                                  <p className="text-sm text-default-700 leading-relaxed">
                                    {formatCriterionSentence(rule)}
                                  </p>
                                  {rule.type && (
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      color={
                                        rule.type.toLowerCase() === "optional"
                                          ? "warning"
                                          : "primary"
                                      }
                                      className="text-xs capitalize mt-0.5 flex-shrink-0"
                                    >
                                      {rule.type}
                                    </Chip>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ListboxItem>
                        )
                      )}
                    </Listbox>
                  </ScrollShadow>
                ) : (
                  <div className="flex items-center gap-2 text-default-500 p-3 bg-default-100 rounded-md">
                    <AlertCircle size={18} />
                    <p className="text-sm">
                      No specific eligibility criteria defined. All students
                      matching the group's department(s) and academic year are
                      included.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* Student Details Tab */}
        <Tab key="students" title={`Students (${totalCandidates})`}>
          <DataTable data={group.candidates} />
        </Tab>
      </Tabs>
    </motion.div>
  );
};

export default GroupDetails;
