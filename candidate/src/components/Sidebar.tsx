import { Badge, Tooltip } from "@heroui/react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  IconBellFilled,
  IconBookFilled,
  IconBriefcaseFilled,
  IconFileDescriptionFilled,
  IconFileTextFilled,
  IconLayoutDashboardFilled,
  IconUserFilled,
  IconLayoutKanbanFilled,
  IconFolderFilled,
  IconTrophyFilled,
  IconRosetteDiscountCheckFilled,
  IconDiamondFilled,
  IconCopyrightFilled,
  IconGlobeFilled,
  IconSquareRoundedPlusFilled,
  IconColorPicker,
  IconBooks,
  IconUsersGroup,
  IconSettingsFilled,
} from "@tabler/icons-react";
import { UserButton } from "@/auth";
import { ExtendedCandidate } from "@shared-types/ExtendedCandidate";

interface SidebarProps {
  icon: any;
  label: string;
  link: string;
  visible?: boolean;
  length?: number;
  children?: SidebarProps[];
}

const profileItems: SidebarProps[] = [
  {
    icon: IconFileDescriptionFilled,
    label: "General",
    link: "",
    visible: true,
  },
  {
    icon: IconBookFilled,
    label: "Education",
    link: "education",
    visible: true,
  },
  { icon: IconBriefcaseFilled, label: "Work", link: "work", visible: true },
  { icon: IconColorPicker, label: "Skills", link: "skills", visible: true },
  {
    icon: IconLayoutKanbanFilled,
    label: "Responsibilities",
    link: "responsibilities",
    visible: true,
  },
  {
    icon: IconFolderFilled,
    label: "Projects",
    link: "projects",
    visible: true,
  },
  { icon: IconTrophyFilled, label: "Awards", link: "awards", visible: true },
  {
    icon: IconRosetteDiscountCheckFilled,
    label: "Certifications",
    link: "certifications",
    visible: true,
  },
  {
    icon: IconDiamondFilled,
    label: "Competitions",
    link: "competitions",
    visible: true,
  },
  {
    icon: IconUserFilled,
    label: "Conferences",
    link: "conferences",
    visible: true,
  },
  {
    icon: IconCopyrightFilled,
    label: "Patents",
    link: "patents",
    visible: true,
  },
  {
    icon: IconBooks,
    label: "Scholarships",
    link: "scholarships",
    visible: true,
  },
  {
    icon: IconGlobeFilled,
    label: "Volunteering",
    link: "volunteering",
    visible: true,
  },
  {
    icon: IconSquareRoundedPlusFilled,
    label: "Extra Curricular",
    link: "extra-curricular",
    visible: true,
  },
];

const campusItems: SidebarProps[] = [
  {
    icon: IconBriefcaseFilled,
    label: "Drives",
    link: "drives",
    visible: true,
  },
  {
    icon: IconUsersGroup,
    label: "Placement Groups",
    link: "placement-groups",
    visible: true,
  },
  {
    icon: IconFileTextFilled,
    label: "Resume",
    link: "resume",
    visible: true,
  },
];

const needFullRadius = ["/campus/drives"];

