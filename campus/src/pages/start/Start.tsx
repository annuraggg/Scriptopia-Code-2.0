import { Button, Card, CardBody, Input } from "@nextui-org/react";
import { ArrowLeftIcon, Briefcase, Link, Mail } from "lucide-react";
import { Trash2Icon } from "lucide-react";
import {
  Table,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableColumn,
  Select,
  SelectItem,
} from "@nextui-org/react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth, useUser } from "@/auth";
import ax from "@/config/axios";
import { useDispatch } from "react-redux";
import { setInstitute } from "@/reducers/instituteReducer";

interface InvitedMember {
  email: string;
  invited: string;
  role: string;
}

interface Role {
  role: string;
}

const Start = () => {
  const [page, setPage] = useState(1);
  const dispatch = useDispatch();

  const [companyName, setCompanyName] = useState<string>("");
  const [companyEmail, setCompanyEmail] = useState<string>("");
  const [companyWebsite, setCompanyWebsite] = useState<string>("");

  const [invitedMembers, setInvitedMembers] = useState<InvitedMember[]>([]);
  const [email, setEmail] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  const [firstLoading, setFirstLoading] = useState(false);
  const [secondLoading, setSecondLoading] = useState(false);

  const roles: Role[] = [
    { role: "Admin" },
    { role: "Hiring Manager" },
    { role: "Finance" },
    { role: "Read Only" },
  ];

  const handleInvite = () => {
    if (email && selectedRole) {
      const currentDate = new Date().toLocaleDateString("en-GB");
      setInvitedMembers([
        ...invitedMembers,
        { email, role: selectedRole, invited: currentDate },
      ]);
      setEmail("");
      setSelectedRole("");
    }
  };

  const handleDeleteInvitedMember = (index: number) => {
    const updatedMembers = invitedMembers.filter((_, i) => i !== index);
    setInvitedMembers(updatedMembers);
  };

  const validateOne = () => {
    if (!companyName || !companyEmail || !companyWebsite) {
      toast.error("Please fill all fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      toast.error("Invalid email address");
      return;
    }

    const websiteRegex = /(http|https):\/\/[^ "]*/;
    if (!websiteRegex.test(companyWebsite)) {
      toast.error("Invalid website address");
      return;
    }

    setFirstLoading(true);
    setTimeout(() => {
      setFirstLoading(false);
      setPage(2);
    }, 2000);
  };

  const { getToken } = useAuth();
  const { user } = useUser();
  const submit = () => {
    const axios = ax(getToken);
    setSecondLoading(true);
    axios
      .post("/institutes/create", {
        name: companyName,
        email: companyEmail,
        website: companyWebsite,
        members: invitedMembers,
      })
      .then(() => {
        setSecondLoading(false);
        toast.success("Institute created successfully");
        window.location.href = "/dashboard";
        const data = {
          _id: user?.publicMetadata?.orgId,
          role: user?.publicMetadata?.roleName,
          permissions: user?.publicMetadata?.permissions,
        };
        dispatch(setInstitute(data));
      })
      .catch((err) => {
        console.error(err);
        setSecondLoading(false);
        toast.error("Failed to create institute");
      });
  };

  return (
    <div className="h-[100vh] flex items-center justify-center">
      {page === 1 && (
        <Card className="w-[500px] drop-shadow-glow-dark">
          <CardBody className="p-10 py-10">
            <h4 className="text-center">Create a new institute</h4>
            <p className="text-center text-xs opacity-50">
              Start your free 14-day trial. No credit card required.
            </p>

            <div className="mt-5 text-sm">
              <div className="flex gap-3 items-center">
                <Briefcase size={18} />
                <p>Company Name</p>
              </div>
              <Input
                placeholder="Company Name"
                className="mt-2"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="mt-5 text-sm">
              <div className="flex gap-3 items-center">
                <Mail size={18} />
                <p>Email</p>
              </div>
              <Input
                placeholder="Email"
                className="mt-2"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
              />
            </div>

            <div className="mt-5 text-sm">
              <div className="flex gap-3 items-center">
                <Link size={18} />
                <p>Website</p>
              </div>
              <Input
                placeholder="Website"
                className="mt-2"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
              />
            </div>

            <Button
              className="mt-5"
              onPress={validateOne}
              isDisabled={firstLoading}
              isLoading={firstLoading}
            >
              Create Institute
            </Button>
            <p className="mt-5 text-center opacity-50 text-sm">
              By signing up for our service, you agree to our Terms & Conditions
              and acknowledge that you have read our Privacy Policy.
            </p>
          </CardBody>
        </Card>
      )}

      {page === 2 && (
        <Card className="w-[800px] drop-shadow-glow-dark h-[80vh]">
          <CardBody className="p-10 py-10">
            <div className="flex gap-3 items-center justify-center">
              <ArrowLeftIcon
                className="text-default-500 cursor-pointer"
                onClick={() => setPage(1)}
              />
              <h4 className="text-center">Invite your team</h4>
            </div>
            <div>
              <div className="flex gap-3 mb-3 items-center mt-5">
                <Input
                  label="Email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  size="sm"
                />
                <Select
                  label="Role"
                  placeholder="Select a role"
                  size="sm"
                  selectedKeys={selectedRole ? [selectedRole] : []}
                  onSelectionChange={(keys) =>
                    setSelectedRole(Array.from(keys)[0] as string)
                  }
                >
                  {roles.map((role) => (
                    <SelectItem key={role.role} value={role.role}>
                      {role.role}
                    </SelectItem>
                  ))}
                </Select>
                <Button onPress={handleInvite}>Invite</Button>
              </div>
              <Table aria-label="Invited Members" removeWrapper>
                <TableHeader>
                  <TableColumn>User</TableColumn>
                  <TableColumn>Invited</TableColumn>
                  <TableColumn>Role</TableColumn>
                  <TableColumn>Actions</TableColumn>
                </TableHeader>
                <TableBody>
                  {invitedMembers.map((member, index) => (
                    <TableRow key={index}>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.invited}</TableCell>
                      <TableCell>{member.role}</TableCell>
                      <TableCell>
                        <Button
                          isIconOnly
                          color="danger"
                          variant="flat"
                          aria-label="Delete"
                          onClick={() => handleDeleteInvitedMember(index)}
                        >
                          <Trash2Icon size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>

          <div className="h-[15vh]">
            {invitedMembers.length === 0 ? (
              <Button
                className="absolute bottom-5 right-5"
                onPress={submit}
                isDisabled={secondLoading}
                isLoading={secondLoading}
                variant="light"
              >
                Skip
              </Button>
            ) : (
              <Button
                className="absolute bottom-5 right-5"
                onPress={submit}
                isDisabled={secondLoading}
                isLoading={secondLoading}
                color="success"
              >
                Continue
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Start;
