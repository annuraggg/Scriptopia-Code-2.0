import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Select, SelectItem } from "@heroui/select";
import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  ListIcon,
  CirclePlayIcon,
  BanIcon,
  Trash2Icon,
  EllipsisVertical,
  Link,
  PlusIcon,
  Search,
  FilterIcon,
} from "lucide-react";
import Filter from "./Filter";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { Posting } from "@shared-types/Posting";
import { Department } from "@shared-types/Organization";
import { RootContext } from "@/types/RootContext";

const Cards = [
  {
    title: "All",
    icon: <ListIcon size={28} />,
    filter: "all",
  },
  {
    title: "Active",
    icon: <CirclePlayIcon size={28} />,
    filter: "active",
  },
  {
    title: "Closed",
    icon: <BanIcon size={28} />,
    filter: "inactive",
  },
];

const Postings: React.FC = () => {
  const navigate = useNavigate();
  const { organization, setOrganization, rerender } =
    useOutletContext() as RootContext;
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  useEffect(() => {
    console.log(organization);
  }, [organization]);

  const [postings, setPostings] = useState<Posting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [sort, setSort] = useState(new Set(["newest"]));
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [workScheduleFilter, setWorkScheduleFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [deleteId, setDeleteId] = useState<string>();

  const editItems = [
    {
      key: "delete",
      title: "Delete",
      icon: <Trash2Icon size={18} />,
      color: "danger" as const,
      onClick: (id: string) => {
        setDeleteId(id);
        onOpen();
      },
    },
  ];

  const filteredPostings = postings?.filter((post) => {
    if (searchTerm) {
      return post.title.toLowerCase().includes(searchTerm.toLowerCase());
    }
    const department = departments.find((dep) => dep._id === post.department);
    if (departmentFilter) {
      return department?.name === departmentFilter;
    }
    if (workScheduleFilter.length > 0) {
      return workScheduleFilter.includes(post.type);
    }
    if (dateRange.start && dateRange.end) {
      const postStartDate = new Date(post.applicationRange.start);
      const postEndDate = new Date(post.applicationRange.end);
      const filterStartDate = new Date(dateRange.start);
      const filterEndDate = new Date(dateRange.end);

      if (postStartDate < filterStartDate || postEndDate > filterEndDate) {
        return false;
      }
    }

    if (selectedFilter === "active") {
      return new Date(post.applicationRange.end) > new Date();
    } else if (selectedFilter === "inactive") {
      return new Date(post.applicationRange.end) < new Date();
    } else {
      return post;
    }
  });

  useEffect(() => {
    let sortedPostings = [...filteredPostings];

    if (sort.has("newest")) {
      sortedPostings = sortedPostings.sort(
        (a, b) =>
          new Date(b.applicationRange.start).getTime() -
          new Date(a.applicationRange.start).getTime()
      );
    } else if (sort.has("oldest")) {
      sortedPostings = sortedPostings.sort(
        (a, b) =>
          new Date(a.applicationRange.start).getTime() -
          new Date(b.applicationRange.start).getTime()
      );
    } else if (sort.has("salary")) {
      sortedPostings = sortedPostings.sort((a, b) => {
        if (!a?.salary?.min || !b?.salary?.min) {
          return 0;
        }
        return a?.salary?.min - b?.salary?.min;
      });
    }
    setPostings(sortedPostings);
  }, [sort]);

  const handleDetailsClick = (posting: Posting) => {
    navigate(`${posting._id}/dashboard`, { state: { posting } });
  };

  const openCreateJobModal = () => {
    if (!departments.length) {
      toast.error("Please create a department first from the settings page");
      return;
    }
    navigate("create");
  };

  const getPostingStatus = (posting: Posting) => {
    if (new Date(posting.applicationRange.end) < new Date()) {
      return "closed";
    }
    return "active";
  };

  useEffect(() => {
    setPostings(organization?.postings);
    setDepartments(organization?.departments || []);
  }, [rerender]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const handleDelete = () => {
    const newOrganization = { ...organization };
    const newPostings = newOrganization.postings?.filter(
      (posting) => posting._id !== deleteId
    );

    setOrganization({ ...newOrganization, postings: newPostings });
    onOpenChange();

    axios.delete(`/postings/${deleteId}`).catch((err) => {
      toast.error(err.response.data.message || "An error occurred");
    });
  };

  return (
    <div className="w-full p-3 md:p-5">
      {/* Breadcrumbs at top level */}
      <Breadcrumbs className="mb-5">
        <BreadcrumbItem href="/postings">Postings</BreadcrumbItem>
      </Breadcrumbs>

      <div className="flex flex-col lg:flex-row gap-5 w-full p-1 md:p-5">
        {/* Mobile Filter Button */}
        <div className="lg:hidden w-full flex justify-end mb-4">
          <Button
            variant="flat"
            onPress={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className="flex items-center gap-2"
          >
            <FilterIcon size={16} />
            Filters
          </Button>
        </div>

        {/* Filter Section */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`${
            isMobileFilterOpen ? "block" : "hidden"
          } lg:block w-full lg:w-1/5 mb-4 lg:mb-0`}
        >
          <Filter
            workScheduleFilter={workScheduleFilter}
            setWorkScheduleFilter={setWorkScheduleFilter}
            departmentFilter={departmentFilter}
            setDepartmentFilter={setDepartmentFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            departments={departments}
            sort={sort}
            setSort={setSort}
          />
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-2 w-full lg:w-4/5"
        >
          {/* Search and Filters Section */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
            <Input
              className="w-full md:w-[300px]"
              placeholder="Search Postings"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<Search size={20} className="opacity-50 mr-2" />}
            />

            <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
              <div className="flex items-center gap-2">
                <p className="text-sm whitespace-nowrap">Job Status</p>
                <Select
                  className="w-[120px]"
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  selectedKeys={[selectedFilter]}
                >
                  {Cards.map((card) => (
                    <SelectItem key={card.filter}>{card.title}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm whitespace-nowrap">Sort by</p>
                <Select
                  className="w-[120px]"
                  selectedKeys={sort}
                  onSelectionChange={(keys) =>
                    setSort(new Set(keys as unknown as string[]))
                  }
                >
                  <SelectItem key="newest">Newest</SelectItem>
                  <SelectItem key="oldest">Oldest</SelectItem>
                  <SelectItem key="salary">Salary</SelectItem>
                </Select>
              </div>
            </div>

            <div className="flex w-full md:w-auto md:ml-auto">
              <Button
                color="success"
                variant="flat"
                onPress={openCreateJobModal}
                className="w-full md:w-auto"
              >
                <PlusIcon size={16} />
                <p>Create job</p>
              </Button>
            </div>
          </div>

          {/* Job Cards */}
          <div className="flex flex-col gap-3 w-full mt-6">
            {filteredPostings?.length === 0 && (
              <div className="flex flex-col items-center justify-center w-full">
                <p className="text-lg font-medium">No postings found</p>
              </div>
            )}
            {filteredPostings?.map((posting, index) => (
              <Card
                className="p-4"
                key={index}
                isPressable
                onPress={() => handleDetailsClick(posting)}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 w-full p-2">
                  <div className="w-full md:w-auto">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                      <p className="font-medium cursor-pointer">
                        {posting.title}
                      </p>
                      <span className="text-xs md:ml-2">
                        {
                          departments.find(
                            (department) =>
                              department._id === posting.department
                          )?.name
                        }
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          getPostingStatus(posting) === "active"
                            ? "text-success-500 bg-success-100"
                            : "text-danger-500 bg-danger-100"
                        }`}
                      >
                        {getPostingStatus(posting) === "active"
                          ? "Active"
                          : "Closed"}
                      </span>

                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          posting?.published
                            ? "text-success-500 bg-success-100"
                            : "text-danger-500 bg-danger-100"
                        }`}
                      >
                        {posting?.published ? "Published" : "Pending Publish"}
                      </span>
                    </div>

                    <p className="text-xs mt-2 md:mt-3 text-left">
                      {getPostingStatus(posting) === "active"
                        ? `Open Until ${new Date(
                            posting.applicationRange.end
                          ).toLocaleString()}`
                        : `Closed at ${new Date(
                            posting.applicationRange.end
                          ).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {posting?.published && posting?.url && (
                      <Button
                        isIconOnly
                        variant="flat"
                        onPress={() => {
                          if (!posting?.url) return;
                          navigator.clipboard.writeText(
                            import.meta.env.VITE_CANDIDATE_URL +
                              "/" +
                              posting?.url
                          );
                          toast.success("Link copied to clipboard");
                        }}
                      >
                        <Link />
                      </Button>
                    )}

                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly variant="flat">
                          <EllipsisVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        {editItems.map((item) => (
                          <DropdownItem
                            key={item.key}
                            className={item.color ? `text-${item.color}` : ""}
                            onPress={() => {
                              item.onClick(posting._id!);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {item.icon}
                              <p>{item.title}</p>
                            </div>
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Delete Modal */}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Are you sure?
                </ModalHeader>
                <ModalBody>
                  This action cannot be undone. Are you sure you want to delete
                  this posting?
                </ModalBody>
                <ModalFooter>
                  <Button color="primary" variant="light" onPress={onClose}>
                    Close
                  </Button>
                  <Button color="danger" onPress={handleDelete}>
                    Delete
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
};

export default Postings;