const Sidebar = ({
  user,
  notifications,
}: {
  user: ExtendedCandidate;
  notifications: number;
}) => {
  const [activeParent, setActiveParent] = useState<string>("");
  const [activeChild, setActiveChild] = useState<string>("");
  const [expandedItem, setExpandedItem] = useState<SidebarProps | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const topItems: SidebarProps[] = [
    {
      icon: IconLayoutDashboardFilled,
      label: "Dashboard",
      link: "dashboard",
      visible: true,
    },
    {
      icon: IconUserFilled,
      label: "Profile",
      link: "profile",
      visible: true,
      children: profileItems,
    },
    // { icon: IconBriefcaseFilled, label: "Jobs", link: "jobs", visible: true },
    {
      icon: IconBookFilled,
      label: "Campus",
      link: user.institute ? "campus/drives" : "campus",
      visible: true,
      children: user.institute ? campusItems : undefined,
    },
  ];

  const bottomItems: SidebarProps[] = [
    {
      icon: IconSettingsFilled,
      label: "Account",
      link: "account",
      visible: true,
    },
    {
      icon: IconBellFilled,
      label: "Notifications",
      link: "notifications",
      visible: true,
      length: notifications,
    },
  ];

  // // Find a sidebar item by label
  // const findItemByLabel = (label: string): SidebarProps | undefined => {
  //   const allItems = [...topItems, ...bottomItems];
  //   return allItems.find((item) => item.label === label);
  // };

  // Update active states and expanded item based on current path
  useEffect(() => {
    const currentPath = location.pathname.split("/").filter(Boolean);

    if (currentPath.length === 0) {
      // Handle root path
      setActiveParent("");
      setActiveChild("");
      setExpandedItem(null);
      return;
    }

    // Check top items first
    let foundParent = false;

    for (const item of topItems) {
      const itemPathSegment = item.link.split("/")[0];

      if (itemPathSegment === currentPath[0]) {
        setActiveParent(item.label);
        foundParent = true;

        // Handle child items if they exist
        if (item.children && currentPath.length > 1) {
          setExpandedItem(item);

          // Find matching child
          for (const child of item.children) {
            // Special handling for campus routes
            if (item.label === "Campus") {
              if (child.link === currentPath[1]) {
                setActiveChild(child.label);
                break;
              }
            }
            // Standard child path matching
            else if (
              child.link === currentPath[1] ||
              (currentPath[0] === "profile" &&
                currentPath[1] === "" &&
                child.link === "")
            ) {
              setActiveChild(child.label);
              break;
            }
          }

          // If no children matched but we have a parent match, ensure child state is updated
          if (
            activeChild &&
            !item.children.some((child) => child.label === activeChild)
          ) {
            setActiveChild("");
          }
        } else {
          // No children or no deep path
          setActiveChild("");
          setExpandedItem(item.children ? item : null);
        }
        break;
      }
    }

    // Check bottom items if no top item match
    if (!foundParent) {
      for (const item of bottomItems) {
        const itemPathSegment = item.link.split("/")[0];
        if (itemPathSegment === currentPath[0]) {
          setActiveParent(item.label);
          setActiveChild("");
          setExpandedItem(null);
          break;
        }
      }
    }

    // If no match found, reset states
    if (!foundParent && !activeChild) {
      setActiveParent("");
      setActiveChild("");
      setExpandedItem(null);
    }
  }, [location.pathname]);

  const changePage = (item: SidebarProps, parentItem?: SidebarProps) => {
    if (parentItem) {
      // This is a child item
      setActiveParent(parentItem.label);
      setActiveChild(item.label);

      // Special case for campus routes
      if (parentItem.label === "Campus") {
        navigate(`campus/${item.link}`);
      } else {
        navigate(`${parentItem.link}/${item.link}`);
      }
    } else {
      // This is a parent item
      setActiveParent(item.label);
      setActiveChild("");

      navigate(item.link);

      // Toggle expanded state if item has children
      if (item.children) {
        setExpandedItem(expandedItem?.label === item.label ? null : item);
      } else {
        setExpandedItem(null);
      }
    }
  };

  return (
    <div
      className={`h-screen flex bg-foreground text-background 
      ${
        needFullRadius.includes(location.pathname.split("/").slice(0).join("/"))
          ? "rounded-none"
          : "rounded-r-2xl"
      } 

      overflow-hidden
    `}
    >
      <div className="flex flex-col items-center justify-between py-5">
        <div>
          <img src="/logo.svg" alt="Logo" className="w-10 h-10 mb-5 mx-auto" />
          {topItems.map((item) => (
            <Tooltip key={item.label} content={item.label} placement="right">
              <div
                className={`cursor-pointer m-3 p-2 rounded-xl hover:bg-zinc-50/10 ${
                  activeParent === item.label ? "bg-zinc-50/10" : ""
                }`}
                onClick={() => changePage(item)}
              >
                <item.icon />
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="justify-self-end flex flex-col items-center gap-4">
          <UserButton />
          {bottomItems.map((item) => (
            <Tooltip key={item.label} content={item.label} placement="right">
              <div
                className={`cursor-pointer m-2 p-1 rounded-xl hover:bg-zinc-50/10 ${
                  activeParent === item.label ? "bg-zinc-50/10" : ""
                }`}
                onClick={() => changePage(item)}
              >
                <Badge
                  content={item?.length}
                  color="primary"
                  className={`${!item?.length ? "hidden" : ""} text-xs`}
                >
                  <item.icon className="w-5 h-5" />
                </Badge>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {expandedItem?.children && (
        <div className="bg-foreground text-background py-2 px-4 rounded-r-2xl scroll-m-5 overflow-y-auto my-3 w-[250px]">
          {expandedItem.children.map((child) => (
            <div
              key={child.label}
              className={`cursor-pointer m-3 p-2 flex items-center rounded-xl hover:bg-zinc-50/10 ${
                activeChild === child.label ? "bg-zinc-50/10" : ""
              }`}
              onClick={() => changePage(child, expandedItem)}
            >
              <child.icon className="mr-3 min-w-6" />
              <p className="text-sm">{child.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
